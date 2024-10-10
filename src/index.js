import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer, AuthenticationError } from 'apollo-server-core';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
import http from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenvFlow from 'dotenv-flow';

import schema from './graphql/schema.js';
import { connectDB } from './gridfs.js';
import { imagesEndpoint } from './utils/image.js';

import aiAnswerQueue from './jobs/aiAnswer.js';

const { ObjectId } = mongoose.Types;

dotenvFlow.config();

const {
  SECRET_KEY,
  REFRESH_SECRET_KEY,
  MONGODB_URI,
  PORT = 4000,
  ENABLE_INTROSPECTION = false,
  ALLOWED_ORIGINS = "http://localhost:3000",
  IS_PRODUCTION = process.env.NODE_ENV === 'production',
} = process.env;

if (!SECRET_KEY || !REFRESH_SECRET_KEY) {
  throw new Error('SECRET_KEY or REFRESH_SECRET_KEY is not defined in environment variables');
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
  } else {
    app.use(morgan('dev'));
  }

  // request limitation
  // const limiter = rateLimit({
  //   windowMs: 10 * 60 * 1000, // 10 minutes
  //   max: 2000, // limit each IP to 2000 requests per windowMs
  //   message: 'Too many requests from this IP, please try again after 10 minutes',
  // });
  // app.use(limiter);

  // prevent large file request attack
  app.use(express.json({ limit: '10kb' }));

  // connect to MongoDB
  await connectDB();

  // handling file uploads
  app.use(graphqlUploadExpress({ maxFileSize: 5 * 1024 * 1024, maxFiles: 10 }));

  // Image download endpoint
  app.get('/images/:id', imagesEndpoint);

  // for nginx reverse proxy
  app.set('trust proxy', true);

  // http server
  const httpServer = http.createServer(app);

  // websocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql', // Same path as GraphQL endpoint
  });

  const serverCleanup = useServer({
    schema: schema,
    context: async (ctx, msg, args) => {
      // This context function will be called for each subscription operation
      // Here to handle authentication for subscriptions
      const { connectionParams, extra } = ctx;
      let userId = null;

      if (connectionParams && connectionParams.authorization) {
        const token = connectionParams.authorization;
        if (token) {
          try {
            const decoded = jwt.verify(token.replace('Bearer ', ''), SECRET_KEY);
            userId = decoded.userId;
          } catch (err) {
            if (err.name === 'TokenExpiredError') {
              console.warn('Access token expired in connectionParams');
            } else {
              console.warn('Invalid access token in connectionParams');
            }
          }
        }
        return { userId, SECRET_KEY, REFRESH_SECRET_KEY };
      }
    },
  }, wsServer);

  // Apollo Server config
  const server = new ApolloServer({
    schema: schema,
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
          if (err.name === 'TokenExpiredError') {
            console.warn('Access token expired');
            throw new AuthenticationError('Access token expired');
          } else {
            console.warn('Invalid access token');
          }
        }
      }

      return { req, userId, SECRET_KEY, REFRESH_SECRET_KEY };
    },
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            }
          }
        }
      },
    ],
  });

  // start server
  await server.start();
  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: false,
  });

  httpServer.listen({ port: PORT }, () =>
    console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
  );
};

startServer();
