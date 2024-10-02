import mongoose from 'mongoose';
import { MODEL_CATEGORY } from './category.js';

export const MODEL_POI = 'poi.POI';
const PoiSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    cordinates: { type: [Number] },
  },
  categoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: MODEL_CATEGORY,
    required: true,
    index: true,
  }],
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  photoUrls: [{ type: String }],
  workingHours: [{ day: String, open: String, close: String }],
  website: { type: String },
}, { timestamps: true });

PoiSchema.index({ location: '2dsphere' });

const POI = mongoose.model(MODEL_POI, PoiSchema)
export default POI;
