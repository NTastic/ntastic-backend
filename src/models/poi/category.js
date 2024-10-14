import mongoose from 'mongoose';

export const MODEL_CATEGORY = 'poi.Category';
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String },
  parentCatId: { type: mongoose.Schema.Types.ObjectId, ref: MODEL_CATEGORY, index: true },
  subCatIds: [{ type: mongoose.Schema.Types.ObjectId, ref: MODEL_CATEGORY, index: true }],
  poiCount: { type: Number, default: 0 },
}, { timestamps: true });

CategorySchema.index({ slug: 1 }, { unique: true });

const Category = mongoose.model(MODEL_CATEGORY, CategorySchema);
export default Category;
