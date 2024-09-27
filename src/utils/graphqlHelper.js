import User from '../models/User.js';

export const validateUser = async (userId) => {
  if (!userId) throw new Error('Authentication required');

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  return user;
};

export const pagingQuery = async (model, page = 1, limit = 10, filterOptions = {}, sortOptions = {}, populate = []) => {
  const skip = (page - 1) * limit;
  const totalItems = await model.countDocuments(filterOptions);
  const totalPages = Math.ceil(totalItems / limit);

  const items = await model.find(filterOptions)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .populate(populate);

  return {
    items,
    totalItems,
    totalPages,
    currentPage: page,
  };
};