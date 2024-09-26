import mongoose from 'mongoose';
import { getGridFSBucket } from '../gridfs.js';

export const imagesEndpoint = async (req, res) => {
  let fileId
  try {
    fileId = new mongoose.Types.ObjectId(req.params.id);
  } catch {
    return res.status(404).json({ message: 'Image not found' });
  }
  try {
    const bucket = getGridFSBucket();

    const files = await bucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);

    // Cache the image for 1 year
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    // set ETag header using file's uploadDate
    const eTag = `${file._id.toString()}-${file.uploadDate.getTime()}`;
    res.set('ETag', eTag);

    // conditional requests
    if (req.headers['if-none-match'] === eTag) {
      return res.status(304).end();
    }

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      res.status(500).send('An error occurred while streaming the file');
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
