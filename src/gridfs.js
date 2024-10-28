import mongoose from 'mongoose';
import Grid from 'gridfs-stream';

let gfs;
let gridfsBucket;

export const IMAGES = 'images';
export const IMAGES_FILES = IMAGES + ".files";
const connectDB = async (uri) => {
  try {
    const conn = await mongoose.connect(uri);
    console.log('MongoDB connected:', uri);

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
