const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['Question', 'Answer'], required: true },
  voteType: { type: String, enum: ['upvote', 'downvote'], required: true },
  createdAt: { type: Date, default: Date.now },
});

VoteSchema.index({ userId: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', VoteSchema);
