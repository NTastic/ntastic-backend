import mongoose from 'mongoose';
import { MODEL_USER } from '../user.js';
import { MODEL_TAG } from './tag.js';
import { IMAGES_FILES } from '../../gridfs.js';

export const MODEL_QUESTION = 'community.Question';
const QuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_USER, required: true },
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: MODEL_TAG, required: true }],
  imageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: IMAGES_FILES }],
  externalImageUrls: [{ type: String }],
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

QuestionSchema.path('tagIds').validate(function (value) {
  return value.length > 0;
}, 'Question must have at least one MODEL_TAG.');

// indexing tagIds
QuestionSchema.index({ tagIds: 1 });
QuestionSchema.index({ authorId: 1 });

const Question = mongoose.model(MODEL_QUESTION, QuestionSchema);
export default Question;
