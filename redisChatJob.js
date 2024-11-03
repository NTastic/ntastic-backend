import Bull from 'bull';
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

const SYSTEM_CONTENT = process.env.OPENAI_SYSTEM_PROMPT;
const SYSTEM_TAG_CONTENT = process.env.OPENAI_SYSTEM_TAG_PROMPT;
const EXCEPTION_TAG = process.env.OPENAI_EXCEPTION_TAG || "Other";

if (!SYSTEM_CONTENT || !SYSTEM_TAG_CONTENT) throw new Error("PROMPT not found");

aiAnswerQueue.process(async (job) => {
  const { content } = job.data;

  // identify tags
  const tagMessages = [
    { role: 'system', content: SYSTEM_TAG_CONTENT },
    { role: 'user', content: content },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: tagMessages,
    });

    for (const choice of completion.choices) {
      const contentTags = choice.message.content.trim();
      if (contentTags) {
        console.log(`AI tag answers: ${contentTags}.`);
      } else {
        console.log(`Message: ${choice.message}`);
      }
    }
  } catch (error) {
    console.error(`Error when categorized question ${content}.`, error);
    throw error;
  }
  

  const messages = [
    { role: 'system', content: SYSTEM_CONTENT },
    { role: 'user', content: content },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: messages,
    });

    for (const choice of completion.choices) {
      const aiAnswerContent = choice.message.content.trim();
      if (aiAnswerContent) {
        console.log(`AI answers: ${aiAnswerContent}.`);
      } else {
        console.log(`Message: ${choice.message}`);
      }
    }
  } catch (error) {
    console.error(`Error when generating AI answer for question ${content}.`, error);
    throw error;
  }
});

// listening for job completion
aiAnswerQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} has completed. Question: ${job.data.content}`);
});

// listening for job fail
aiAnswerQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

aiAnswerQueue.on('error', (error) => {
  console.error('Bull queue error:', error);
});

export default aiAnswerQueue;


await aiAnswerQueue.add({ content: "give me some best restaurants for me and my family" }, {
    attempts: 3,
    backoff: 5000,
  });