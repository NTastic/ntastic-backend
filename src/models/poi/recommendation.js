import mongoose from 'mongoose';
import { MODEL_CATEGORY } from './category.js';
import { PoiSchema } from './poi.js';
import { CommentSchema } from './comment.js';

export const MODEL_RECOMMENDATION = 'poi.Recommendation';
const RecommendationSchema = new mongoose.Schema({
  description: { type: String },
  catIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_CATEGORY,
    required: true,
  }],
  poi: { type: PoiSchema, required: true },
  comment: { type: CommentSchema, required: true },
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

const Recommendation = mongoose.model(MODEL_RECOMMENDATION, RecommendationSchema);
export default Recommendation;
