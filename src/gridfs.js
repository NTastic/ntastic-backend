import mongoose from 'mongoose';
import Grid from 'gridfs-stream';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

let gfs;
let gridfsBucket;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const db = mongoose.connection.db;
    gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'images',
    });

    gfs = Grid(db, mongoose.mongo)
    gfs.collection('images');

    console.log('GridFS connected');
  } catch (err) {
    console.error('GridFS connection error:', err);
  }
};

const getGFS = () => gfs;
const getGridFSBucket = () => gridfsBucket;

export {
  connectDB,
  getGFS,
  getGridFSBucket,
};
