import { MAX_STORAGE_PER_MODEL_USER, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '../config/storage.js';
import mongoose from 'mongoose';
import { getGridFSBucket } from '../gridfs.js';

const { ObjectId } = mongoose.Types;

/**
 * Validates the uploaded file
 */
export const validateFile = (mimetype, size) => {
  if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
    throw new Error('Unsupported file type. Allowed types: JPEG, PNG, GIF.');
  }

  if (size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds the limit of ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
  }
};

/**
 * Check if the user has enough storage to upload a file of given size.
 */
export const checkStorageLimit = (user, newFileSize) => {
  if (user.imageStorageUsed + newFileSize > MAX_STORAGE_PER_MODEL_USER) {
    throw new Error(`Uploading this file would exceed your storage limit of ${MAX_STORAGE_PER_MODEL_USER / (1024 * 1024)} MB`);
  }
};

/**
 * Updates the user's storage usage.
 */
export const updateUserStorage = async (user, sizeChange) => {
  if (sizeChange === 0) return;
  user.imageStorageUsed = Math.max(0, user.imageStorageUsed + sizeChange);
  await user.save();
};

/**
 * Deletes a file from GridFS and updates user's storage usage.
 */
export const deleteFileAndUpdateStorage = async (user, fileId) => {
  const bucket = getGridFSBucket();
  const files = await bucket.find({ _id: fileId }).toArray();

  if (files.length === 0) {
    throw new Error('File not found');
  }

  const file = files[0];

  await bucket.delete(file._id);
  await updateUserStorage(user, -file.length);
};
