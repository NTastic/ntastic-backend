import mongoose from 'mongoose';
import { MODEL_QUESTION } from './question.js';
import { MODEL_USER } from '../user.js';
import { IMAGES_FILES } from '../../gridfs.js';

export const MODEL_ANSWER = 'community.Answer';
const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_QUESTION, required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_USER, required: true },
  imageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: IMAGES_FILES }],
  externalImageUrls: [{ type: String }],
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

AnswerSchema.index({ questionId: 1 });

const Answer = mongoose.model(MODEL_ANSWER, AnswerSchema)
export default Answer;
