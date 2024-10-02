import mongoose from 'mongoose';
import Grid from 'gridfs-stream';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

let gfs;
let gridfsBucket;

export const IMAGES = 'images';
export const IMAGES_FILES = IMAGES + ".files";
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');

    const db = mongoose.connection.db;
    gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: IMAGES,
    });

    gfs = Grid(db, mongoose.mongo)
    gfs.collection(IMAGES);

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
