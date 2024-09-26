import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  content: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  votes: {
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
  },
}, { timestamps: true });

AnswerSchema.index({ questionId: 1 });

const Answer = mongoose.model('Answer', AnswerSchema)
export default Answer;
