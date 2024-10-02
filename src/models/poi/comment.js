import mongoose from 'mongoose';
import { MODEL_POI } from './poi.js';
import { MODEL_USER } from '../user.js';
import { IMAGES_FILES } from '../../gridfs.js';

export const MODEL_COMMENT = 'poi.Comment';
const CommentSchema = new mongoose.Schema({
  poiId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_POI, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_USER, required: true },
  content: { type: String, required: true },
  rating: { type: Number },
  imageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: IMAGES_FILES }],
  externalImageUrls: [{ type: String }],
}, { timestamps: true });

CommentSchema.index({ poiId: 1 });
CommentSchema.index({ authorId: 1 });

const Comment = mongoose.model(MODEL_COMMENT, CommentSchema)
export default Comment;
