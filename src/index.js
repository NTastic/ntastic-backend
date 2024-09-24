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
const morgan = require('morgan');
const DataLoader = require('dataloader');

const typeDefs = require('./schema/typeDefs');
const resolvers = require('./resolvers');

const SECRET_KEY = process.env.SECRET_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = parseInt(process.env.PORT, 10) || 4000;
const ENABLE_INTROSPECTION = process.env.ENABLE_INTROSPECTION === 'true';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [`http://localhost:3000`];
const IS_PRODUCTION = process.env.NODE_ENV === 'production'

if (!SECRET_KEY) {
  throw new Error('SECRET_KEY is not defined in environment variables');
}

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

const app = express();


app.use(cors({
  origin: ALLOWED_ORIGINS,
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
mongoose.connect(MONGODB_URI).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// create dataloaders
const createLoaders = () => ({
  userLoader: new DataLoader(async (userIds) => {
    const users = await User.find({ _id: { $in: userIds } });
    return userIds.map(id => users.find(user => user.id === id.toString()));
  }),
  tagLoader: new DataLoader(async (tagIds) => {
    const tags = await Tag.find({ _id: { $in: tagIds } });
    return tagIds.map(id => tags.find(tag => tag.id === id.toString()));
  }),
  questionLoader: new DataLoader(async (questionIds) => {
    const questions = await Question.find({ _id: { $in: questionIds } });
    return questionIds.map(id => questions.find(q => q.id === id.toString()));
  }),
  answerLoader: new DataLoader(async (answerIds) => {
    const answers = await Answer.find({ _id: { $in: answerIds } });
    return answerIds.map(id => answers.find(a => a.id === id.toString()));
  }),
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

  app.listen({ port: PORT }, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  );
})();
