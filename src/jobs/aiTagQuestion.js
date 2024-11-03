import Bull from 'bull';
import { Question, Tag } from '../models/index.js';
import OpenAI from 'openai';
import dotenvFlow from 'dotenv-flow';
import { nonEmptyArray } from '../utils/common.js';
dotenvFlow.config();

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

const aiTagQueue = new Bull('ai-answer-queue', {
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
  },
});

const openai = new OpenAI();

const SYSTEM_TAG_CONTENT = process.env.OPENAI_SYSTEM_TAG_PROMPT;
if (!SYSTEM_TAG_CONTENT) throw new Error("PROMPT not found");

aiTagQueue.process(async (job) => {
  const { questionId } = job.data;

  const question = await Question.findById(questionId);
  if (!question) {
    throw new Error(`Not found question with ID ${questionId}`);
  }
  const allTags = await Tag.find();

  const userContent = (question.title === question.content) ? `${question.content}`
    : `${question.title}\n${question.content}`;

  // identify tags
  const messages = [
    { role: 'system', content: SYSTEM_TAG_CONTENT + " TAGS:" + allTags.map(tag => tag.name).join(" ") },
    { role: 'user', content: userContent },
  ];
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: messages,
    });

    for (const choice of completion.choices) {
      const contentTags = choice.message.content.trim();
      if (contentTags) {
        const tagsStr = contentTags.split(' ');
        const tags = allTags.filter(tag=>tagsStr.includes(tag.name))
        if (!nonEmptyArray(tags)) throw new Error(`tags not found for ${contentTags}`);

        const tagIds = tags.map(tag => tag._id);
        question.tagIds = tagIds;
        // update question tags
        await question.save();

        await Tag.updateMany(
          { _id: { $in: question.tagIds } },
          { $inc: { questionCount: 1 } }
        );
        console.log(`AI tags saved for question ${question._id}.`);
      }
    }
  } catch (error) {
    console.error(`Error when labelising Tag for question ${question._id}.`, error);
    throw error;
  }
});

// listening for job completion
aiTagQueue.on('completed', (job, result) => {
  console.log(`Tag Job ${job.id} has completed. Question ID: ${job.data.questionId}`);
});

// listening for job fail
aiTagQueue.on('failed', (job, err) => {
  console.error(`Tag Job ${job.id} failed:`, err);
});

aiTagQueue.on('error', (error) => {
  console.error('Bull queue error:', error);
});

export default aiTagQueue;