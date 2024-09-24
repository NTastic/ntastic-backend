const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  synonyms: [{ type: String }],
  parentTagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag' },
}, { timestamps: true });

TagSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('Tag', TagSchema);
