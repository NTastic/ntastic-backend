import mongoose from 'mongoose';
import { MODEL_POI } from './poi.js';
import { MODEL_USER } from '../user.js';

export const MODEL_COMMENT = 'poi.Comment';
const CommentSchema = new mongoose.Schema({
  poiId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_POI, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_USER, required: true },
  content: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 5 },
  imageUrls: [{ type: String }],
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

CommentSchema.index({ poiId: 1 });
CommentSchema.index({ authorId: 1 });

const Comment = mongoose.model(MODEL_COMMENT, CommentSchema)
export default Comment;
