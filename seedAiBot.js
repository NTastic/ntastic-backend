const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
require('dotenv-flow').config();

const BOT_NAME = process.env.AI_BOT_USERNAME || 'NTasticBot';
const BOT_EMAIL = process.env.AI_BOT_EMAIL || 'ai@ntastic.site'
const BOT_PASSWD = process.env.AI_BOT_PASSWORD || 'BotPasswd123!'

const seedAiBot = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const existingBot = await User.findOne({ username: BOT_NAME });
  if (existingBot) {
    console.log('AI-bot user exists.');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(BOT_PASSWD, 10);
  const aiBot = new User({
    username: BOT_NAME,
    email: BOT_EMAIL,
    password: hashedPassword,
    isBot: true,
  });

  await aiBot.save();
  console.log('AI-bot user created.');
  process.exit(0);
};

seedAiBot().catch(err => {
  console.error('Error on creating AI-bot:', err);
  process.exit(1);
});
