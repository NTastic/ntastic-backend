import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenvFlow from 'dotenv-flow';

import typeDefs from './graphql/typeDefs.js';
import resolvers from './graphql/resolvers.js';
import { connectDB, getGridFSBucket } from './gridfs.js';

import aiAnswerQueue from './jobs/aiAnswer.js';

import path from 'path';
import { fileURLToPath } from 'url';

const { ObjectId } = mongoose.Types;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const startServer = async () => {

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
  app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 10 }));

  // Image download endpoint
  app.get('/images/:id', async (req, res) => {
    try {
      const fileId = new ObjectId(req.params.id);
      const bucket = getGridFSBucket();

      const files = await bucket.find({ _id: fileId }).toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ message: 'Image not found' });
      }

      const file = files[0];
      res.set('Content-Type', file.contentType || 'application/octet-stream');
      res.set('Content-Disposition', `inline; filename="${file.filename}"`);

      const downloadStream = bucket.openDownloadStream(fileId);
      downloadStream.pipe(res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
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
