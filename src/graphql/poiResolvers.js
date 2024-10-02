import mongoose from 'mongoose';
import { Category, POI } from '../models/index.js';
import { pagingQuery } from '../utils/graphqlHelper.js';
const { ObjectId } = mongoose.Types;

const poiResolvers = {
  Query: {
    getCategories: async (_, { parentCatId }) => {
      filterOption = {};
      if (parentCatId) filterOption.parentCatId = parentCatId;
      return await Category.find(filterOption);
    },

    getPOIs: async (_, { categoryIds, catMatch = 'ANY', pageOptions }) => {
      let filterOptions = {};
      if (categoryIds && categoryIds.length > 0) {
        if (catMatch === 'ALL') {
          filterOptions.categoryIds = { $all: categoryIds };
        } else {
            filterOptions.categoryIds = { $in: categoryIds };
        }
      }
      return await pagingQuery(POI, pageOptions, filterOptions);
    },
  },
  Mutation: {},
};

export default poiResolvers;