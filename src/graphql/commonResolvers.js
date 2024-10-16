import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';
import {
  User,
  Vote,
  Character,
  Question,
  Answer,
  POI,
  Comment,
  Category,
  Recommendation,
} from '../models/index.js';
import mongoose from 'mongoose';
import { getGridFSBucket } from '../gridfs.js';
import { DateTimeResolver } from 'graphql-scalars';
import { validateFile, checkStorageLimit, updateUserStorage } from '../utils/storage.js';
import { pagingQuery, makeResponse } from '../utils/graphqlHelper.js';
import { getBaseUrl } from '../utils/url.js';
import { addRefreshToken, validateUser } from '../utils/user.js';
import { AuthenticationError } from 'apollo-server';

const { ObjectId } = mongoose.Types;

const commonResolvers = {
  Date: DateTimeResolver,
  Upload: GraphQLUpload,

  Query: {
    // get User
    getUser: async (_, { id }) => {
      return await User.findById(id);
    },
    getUsers: async (_, { pageOptions = { sortField: 'username' }, }, { userId }) => {
      await validateUser(userId);
      return await pagingQuery(User, pageOptions);
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

    isVoted: async (_, { targetId }, { userId }) => {
      await validateUser(userId);

      const vote = await Vote.findOne({ userId, targetId });
      return makeResponse(null, vote != null, vote);
    },
  },

  Mutation: {
    // register user
    register: async (_, {
      username,
      email,
      password,
      phone,
      isBot = false,
      deviceInfo,
    },
      { SECRET_KEY, REFRESH_SECRET_KEY },
    ) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) throw new Error('Email already registered');

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        username,
        email,
        password: hashedPassword,
        phone,
        isBot,
      });
      // save to database
      const res = await user.save();
      // generate token here
      const accessToken = jwt.sign(
        { userId: res.id },
        SECRET_KEY,
        { expiresIn: '15min' },
      );
      const refreshToken = jwt.sign(
        { userId: res.id },
        REFRESH_SECRET_KEY,
        { expiresIn: '7d' }
      );

      await addRefreshToken(user, refreshToken, deviceInfo);
      return {
        accessToken,
        refreshToken,
        user: res,
      };
    },
    // user login
    login: async (_, { email, password, deviceInfo, },
      { SECRET_KEY, REFRESH_SECRET_KEY }) => {
      const user = await User.findOne({ email }).select('+password');
      if (!user) throw new Error('User not found');
      if (user.isBot) {
        console.warn(`Bot ${email} try to login`);
        throw new Error('Cannot login as robot');
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error('Incorrect password');

      // generate tokens
      const accessToken = jwt.sign(
        { userId: user.id },
        SECRET_KEY,
        { expiresIn: '15min' },
      );
      const refreshToken = jwt.sign(
        { userId: user.id },
        REFRESH_SECRET_KEY,
        { expiresIn: '7d' }
      );

      await addRefreshToken(user, refreshToken, deviceInfo);
      return {
        accessToken,
        refreshToken,
        user,
      };
    },
    refreshToken: async (_, { refreshToken, deviceInfo },
      { SECRET_KEY, REFRESH_SECRET_KEY }) => {
      let user;
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
        user = await User.findById(decoded.userId);
        if (!user) throw new Error();
      } catch (err) {
        console.log(err);
        throw new AuthenticationError('Invalid refresh token');
      }

      const tokenIndex = user.refreshTokens.findIndex(rt => rt.token === refreshToken);
      if (tokenIndex === -1) throw new AuthenticationError('Invalid refresh token');
      const token = user.refreshTokens[tokenIndex];
      if (token.expiresAt < new Date()) {
        throw new AuthenticationError('Refresh token expired');
      }

      // generate tokens
      const newAccessToken = jwt.sign(
        { userId: user.id },
        SECRET_KEY,
        { expiresIn: '15min' },
      );
      // const newRefreshToken = jwt.sign(
      //   { userId: user.id },
      //   REFRESH_SECRET_KEY,
      //   { expiresIn: '7d' }
      // );
      // await addRefreshToken(user, newRefreshToken, deviceInfo);
      return {
        accessToken: newAccessToken,
        refreshToken: refreshToken,
        user,
      };
    },
    logout: async (_, { refreshToken }, { REFRESH_SECRET_KEY }) => {
      let user;
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET_KEY);
        user = await User.findById(decoded.userId);
        if (!user) throw new Error();
      } catch {
        return makeResponse('Invalid refresh token');
      }
      // Remove the refresh token from the database
      user.refreshTokens = user.refreshTokens.filter(
        (rt) => rt.token !== refreshToken
      );
      await user.save();
      return makeResponse("Logged out", true);
    },

    updateUser: async (_, { input }, { userId }) => {
      const user = await validateUser(userId);

      const { username, avatarId, phone, charIds, faveCatIds, faveSubCatIds } = input;
      user.username = username || user.username;
      user.avatarId = avatarId || user.avatarId;
      user.phone = phone || user.phone;
      user.updatedAt = new Date();
      user.charIds = charIds || user.charIds;
      user.faveCatIds = faveCatIds || user.faveCatIds;
      user.faveSubCatIds = faveSubCatIds || user.faveSubCatIds;
      return await user.save();
    },

    vote: async (_, { targetId, targetType, voteType }, { userId }) => {
      await validateUser(userId);

      if (!['upvote', 'downvote', 'cancel'].includes(voteType)) {
        throw new Error('Invalid vote type');
      }
      let Model;
      switch (targetType) {
        case 'Question':
          Model = Question;
          break;
        case 'Answer':
          Model = Answer;
          break;
        case 'POI':
          Model = POI;
          break;
        case 'Comment':
          Model = Comment;
          break
        case 'Recommendation':
          Model = Recommendation;
          break
        default:
          throw new Error('Invalid target type');
      }
      const target = await Model.findById(targetId);
      if (!target) throw new Error(`${targetType} not found`);

      try {
        const existingVote = await Vote.findOne({ userId, targetId });

        if (existingVote) {
          if ('cancel' === voteType) {
            // remove the existing vote
            await Vote.deleteOne({ _id: existingVote._id });

            // adjust vote counts
            const increment =
              existingVote.voteType === 'upvote'
                ? { 'votes.upvotes': -1 }
                : { 'votes.downvotes': -1 };
            const updatedTarget = await Model.findByIdAndUpdate(
              targetId,
              { $inc: increment },
              { new: true }
            );

            return {
              success: true,
              message: 'Vote cancelled',
              voteCount: updatedTarget.votes,
            };
          } else if (existingVote.voteType === voteType) {
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
          if (voteType === 'cancel') {
            return {
              success: false,
              message: 'No existing vote to cancel',
              voteCount: target.votes,
            };
          }
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
        if (!ObjectId.isValid(imageId)) return makeResponse('Invalid image id');
        const bucket = getGridFSBucket();

        const fileId = new ObjectId(imageId);

        // Find the file
        const files = await bucket.find({ _id: fileId }).toArray();
        if (!files || files.length === 0) {
          return makeResponse('File not found');
        }

        const file = files[0];

        // Check ownership
        if (file.metadata.uploadedBy.toString() !== userId) {
          return makeResponse('You are not authorized to delete this image');
        }

        // Delete the file from GridFS
        await bucket.delete(fileId);

        updateUserStorage(user, -file.length);

        // Remove references to the image in User, Question, and Answer documents
        await User.updateMany(
          { avatarId: fileId },
          { $unset: { avatarId: '' } }
        );

        await Question.updateMany(
          { imageIds: fileId },
          { $pull: { imageIds: fileId } }
        );

        await Answer.updateMany(
          { imageIds: fileId },
          { $pull: { imageIds: fileId } }
        );
        return makeResponse('Image deleted', true);
      } catch (err) {
        console.error('Error deleting image:', err);
        throw new Error('Error deleting the image');
      }
    },

    createCharacter: async (_, { name, description }, { userId }) => {
      await validateUser(userId);
      const formattedName = name.trim();
      if (!formattedName) throw new Error("Invalid Character name");
      const slug = formattedName.toLowerCase().replace(/\s+/g, '-');

      const existingChar = await Character.findOne({ slug });
      if (existingChar) throw new Error('Character already exists');
      return await new Character({
        name: formattedName,
        slug,
        description,
      }).save();
    },
    updateCharacter: async (_, { id, name, description }, { userId }) => {
      await validateUser(userId);

      const char = await Character.findById(id);
      if (!char) throw new Error('Character not found');
      if (name) {
        char.name = name.trim();
        char.slug = char.name.toLowerCase().replace(/\s+/g, '-');
      }
      if (description) tag.description = description;
      return await char.save();
    },
    deleteCharacter: async (_, { id }, { userId }) => {
      await validateUser(userId);
      const char = await Character.findById(id);
      if (!char) return makeResponse('Character not found');

      await User.updateMany(
        { charIds: id },
        { $pull: { charIds: id } },
      );
      await Character.deleteOne({ _id: id });
      return makeResponse('Character deleted', true);
    },
  },

  Image: {
    id: (parent) => parent.id,
    filename: (parent) => parent.filename,
    contentType: (parent) => parent.contentType,
    length: (parent) => parent.length,
    uploadDate: (parent) => parent.uploadDate,
    url: (img, _, context) => `${getBaseUrl(context)}/images/${img.id}}`,
  },

  User: {
    avatar: async (parent, _, context) => {
      if (!parent.avatarId) return null;
      return `${getBaseUrl(context)}/images/${parent.avatarId}`;
    },
    characters: async (user) => await Character.find({ _id: { $in: user.charIds } }),
    faveCats: async (user) => await Category.find({ _id: { $in: user.faveCatIds } }),
    faveSubCats: async (user) => await Category.find({ _id: { $in: user.faveSubCatIds } }),
  },

  Vote: {
    user: async (vote) => {
      return await User.findById(vote.userId);
    },
  },

  Pageable: {
    __resolveType: (obj) => {
      const name = obj.constructor.modelName;
      return name.slice(name.lastIndexOf('.') + 1)
    },
  },
};

export default commonResolvers;
