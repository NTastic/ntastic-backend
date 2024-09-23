require('dotenv').config();
const moduleAlias = require('module-alias');
moduleAlias.addAlias('punycode', 'punycode/');
const { ApolloServer } = require('apollo-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers');

const SECRET_KEY = process.env.SECRET_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 4000;

// connect to MongoDB
mongoose.connect(MONGODB_URI);
mongoose.connection.once('open', () => {
  console.log('MongoDB connected');
});

// Apollo Server config
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    // get token from request header
    const token = req.headers.authorization || "";
    let userId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        userId = decode.userId;
      } catch (err) {
        console.warn('Invalid token');
      }
    }

    return { userId, SECRETE_KEY };
  },
});

// start server
server.listen({ port: PORT }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});

