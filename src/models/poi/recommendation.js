import mongoose from 'mongoose';
import { MODEL_CATEGORY } from './category.js';
import { MODEL_POI } from './poi.js';
import { MODEL_COMMENT } from './comment.js';

export const MODEL_RECOMMENDATION = 'poi.Recommendation';
const RecommendationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  catIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_CATEGORY,
    required: true,
  }],
  list: [{
    poiId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_POI },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_COMMENT },
  }],
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

const Recommendation = mongoose.model(MODEL_RECOMMENDATION, RecommendationSchema)
export default Recommendation;
