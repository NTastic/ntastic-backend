const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
});

QuestionSchema.pre('save', function (next) {
  if (this.tagIds, length === 0) {
    return next(new Error('Question must have at least one TAG.'));
  }
  next();
});

// indexing tagIds
QuestionSchema.index({ tagIds: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
