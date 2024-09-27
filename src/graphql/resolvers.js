import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import User from '../models/User.js';
import Tag from '../models/Tag.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import Vote from '../models/Vote.js';
import aiAnswerQueue from '../jobs/aiAnswer.js';
import mongoose from 'mongoose';
import { getGridFSBucket } from '../gridfs.js';
import { DateTimeResolver } from 'graphql-scalars';
import { validateFile, checkStorageLimit, updateUserStorage } from '../utils/storage.js';
import { validateUser, pagingQuery } from '../utils/graphqlHelper.js';
import { getBaseUrl } from '../utils/url.js';

const { ObjectId } = mongoose.Types;

const JOB_ATTEMPTS = 3;
const JOB_BACKOFF = 5000;

const resolvers = {
  Date: DateTimeResolver,
  Upload: GraphQLUpload,

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
    getQuestions: async (_, { tagIds, tagMatch = 'ANY', userId, page = 1, limit = 10, sortOrder = 'DESC' }) => {

      // Build filter options
      let filterOptions = {};
      if (tagIds && tagIds.length > 0) {
        const tagObjectIds = tagIds;
        if (tagMatch === 'ALL') {
          filterOptions.tagIds = { $all: tagObjectIds };
        } else {
          // 'ANY' match
          filterOptions.tagIds = { $in: tagObjectIds };
        }
      }
      if (userId) filterOptions.authorId = userId;
      const sortOptions = { createdAt: sortOrder === 'ASC' ? 1 : -1 };
      return await pagingQuery(Question, page, limit, filterOptions, sortOptions, [
        { path: 'authorId', model: 'User' },
        { path: 'tagIds', model: 'Tag' },
      ]);
    },

    // get answer
    getAnswer: async (_, { id }) => {
      return await Answer.findById(id);
    },
    getAnswers: async (_, { questionId, userId, page = 1, limit = 10, sortOrder = 'ASC' }) => {
      if (!questionId && !userId) throw new Error("At least one of the QuestionId and UserId must be present");

      const sortOptions = { createdAt: sortOrder === 'ASC' ? 1 : -1 };

      const filterOptions = {};
      if (questionId) filterOptions.questionId = questionId;
      if (userId) filterOptions.authorId = userId;

      return await pagingQuery(Answer, page, limit, filterOptions, sortOptions, [
        { path: 'authorId', model: 'User' },
      ]);
    },

    // get image
    getImage: async (_, { id }) => {
      const bucket = getGridFSBucket();
      try {
        if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
        const files = await bucket.find({ _id: new ObjectId(id) }).toArray();
        if (!files || files.length === 0) {
          throw new Error('Image not found');
        }
        const fileInfo = files[0];
        const image = {
          id: fileInfo._id,
          filename: fileInfo.filename,
          contentType: fileInfo.contentType,
          length: fileInfo.length,
          uploadDate: fileInfo.uploadDate,
        };
        return image;
      } catch (err) {
        console.error(err);
        throw new Error('Error fetching image');
      }
    },

    // get user images
    getUserImages: async (_, __, { userId }) => {
      await validateUser(userId);

      try {
        const bucket = getGridFSBucket();

        // Find all files where metadata.uploadedBy matches
        const files = await bucket
          .find({ 'metadata.uploadedBy': userId })
          .toArray();

        // Map the files to Image type
        const images = files.map((file) => ({
          id: file._id.toString(),
          filename: file.filename,
          contentType: file.contentType || 'application/octet-stream',
          length: file.length,
          uploadDate: file.uploadDate,
        }));
        return images;
      } catch (err) {
        console.error('Error fetching user images:', err);
        throw new Error('An error occurred while fetching images');
      }
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
      if (user.isBot) {
        console.warn(`Bot ${email} try to login`);
        throw new Error('Cannot login as robot');
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Incorrect password');
      const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1d' });
      return {
        token,
        user,
      };
    },

    updateUser: async (_, { username, avatarImageId }, { userId }) => {
      const user = await validateUser(userId);

      user.username = username || user.username;
      user.avatarImageId = avatarImageId || user.avatarImageId;
      user.updatedAt = new Date();

      await user.save();
      return user;
    },

    // create tag
    createTag: async (_, { name, description, synonyms, parentTagId }, { userId }) => {
      await validateUser(userId);

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

    createQuestion: async (_, { title, content, tagIds, imageIds }, { userId }) => {
      await validateUser(userId);

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
        imageIds,
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

    updateQuestion: async (_, { id, title, content, tagIds, imageIds }, { userId }) => {
      await validateUser(userId);
      const question = await Question.findById(id);
      if (!question) throw new Error('Question not found');
      if (question.authorId.toString() !== userId) throw new Error('Cannot edit other users\' content');
      if (!title && !content && (!tagIds || tagIds.length === 0) && !imageIds) return question;
      if (title) {
        question.title = title.trim();
      }
      if (content && content.trim()) {
        question.content = content.trim();
      }
      if (tagIds && tagIds.length >= 0) {
        question.tagIds = tagIds.map((id) => new ObjectId(id));
      }
      if (imageIds) {
        question.imageIds = imageIds.map((id) => new ObjectId(id));
      }
      return await question.save();
    },

    deleteQuestion: async (_, { id }, { userId }) => {
      await validateUser(userId);

      if (!ObjectId.isValid(id)) throw new Error('Invalid question ID');

      const question = await Question.findById(id);

      if (!question) return false;

      if (question.authorId.toString() !== userId) {
        throw new Error('You are not authorized to delete this question');
      }

      // delete associated answers
      await Answer.deleteMany({ questionId: question._id });

      // update tags question count
      await Tag.updateMany(
        { _id: { $in: question.tagIds } },
        { $inc: { questionCount: -1 } }
      );

      // delete associated images
      if (question.imageIds && question.imageIds.length > 0) {
        for (const imageId of question.imageIds) {
          try {
            await deleteImage(imageId, userId);
          } catch (err) {
            console.error(`Error delete image ${imageId}:`, err);
          }
        }
      }

      await Question.deleteOne({ _id: id });

      return true;
    },

    createAnswer: async (_, { questionId, content, imageIds }, { userId }) => {
      await validateUser(userId);

      const question = await Question.findById(questionId);
      if (!question) throw new Error('Question not found');

      const answer = new Answer({
        questionId,
        content,
        authorId: userId,
        imageIds,
      });

      return await answer.save();
    },

    updateAnswer: async (_, { id, content, imageIds }, { userId }) => {
      await validateUser(userId);

      const answer = await Answer.findById(id);
      if (!answer) throw new Error('Question not found');
      if (answer.authorId.toString() !== userId) throw new Error('Cannot edit other users\' content');
      if (!content && !imageIds) return answer;
      if (content && content.trim()) {
        answer.content = content.trim();
      }
      if (imageIds) {
        answer.imageIds = imageIds;
      }
      return await answer.save();
    },

    deleteAnswer: async (_, { id }, { userId }) => {
      await validateUser(userId);

      if (!ObjectId.isValid(id)) throw new Error('Invalid answer ID');

      const answer = await Answer.findById(id);

      if (!answer) return false;

      if (answer.authorId.toString() !== userId) {
        throw new Error('You are not authorized to delete this answer');
      }

      // delete associated images
      if (answer.imageIds && answer.imageIds.length > 0) {
        for (const imageId of answer.imageIds) {
          try {
            await deleteImage(imageId, userId);
          } catch (err) {
            console.error(`Error deleting image ${imageId}:`, err);
          }
        }
      }

      await Answer.deleteOne({ _id: id });
      return true;
    },

    vote: async (_, { targetId, targetType, voteType }, { userId }) => {
      await validateUser(userId);

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
            const increment = voteType === 'upvote' ? {
              'votes.upvotes': 1, 'votes.downvotes': -1
            } : { 'votes.upvotes': -1, 'votes.downvotes': 1 };
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
          const increment = voteType === 'upvote' ? { 'votes.upvotes': 1 } : { 'votes.downvotes': 1 };
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

    // upload image
    uploadImage: async (_, { file }, { userId }) => {
      const user = await validateUser(userId);

      const bucket = getGridFSBucket();
      const { createReadStream, filename, mimetype } = await file;

      // create a stream and calculate file size
      const stream = createReadStream();
      let fileSize = 0;
      const chunks = [];

      stream.on('data', (chunk) => {
        fileSize += chunk.length;
        chunks.push(chunk);
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);

      // validate the file
      validateFile(mimetype, fileSize);

      checkStorageLimit(user, fileSize);

      // Sanitize filename
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');

      // upload to GridFS
      const uploadStream = bucket.openUploadStream(sanitizedFilename, {
        contentType: mimetype,

        metadata: {
          uploadedBy: userId,
          originalName: filename,
        },
      });

      uploadStream.end(buffer);

      return new Promise((resolve, reject) => {
        uploadStream.on('error', (error) => {
          console.error('Error uploading file:', error);
          reject(new Error('Error uploading file'));
        });

        uploadStream.on('finish', async () => {
          try {
            await updateUserStorage(user, fileSize);
            const files = await bucket.find({ _id: uploadStream.id }).toArray();
            if (files.length === 0) {
              throw new Error('Failed to retrieve uploaded file info');
            }
            const fileInfo = files[0];
            const image = {
              id: fileInfo._id,
              filename: fileInfo.filename,
              contentType: fileInfo.contentType,
              length: fileInfo.length,
              uploadDate: fileInfo.uploadDate,
            };
            // console.log('uploaded image:', image);
            resolve(image);
          } catch (err) {
            console.error(err);
            reject(new Error('Error updating user storage'));
          }
        });
      });
    },

    deleteImage: async (_, { imageId }, { userId }) => {
      const user = await validateUser(userId);

      try {
        if (!ObjectId.isValid(imageId)) return false;
        const bucket = getGridFSBucket();

        const fileId = new ObjectId(imageId);

        // Find the file
        const files = await bucket.find({ _id: fileId }).toArray();
        if (!files || files.length === 0) {
          throw new Error('File not found');
        }

        const file = files[0];

        // Check ownership
        if (file.metadata.uploadedBy.toString() !== userId) {
          throw new Error('You are not authorized to delete this image');
        }

        // Delete the file from GridFS
        await bucket.delete(fileId);

        updateUserStorage(user, -file.length);

        // Remove references to the image in User, Question, and Answer documents
        await User.updateMany(
          { avatarImageId: fileId },
          { $unset: { avatarImageId: '' } }
        );

        await Question.updateMany(
          { imageIds: fileId },
          { $pull: { imageIds: fileId } }
        );

        await Answer.updateMany(
          { imageIds: fileId },
          { $pull: { imageIds: fileId } }
        );
        return true;
      } catch (err) {
        console.error('Error deleting image:', err);
        throw new Error('Error deleting the image');
      }
    },
  },

  Image: {
    id: (parent) => parent.id,
    filename: (parent) => parent.filename,
    contentType: (parent) => parent.contentType,
    length: (parent) => parent.length,
    uploadDate: (parent) => parent.uploadDate,
  },
  User: {
    avatar: async (parent, _, context) => {
      if (!parent.avatarImageId) return null;
      return `${getBaseUrl(context)}/images/${parent.avatarImageId}`;
    },
  },

  Tag: {
    parentTag: async (tag) => {
      return await Tag.findById(tag.parentTagId);
    },
  },

  Question: {
    images: async (question, _, context) => {
      if (!question.imageIds || question.imageIds.length === 0) return [];
      return question.imageIds.map(id => `${getBaseUrl(context)}/images/${id}`);
    },
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
    images: async (answer, _, context) => {
      if (!answer.imageIds || answer.imageIds.length === 0) return [];
      return answer.imageIds.map(id => `${getBaseUrl(context)}/images/${id}`);
    },
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

export default resolvers;
