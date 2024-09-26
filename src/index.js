const moduleAlias = require('module-alias');
moduleAlias.addAlias('punycode', 'punycode/');
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenvFlow = require('dotenv-flow');

const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { connectDB } = require('./gridfs');

const aiAnswerQueue = require('./jobs/aiAnswer');

dotenvFlow.config();
const {
  SECRET_KEY,
  MONGODB_URI,
  PORT = 4000,
  ENABLE_INTROSPECTION = false,
  ALLOWED_ORIGINS = "http://localhost:3000",
  IS_PRODUCTION = process.env.NODE_ENV === 'production',
} = process.env;

if (!SECRET_KEY) {
  throw new Error('SECRET_KEY is not defined in environment variables');
}

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

const startServer = async() => {

const app = express();


app.use(cors({
  origin: ALLOWED_ORIGINS.split(','),
  credentials: true,
}));

// log
if (IS_PRODUCTION) {
  app.use(morgan('combined'))
  // Security middlewares
  app.use(helmet())

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
  });
  app.use(limiter);
} else {
  app.use(morgan('dev'));
}

// prevent large file request attack
app.use(express.json({ limit: '10kb' }));

// connect to MongoDB
await connectDB();

// handling file uploads
//app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 10 }));

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
        const decoded = jwt.verify(token.replace('Bearer ', ''), SECRET_KEY);
        userId = decoded.userId;
      } catch (err) {
        console.warn('Invalid token');
      }
    }

    return { userId, SECRET_KEY };
  },
});

// start server
  await server.start();
  server.applyMiddleware({ app });

  app.listen({ port: PORT }, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  );
};

startServer();
