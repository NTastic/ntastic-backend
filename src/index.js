const moduleAlias = require('module-alias');
moduleAlias.addAlias('punycode', 'punycode/');
require('dotenv').config();
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers');

const SECRET_KEY = process.env.SECRET_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 4000;
const ENABLE_INTROSPECTION = process.env.ENABLE_INTROSPECTION === 'true';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [`http://localhost:3000`];

if (!SECRET_KEY) {
  throw new Error('SECRET_KEY is not defined in environment variables');
}

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

const app = express();

// Security middlewares
// app.use(helmet());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// connect to MongoDB
mongoose.connect(MONGODB_URI);
mongoose.connection.once('open', () => {
  console.log('MongoDB connected');
});

// Apollo Server config
const server = new ApolloServer({
  typeDefs,
  resolvers,
  // playground: ENABLE_INTROSPECTION,
  introspection: ENABLE_INTROSPECTION,
  context: ({ req }) => {
    // get token from request header
    const token = req.headers.authorization || "";
    let userId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decoded.userId;
      } catch (err) {
        console.warn('Invalid token');
      }
    }

    return { userId, SECRET_KEY };
  },
});

// start server
(async () => {
  await server.start();
  server.applyMiddleware({ app });
  
  // global error handle
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });

  app.listen({ port: PORT }, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  );
})();
