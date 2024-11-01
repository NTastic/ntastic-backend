export const pagingQuery = async (model, pageOptions = {}, filterOptions = {}, populate = []) => {
  const { page = 1, limit = 10, sortOpts = [{ field: 'createdAt', order: 'ASC' }], } = pageOptions;
  const sortOptions = {};
  for (const sort of sortOpts) {
    sortOptions[sort.field] = sort.order === 'ASC' ? 1 : -1;
  }
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

export const makeResponse = (message = null, result = false, data = null) => {
  return {
    result: result,
    message: message,
    data: data,
  }
};