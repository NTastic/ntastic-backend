import mongoose from 'mongoose';
import { Category, Recommendation, POI, Comment } from '../models/index.js';
import { makeResponse, pagingQuery, validateUser } from '../utils/graphqlHelper.js';
import { arraysEqual, nonEmptyArray } from '../utils/common.js';
const { ObjectId } = mongoose.Types;

const poiResolvers = {
  Query: {
    getCategories: async (_, { catIds }) => {
      const filterOptions = {};
      if (nonEmptyArray(catIds)) {
        filterOptions._id = { $in: catIds };
      }
      return await Category.find(filterOptions);
    },

    getRecommendations: async (_, { catIds, catMatch = 'ANY', pageOptions }) => {
      let filterOptions = {};
      if (nonEmptyArray(catIds)) {
        if (catMatch === 'ALL') {
          filterOptions.catIds = { $all: catIds };
        } else {
          filterOptions.catIds = { $in: catIds };
        }
      }
      return await pagingQuery(Recommendation, pageOptions, filterOptions);
    },

    getPOIs: async (_, { catIds, catMatch = 'ANY', pageOptions }) => {
      let filterOptions = {};
      if (nonEmptyArray(catIds)) {
        if (catMatch === 'ALL') {
          filterOptions.catIds = { $all: catIds };
        } else {
          filterOptions.catIds = { $in: catIds };
        }
      }
      return await pagingQuery(POI, pageOptions, filterOptions);
    },

    getComments: async (_, { poiId, pageOptions }) => {
      if (!poiId) throw new Error("poiId must be present");
      const filterOptions = { poiId: poiId };
      return await pagingQuery(Comment, pageOptions, filterOptions);
    },
  },
  Mutation: {
    createRecommendation: async (_, { input }, { userId }) => {
      await validateUser(userId);
      const { title, description, commentIds } = input;
      if (!nonEmptyArray(commentIds)) throw new Error('CommentIds mush be present');
      const comments = await Comment.find({ _id: { $in: commentIds } });
      const poiIds = comments.map((comment) => comment.poiId);
      const pois = await POI.find({ _id: { $in: poiIds } });
      const catIds = Array.from(new Set(pois.map((poi) => poi.catIds)));
      const recommendation = await Recommendation({
        title,
        description,
        catIds,
        list: comments.map((value) => ({ poiId: value.poiId, commentId: value._id })),
      }).save();

      return recommendation;
    },
    updateRecommendation: async (_, { id, input }, { userId }) => {
      await validateUser(userId);
      const recommendation = await Recommendation.findById(id);
      if (!recommendation) throw new Error('Recommendation not found');
      const { title, description, commentIds } = input;
      recommendation.title = title || recommendation.title;
      recommendation.description = description || recommendation.description;
      if (nonEmptyArray(commentIds)) {
        const oldCommentIds = recommendation.list.map((data) => data.commentId);
        if (!arraysEqual(oldCommentIds, commentIds)) {
          const comments = await Comment.find({ _id: { $in: commentIds } });
          const poiIds = comments.map((comment) => comment.poiId);
          const pois = await POI.find({ _id: { $in: poiIds } });
          const catIds = Array.from(new Set(pois.map((poi) => poi.catIds)));
          recommendation.catIds = catIds;
          recommendation.list = comments.map((value) => ({ poiId: value.poiId, commentId: value.id }));
        }
      }
      return await recommendation.save();
    },
    deleteRecommendation: async (_, { id }, { userId }) => {
      await validateUser(userId);
      const recommendation = await Recommendation.findById(id);
      if (!recommendation) return makeResponse('Recommendation not found');
      await Recommendation.deleteOne({ _id: id });
      return makeResponse('Recommendation deleted', true);
    },
    createCategory: async (_, { input }, { userId }) => {
      await validateUser(userId);
      const { name, description, parentCatId, subCatIds } = input;
      const formattedName = name.trim();
      if (!formattedName) throw new Error("Invalid Category name");
      const slug = formattedName.toLowerCase().replace(/\s+/g, '-');
      const existingCat = await Category.findOne({ slug });
      if (existingCat) throw new Error('Category already exists');
      let parentCat;
      if (parentCatId) {
        parentCat = await Category.findById(parentCatId);
        if (!parentCat) throw new Error(`Invalid parentCatId: ${parentCatId}`);
      }
      if (parentCatId && subCatIds && subCatIds.includes(parentCatId)) {
        throw new Error('subCatIds cannot contains parentCatId');
      }
      const cat = await new Category({
        name: formattedName,
        slug,
        description,
        parentCatId,
        subCatIds,
      }).save();
      if (parentCat) {
        parentCat.subCatIds = [...(parentCat.subCatIds || []), cat.id];
        parentCat.markModified('subCatIds');
        await parentCat.save()
      }

      if (nonEmptyArray(subCatIds)) {
        await Category.updateMany(
          { _id: { $in: subCatIds } },
          { $set: { parentCatId: cat.id } },
        );
      }
      return cat;
    },
    updateCategory: async (_, { id, input }, { userId }) => {
      await validateUser(userId);
      const cat = await Category.findById(id);
      if (!cat) throw new Error('Category not found');
      const { name, description, parentCatId, subCatIds } = input;
      if (cat.name !== name) {
        const formattedName = name.trim();
        if (!formattedName) throw new Error("Invalid Category name");
        const slug = formattedName.toLowerCase().replace(/\s+/g, '-');
        const existingCat = await Category.findOne({ slug });
        if (existingCat && existingCat.id !== cat.id) throw new Error('Category already exists');
        cat.name = name;
        cat.slug = slug;
      }
      if (parentCatId && subCatIds && subCatIds.includes(parentCatId)) {
        throw new Error('subCatIds cannot contains parentCatId');
      }
      let parentCat;
      let oldParentCat;
      if (parentCatId && parentCatId != cat.parentCatId.toString()) {
        parentCat = await Category.findById(parentCatId);
        if (!parentCat) throw new Error(`Invalid parentCatId: ${parentCatId}`);
        if (cat.parentCatId) oldParentCat = await Category.findById(cat.parentCatId);
      }
      cat.parentCatId = parentCatId;
      cat.description = description;

      if (parentCat) {
        parentCat.subCatIds = (parentCat.subCatIds || []).push(cat.id);
        parentCat.markModified('subCatIds');
        await parentCat.save()
      }
      if (oldParentCat && oldParentCat.subCatIds) {
        const index = oldParentCat.subCatIds.indexOf(cat.id);
        if (index !== -1) oldParentCat.subCatIds.splice(index, 1);
        oldParentCat.markModified('subCatIds');
        await oldParentCat.save();
      }

      if (subCatIds && !arraysEqual(subCatIds, cat.subCatIds)) {
        oldSubCats = cat.subCatIds || [];
        const removedCats = oldSubCats.filter(it => !subCatIds.includes(it));
        const addedCats = subCatIds.filter(it => !oldSubCats.includes(it));
        if (nonEmptyArray(removedCats)) {
          await Category.updateMany(
            { _id: { $in: removedCats } },
            { $pull: { parentCatId: cat.id } },
          );
        }
        if (nonEmptyArray(addedCats)) {
          await Category.updateMany(
            { _id: { $in: subCatIds } },
            { $set: { parentCatId: cat.id } },
          );
        }
        cat.markModified('subCatIds');
        cat.subCatIds = subCatIds;
      }
      return await cat.save();
    },
    deleteCategory: async (_, { id }, { userId }) => {
      await validateUser(userId);
      const cat = await Category.findById(id);
      if (!cat) return makeResponse('Category not found');
      await Category.updateMany(
        { parentCatId: id },
        { parentCatId: cat.parentCatId },
      );
      await Category.updateMany(
        { subCatIds: id },
        { $pull: { subCatIds: id } },
      );
      await Category.deleteOne({ _id: id });
      return makeResponse('Category deleted', true);
    },

    createPOI: async (_, { input }, { userId }) => {
      await validateUser(userId);
      const { name, phone, address, locationInput, catIds, photoUrls, workingHours, website } = input;
      if (!nonEmptyArray(catIds)) throw new Error('Invalid catIds');
      const cats = await Category.find({ _id: { $in: catIds } });
      if (cats.length < 1) throw new Error('Invalid catIds');
      let location;
      if (locationInput) {
        location = {
          type: 'Point',
          coordinates: [locationInput.latitude, locationInput.longitude],
        };
      }
      const poi = await new POI({
        name,
        phone,
        address,
        location,
        catIds,
        photoUrls,
        workingHours,
        website,
      }).save();

      await Category.updateMany(
        { _id: { $in: poi.catIds } },
        { $inc: { poiCount: 1 } },
      );
      return poi;
    },
    updatePOI: async (_, { id, input }, { userId }) => {
      await validateUser(userId);
      const poi = await POI.findById(id);
      if (!poi) throw new Error('POI not found');
      const { name, phone, address, locationInput, catIds, photoUrls, workingHours, website } = input;
      const cats = await Category.find({ _id: { $in: catIds } });
      if (cats.length < 1) throw new Error('Invalid catIds');
      if (name.trim()) poi.name = name.trim();
      if (phone) poi.phone = phone;
      if (address) poi.address = address;
      if (locationInput) {
        poi.location = {
          coordinates: [locationInput.latitude, locationInput.longitude],
        };
      }
      if (photoUrls) poi.photoUrls = photoUrls;
      if (workingHours) poi.workingHours = workingHours;
      if (website) poi.website = website;
      return await poi.save();
    },
    deletePOI: async (_, { id }, { userId }) => {
      await validateUser(userId);
      const poi = await POI.findById(id);
      if (!poi) return makeResponse('POI not found');
      await Comment.deleteMany({ poiId: poi._id });
      await Category.updateMany(
        { _id: { $in: poi.catIds } },
        { $inc: { poiCount: -1 } },
      );
      await POI.deleteOne({ _id: id });
      return makeResponse('POI deleted', true);
    },

    createComment: async (_, { input }, { userId }) => {
      await validateUser(userId);
      const { poiId, content, rating, imageUrls } = input;
      const poi = await POI.findById(poiId);
      if (!poi) throw new Error('POI not found');
      const comment = await new Comment({
        poiId,
        authorId: userId,
        content,
        rating,
        imageUrls,
      }).save();
      poi.rating = (poi.rating * poi.reviewsCount + rating) / (poi.reviewsCount + 1);
      poi.reviewsCount += 1;
      await poi.save();
      return comment;
    },
    updateComment: async (_, { id, input }, { userId }) => {
      await validateUser(userId);
      const comment = await Comment.findById(id);
      if (!comment) throw new Error('Comment not found');
      const { poiId, content, rating, imageUrls } = input;
      const poi = await POI.findById(poiId);
      if (!poi) throw new Error('POI not found');
      if (content) comment.content = content;
      if (rating) {
        const oldRating = comment.rating;
        poi.rating = (poi.rating * poi.reviewsCount - oldRating + rating) / poi.reviewsCount;
        await poi.save();
        comment.rating = rating;
      }

      if (imageUrls) comment.imageUrls = imageUrls;
      return await comment.save();
    },
    deleteComment: async (_, { id }, { userId }) => {
      await validateUser(userId);
      const comment = await Comment.findById(id);
      if (!comment) throw new Error('Comment not found');
      const poi = await POI.findById(comment.poiId);
      if (poi) {
        await POI.updateMany(
          { _id: comment.poiId },
          { $inc: { reviewsCount: -1 } },
        );
        poi.rating = poi.reviewsCount > 1
          ? (poi.rating * poi.reviewsCount - comment.rating) / (poi.reviewsCount - 1)
          : 0;
        poi.reviewsCount -= 1;
        await poi.save();
      }
      await Comment.deleteOne({ _id: id });
      return makeResponse('Comment deleted', true);
    },
  },
  Category: {
    parentCat: async (cat) => await Category.findById(cat.parentCatId),
    subCats: async (cat) => await Category.find({ parentCatId: cat.id }),
  },
  Recommendation: {
    list: async (parent) => {
      const ids = parent.list;
      return await Promise.all(
        parent.list.map(async data => {
          return {
            poi: await POI.findById(data.poiId),
            comment: await Comment.findById(data.commentId)
          };
        })
      );
    },
  },
  Comment: {
    poi: async (comment) => await POI.findById(comment.poiId),
  },
};

export default poiResolvers;