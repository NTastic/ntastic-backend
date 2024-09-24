const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true }],
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
});

QuestionSchema.path('tagIds').validate(function (value) {
  return value.length > 0;
}, 'Question must have at least one TAG.');

// indexing tagIds
QuestionSchema.index({ tagIds: 1 });
QuestionSchema.index({ authorId: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
