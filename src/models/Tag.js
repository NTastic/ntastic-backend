import mongoose from 'mongoose';

const TagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  synonyms: [{ type: String }],
  parentTagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag' },
  questionCount: { type: Number, default: 0 },
}, { timestamps: true });

TagSchema.index({ slug: 1 }, { unique: true });

const Tag = mongoose.model('Tag', TagSchema);
export default Tag;
