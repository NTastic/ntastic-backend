import Bull from 'bull';
import { User, Question, Answer } from '../models/index.js';
import OpenAI from 'openai';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

const aiAnswerQueue = new Bull('ai-answer-queue', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
  },
});

const openai = new OpenAI();

const SYSTEM_CONTENT = process.env.OPENAI_SYSTEM_PROMPT || "No more than 100 words for each response.";

aiAnswerQueue.process(async (job) => {
  const { questionId } = job.data;

  const question = await Question.findById(questionId);
  if (!question) {
    throw new Error(`Not found question with ID ${questionId}`);
  }

  const aiBotUser = await User.findOne({ email: process.env.AI_BOT_EMAIL });
  if (!aiBotUser) {
    throw new Error('Not found user AI-bot');
  }

  const messages = [
    { role: 'system', content: SYSTEM_CONTENT },
    { role: 'user', content: `${question.content}` },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: messages,
    });

    const aiAnswerContent = completion.choices[0].message.content.trim();

    if (aiAnswerContent) {
      const answer = new Answer({
        questionId: question._id,
        content: aiAnswerContent,
        authorId: aiBotUser._id,
      });

      await answer.save();
      console.log(`AI answer saved for question ${question._id}.`);
    }
  } catch (error) {
    console.error(`Error when generating AI answer for question ${question._id}.`, error);
    throw error;
  }
});

// listening for job completion
aiAnswerQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} has completed. Question ID: ${job.data.questionId}`);
});

// listening for job fail
aiAnswerQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

aiAnswerQueue.on('error', (error) => {
  console.error('Bull queue error:', error);
});

export default aiAnswerQueue;