import mongoose from 'mongoose';
import { MODEL_USER } from './user.js';

export const MODEL_VOTE = 'common.Vote';
const VoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_USER, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, required: true },
  voteType: { type: String, enum: ['upvote', 'downvote'], required: true },
}, { timestamps: true });

VoteSchema.index({ userId: 1, targetId: 1 }, { unique: true });

const Vote = mongoose.model(MODEL_VOTE, VoteSchema);
export default Vote;