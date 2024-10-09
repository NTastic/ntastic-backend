import { User, Tag, Question, Answer } from '../models/index.js';
import aiAnswerQueue from '../jobs/aiAnswer.js';
import mongoose from 'mongoose';
import { validateUser, pagingQuery } from '../utils/graphqlHelper.js';
import { getBaseUrl, validateUrls } from '../utils/url.js';
import { MODEL_USER } from '../models/common/user.js';
import { MODEL_TAG } from '../models/community/tag.js';
import { nonEmptyArray } from '../utils/common.js';

const { ObjectId } = mongoose.Types;

const JOB_ATTEMPTS = 3;
const JOB_BACKOFF = 5000;

const communityResolvers = {
  Query: {
    // get Tag
    getTag: async (_, { id }) => {
      return await Tag.findById(id);
    },
    getTags: async (_, { sort }) => {
      const sortField = sort?.field || 'name';
      const sortOrder = sort?.order === 'DESC' ? -1 : 1;
      const sortOptions = { [sortField]: sortOrder };

      return await Tag.find().sort(sortOptions);
    },
    searchTags: async (_, { keyword }) => {
      return await Tag.find({
        $or: [
          { name: new RegExp(keyword, 'i') },
          { synonyms: { $in: [new RegExp(keyword, 'i')] } },
        ],
      });
    },

    // get question
    getQuestion: async (_, { id }) => {
      return await Question.findById(id);
    },
    getQuestions: async (_, { tagIds, tagMatch = 'ANY', userId, pageOptions, }) => {
      // Build filter options
      let filterOptions = {};
      if (nonEmptyArray(tagIds)) {
        const tagObjectIds = tagIds;
        if (tagMatch === 'ALL') {
          filterOptions.tagIds = { $all: tagObjectIds };
        } else {
          // 'ANY' match
          filterOptions.tagIds = { $in: tagObjectIds };
        }
      }
      if (userId) filterOptions.authorId = userId;
      return await pagingQuery(Question, pageOptions, filterOptions, [
        { path: 'authorId', model: MODEL_USER },
        { path: 'tagIds', model: MODEL_TAG },
      ]);
    },

    // get answer
    getAnswer: async (_, { id }) => {
      return await Answer.findById(id);
    },
    getAnswers: async (_, { questionId, userId, pageOptions }) => {
      if (!questionId && !userId) throw new Error("At least one of the QuestionId and UserId must be present");

      const filterOptions = {};
      if (questionId) filterOptions.questionId = questionId;
      if (userId) filterOptions.authorId = userId;

      return await pagingQuery(Answer, pageOptions, filterOptions, [
        { path: 'authorId', model: MODEL_USER },
      ]);
    },
  },

  Mutation: {
    // create tag
    createTag: async (_, { name, description, synonyms, parentTagId }, { userId }) => {
      await validateUser(userId);

      const formattedName = name.trim();
      if (!formattedName) throw new Error("Invalid Tag name");
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

    updateTag: async (_, { id, name, description, synonyms, parentTagId }, { userId }) => {
      await validateUser(userId);
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

    mergeTags: async (_, { sourceTagIds, targetTagId }, { userId }) => {
      await validateUser(userId);
      const targetTag = await Tag.findById(targetTagId);
      if (!targetTag) return {
        result: false,
        message: 'Target tag not found',
      };

      for (const sourceTagId of sourceTagIds) {
        if (sourceTagId.toString() === targetTagId.toString()) continue;

        const sourceTag = await Tag.findById(sourceTagId);
        if (!sourceTag) continue;

        // update related questions
        await Question.updateMany(
          { tagIds: sourceTagId },
          [{
            $set: {
              tagIds: {
                $let: {
                  vars: {
                    withoutSourceTag: {
                      $filter: {
                        input: '$tagIds',
                        cond: { $ne: ['$$this', sourceTagId] }
                      }
                    }
                  },
                  in: { $concatArrays: ['$$withoutSourceTag', [targetTagId]] }
                }
              }
            }
          }]
        );

        // update synonyms
        targetTag.synonyms = [...new Set([...targetTag.synonyms, sourceTag.name, ...sourceTag.synonyms])];
      }

      // delete original tags
      await Tag.deleteMany({ _id: { $in: sourceTagIds } })
      await targetTag.save();

      return {
        result: true,
        message: 'Tags merged successfully',
        data: targetTag,
      };
    },

    createQuestion: async (_, { title, content, tagIds, imageIds, externalImageUrls }, { userId }) => {
      await validateUser(userId);

      if (!tagIds || tagIds.length === 0) {
        throw new Error('At least one tag is required');
      }

      const tags = await Tag.find({ _id: { $in: tagIds } });
      if (tags.length !== tagIds.length) {
        throw new Error('Invalid tag IDs');
      }

      if (nonEmptyArray(externalImageUrls)) {
        validateUrls(externalImageUrls);
      }

      const question = new Question({
        title,
        content,
        authorId: userId,
        tagIds,
        imageIds,
        externalImageUrls,
      });

      const savedQuestion = await question.save();

      await Tag.updateMany(
        { _id: { $in: savedQuestion.tagIds } },
        { $inc: { questionCount: 1 } }
      );

      // add to ai answer queue
      await aiAnswerQueue.add({ questionId: savedQuestion._id }, {
        attempts: JOB_ATTEMPTS,
        backoff: JOB_BACKOFF,
      });

      return savedQuestion;
    },

    updateQuestion: async (_, { id, title, content, tagIds, imageIds, externalImageUrls }, { userId }) => {
      await validateUser(userId);
      const question = await Question.findById(id);
      if (!question) throw new Error('Question not found');
      if (question.authorId.toString() !== userId) throw new Error('Cannot edit other users\' content');
      if (!title && !content && (!tagIds || tagIds.length === 0) && !imageIds && !externalImageUrls) return question;
      if (title.trim()) {
        question.title = title.trim();
      }
      if (content && content.trim()) {
        question.content = content.trim();
      }
      if (nonEmptyArray(tagIds)) {
        question.tagIds = tagIds;
      }
      if (imageIds) {
        question.imageIds = imageIds;
      }
      if (externalImageUrls) {
        validateUrls(externalImageUrls);
        question.externalImageUrls = externalImageUrls
      }
      return await question.save();
    },

    deleteQuestion: async (_, { id }, { userId }) => {
      await validateUser(userId);

      if (!ObjectId.isValid(id)) throw new Error('Invalid question ID');

      const question = await Question.findById(id);

      if (!question) return { result: false, message: 'Question not found' };

      if (question.authorId.toString() !== userId) {
        return { result: false, message: 'You are not authorized to delete this question' };
      }

      // delete associated answers
      await Answer.deleteMany({ questionId: question._id });

      // update tags question count
      await Tag.updateMany(
        { _id: { $in: question.tagIds } },
        { $inc: { questionCount: -1 } }
      );

      // delete associated images
      if (nonEmptyArray(question.imageIds)) {
        for (const imageId of question.imageIds) {
          try {
            await deleteImage(imageId, userId);
          } catch (err) {
            console.error(`Error delete image ${imageId}:`, err);
          }
        }
      }

      await Question.deleteOne({ _id: id });

      return { result: true, message: 'Question deleted' };
    },

    createAnswer: async (_, { questionId, content, imageIds, externalImageUrls }, { userId }) => {
      await validateUser(userId);

      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');
      if (nonEmptyArray(externalImageUrls)) validateUrls(externalImageUrls);
      const answer = new Answer({
        questionId,
        content,
        authorId: userId,
        imageIds,
        externalImageUrls,
      });

      return await answer.save();
    },

    updateAnswer: async (_, { id, content, imageIds, externalImageUrls }, { userId }) => {
      await validateUser(userId);

      const answer = await Answer.findById(id);
      if (!answer) throw new Error('Question not found');
      if (answer.authorId.toString() !== userId) throw new Error('Cannot edit other users\' content');
      if (!content && !imageIds && !externalImageUrls) return answer;
      if (content && content.trim()) {
        answer.content = content.trim();
      }
      if (imageIds) {
        answer.imageIds = imageIds;
      }
      if (externalImageUrls) {
        validateUrls(externalImageUrls);
        answer.externalImageUrls = externalImageUrls;
      }
      return await answer.save();
    },

    deleteAnswer: async (_, { id }, { userId }) => {
      await validateUser(userId);

      if (!ObjectId.isValid(id)) return {
        result: false,
        message: 'Invalid answer ID',
      };

      const answer = await Answer.findById(id);

      if (!answer) return {
        result: false,
        message: 'Answer not found',
      };

      if (answer.authorId.toString() !== userId) {
        return {
          result: false,
          message: 'You are not authorized to delete this answer',
        };
      }

      // delete associated images
      if (nonEmptyArray(answer.imageIds)) {
        for (const imageId of answer.imageIds) {
          try {
            await deleteImage(imageId, userId);
          } catch (err) {
            console.error(`Error deleting image ${imageId}:`, err);
          }
        }
      }

      await Answer.deleteOne({ _id: id });
      return {
        result: true,
        message: 'Answer deleted',
        data: answer,
      };
    },
  },

  Tag: {
    parentTag: async (tag) => {
      return await Tag.findById(tag.parentTagId);
    },
  },

  Question: {
    images: async (question, _, context) => {
      const internalImages = nonEmptyArray(question.imageIds)
        ? question.imageIds.map(id => `${getBaseUrl(context)}/images/${id}`)
        : [];
      const externalImages = question.externalImageUrls || [];
      return [...internalImages, ...externalImages];
    },
    author: async (question) => {
      return await User.findById(question.authorId);
    },
    tags: async (question) => {
      return await Tag.find({ _id: { $in: question.tagIds } });
    },
    answers: async (question) => {
      return await pagingQuery(Answer, {}, { questionId: question.id });
    },
  },

  Answer: {
    images: async (answer, _, context) => {
      const internalImages = nonEmptyArray(answer.imageIds)
        ? answer.imageIds.map(id => `${getBaseUrl(context)}/images/${id}`)
        : [];
      const externalImages = answer.externalImageUrls || [];
      return [...internalImages, ...externalImages];
    },
    author: async (answer) => {
      return await User.findById(answer.authorId);
    },
    question: async (answer) => {
      return await Question.findById(answer.questionId);
    },
  },
};

export default communityResolvers;
