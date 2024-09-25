const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tag = require('../models/Tag');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Vote = require('../models/Vote');

const { DateTimeResolver } = require('graphql-scalars');

const resolvers = {
  Date: DateTimeResolver,

  Query: {
    // get User
    getUser: async (_, { id }) => {
      return await User.findById(id);
    },
    getUsers: async () => {
      return await User.find();
    },

    // get Tag
    getTag: async (_, { id }) => {
      return await Tag.findById(id);
    },
    getTags: async () => {
      return await Tag.find();
    },
    searchTags: async (_, { keyword }) => {
      return await Tag.find({
        $or: [
          { name: new RegExp(keyword, 'i') },
          { synonyms: { $in: [new RegExp(keyword, 'i')] } },
        ],
      });
    },
    getQuestionsByTag: async (_, { tagId }) => {
      return await Question.find({ tagIds: tagId });
    },

    // get question
    getQuestion: async (_, { id }) => {
      return await Question.findById(id);
    },
    getQuestions: async () => {
      return await Question.find();
    },

    // get answer
    getAnswer: async (_, { id }) => {
      return await Answer.findById(id);
    },
    getAnswers: async (_, { questionId }) => {
      return await Answer.find({ questionId });
    },
  },

  Mutation: {
    // register user
    register: async (_, { username, email, password }, { SECRET_KEY }) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) throw new Error('Email already registered');

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        username,
        email,
        password: hashedPassword,
      });
      // save to database
      const res = await user.save();
      // Optionally, generate a JWT token here
      const token = jwt.sign({ userId: res.id }, SECRET_KEY, { expiresIn: '1d' });
      return {
        token,
        user: res,
      };
    },

    // user login
    login: async (_, { email, password }, { SECRET_KEY }) => {
      const user = await User.findOne({ email }).select('+password');
      if (!user) throw new Error('User not found');
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Incorrect password');
      const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
      return {
        token,
        user,
      };
    },

    // create tag
    createTag: async (_, { name, description, synonyms, parentTagId }) => {
      const formattedName = name.trim();
      const slug = formattedName.toLowerCase().replace(/\s+/g, '-');

      const existingTag = await Tag.findOne({ slug });
      if (existingTag) throw new Error('Tag already exists');

      const tag = new Tag({
        name: formattedName,
        slug,
        description,
        synonyms,
        parentTagId,
      });

      return await tag.save();
    },

    updateTag: async (_, { id, name, description, synonyms, parentTagId }) => {
      const tag = await Tag.findById(id);
      if (!tag) throw new Error('Tag not found');

      if (name) {
        tag.name = name.trim();
        tag.slug = tag.name.toLowerCase().replace(/\s+/g, '-');
      }
      if (description) tag.description = description;
      if (synonyms) tag.synonyms = synonyms;
      if (parentTagId) tag.parentTagId = parentTagId;

      return await tag.save();
    },

    mergeTags: async (_, { sourceTagIds, targetTagId }) => {
      const targetTag = await Tag.findById(targetTagId);
      if (!targetTag) throw new Error('Target tag not found');

      for (const sourceTagId of sourceTagIds) {
        if (sourceTagId.toString() === targetTagId.toString()) continue;

        const sourceTag = await Tag.findById(sourceTagId);
        if (!sourceTag) continue;

        // update related questions
        await Question.updateMany(
          { tagIds: sourceTagId },
          { $addToSet: { tagIds: targetTagId }, $pull: { tagIds: sourceTagId } }
        );

        // update synonyms
        targetTag.synonyms = [...new Set([...targetTag.synonyms, sourceTag.name, ...sourceTag.synonyms])];

        // delete original tag
        await sourceTag.remove();
      }

      await targetTag.save();

      return {
        success: true,
        message: 'Tags merged successfully',
        mergedTag: targetTag,
      };
    },

    createQuestion: async (_, { title, content, tagIds }, { userId }) => {
      if (!userId) throw new Error('Authentication required');

      if (!tagIds || tagIds.length === 0) {
        throw new Error('At least one tag is required');
      }

      const tags = await Tag.find({ _id: { $in: tagIds } });
      if (tags.length !== tagIds.length) {
        throw new Error('Invalid tag IDs');
      }

      const question = new Question({
        title,
        content,
        authorId: userId,
        tagIds,
      });

      return await question.save();
    },

    addTagsToQuestion: async (_, { questionId, tagIds }) => {
      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      question.tagIds = [...new Set([...question.tagIds, ...tagIds])];

      return await question.save();
    },

    createAnswer: async (_, { questionId, content }, { userId }) => {
      if (!userId) throw new Error('Authentication required');

      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      const answer = new Answer({
        questionId,
        content,
        authorId: userId,
      });

      return await answer.save();
    },

    vote: async (_, { targetId, targetType, voteType }, { userId }) => {
      if (!userId) throw new Error('Authentication required');

      if (!['Question', 'Answer'].includes(targetType)) {
        throw new Error('Invalid target type');
      }

      if (!['upvote', 'downvote'].includes(voteType)) {
        throw new Error('Invalid vote type');
      }

      const Model = targetType === 'Question' ? Question : Answer;
      const target = await Model.findById(targetId);
      if (!target) throw new Error(`${targetType} not found`);

      try {
        const existingVote = await Vote.findOne({ userId, targetId });

        if (existingVote) {
          if (existingVote.voteType === voteType) {
            return {
              success: false,
              message: `You have already ${voteType}d this ${targetType.toLowerCase()}`,
              voteCount: target.votes,
            };
          } else {
            const increment = voteType === 'upvote' ? { upvotes: 1, downvotes: -1 } : { upvotes: -1, downvotes: 1 };
            // update vote type and count
            await Vote.findByIdAndUpdate(existingVote._id, { voteType }, { new: true });
            const updatedTarget = await Model.findByIdAndUpdate(
              targetId,
              { $inc: increment },
              { new: true }
            );

            return {
              success: true,
              message: 'Vote updated',
              voteCount: updatedTarget.votes,
            };
          }
        } else {
          // create new vote
          const vote = new Vote({
            userId,
            targetId,
            targetType,
            voteType,
          });
          await vote.save();

          // update target votes
          const increment = voteType === 'upvote' ? { upvotes: 1 } : { downvotes: 1 };
          const updatedTarget = await Model.findByIdAndUpdate(
            targetId,
            { $inc: increment },
            { new: true }
          );

          return {
            success: true,
            message: 'Vote recorded',
            voteCount: updatedTarget.votes,
          };
        }
      } catch (error) {
        console.error("Vote mutation error:", error);
        throw new Error('Failed to process vote');
      }
    },
  },

  User: {
    questions: async (user) => {
      return await Question.find({ authorId: user.id });
    },
    answers: async (user) => {
      return await Answer.find({ authorId: user.id });
    },
  },

  Tag: {
    parentTag: async (tag) => {
      return await Tag.findById(tag.parentTagId);
    },
    questions: async (tag) => {
      return await Question.find({ tagIds: tag.id });
    },
  },

  Question: {
    author: async (question) => {
      return await User.findById(question.authorId);
    },
    tags: async (question) => {
      return await Tag.find({ _id: { $in: question.tagIds } });
    },
    answers: async (question) => {
      return await Answer.find({ questionId: question.id });
    },
  },

  Answer: {
    author: async (answer) => {
      return await User.findById(answer.authorId);
    },
    question: async (answer) => {
      return await Question.findById(answer.questionId);
    },
  },

  Vote: {
    user: async (vote) => {
      return await User.findById(vote.userId);
    },
  },
};

module.exports = resolvers;
