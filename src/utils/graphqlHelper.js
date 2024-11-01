import mongoose from 'mongoose';

export const pagingQuery = async (model, pageOptions = {}, filterOptions = {}, populate = []) => {
  const {
    page = 1,
    limit = 10,
    sortOpts = [{ field: 'createdAt', order: 'ASC' }],
  } = pageOptions;

  const skip = (page - 1) * limit;

  // Build sort options for the aggregation pipeline
  const sortOptions = {};
  for (const sort of sortOpts) {
    sortOptions[sort.field] = sort.order === 'ASC' ? 1 : -1;
  }

  // Build the aggregation pipeline
  const pipeline = [];

  // If using geospatial sorting, include $geoNear as the first stage
  if (filterOptions.$geoNear) {
    pipeline.push(filterOptions.$geoNear);
    delete filterOptions.$geoNear; // Remove $geoNear from filterOptions
  }

  // Apply filters using $match
  if (Object.keys(filterOptions).length > 0) {
    pipeline.push({ $match: filterOptions });
  }

  // Apply sorting
  if (Object.keys(sortOptions).length > 0) {
    pipeline.push({ $sort: sortOptions });
  }

  // Apply pagination
  pipeline.push(
    { $skip: skip },
    { $limit: limit }
  );

  // Handle population using $lookup
  for (const pop of populate) {
    pipeline.push({
      $lookup: {
        from: pop.model,
        localField: pop.localField,
        foreignField: pop.foreignField,
        as: pop.as,
      },
    });
  }

  // Execute the aggregation pipeline
  const items = await model.aggregate(pipeline);
  const hydratedItems = items.map(doc => model.hydrate(doc));

  // Get total items count (requires a separate aggregation without $skip and $limit)
  const countPipeline = [...pipeline];
  // Remove $skip and $limit stages
  countPipeline.splice(
    countPipeline.findIndex(stage => stage.$skip !== undefined),
    2
  );

  countPipeline.push({ $count: 'totalItems' });
  const countResult = await model.aggregate(countPipeline);
  const totalItems = countResult[0] ? countResult[0].totalItems : 0;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    items: hydratedItems,
    totalItems,
    totalPages,
    currentPage: page,
  };
  // const { page = 1, limit = 10, sortOpts = [{ field: 'createdAt', order: 'ASC' }], } = pageOptions;
  // const sortOptions = {};
  // for (const sort of sortOpts) {
  //   sortOptions[sort.field] = sort.order === 'ASC' ? 1 : -1;
  // }
  // const skip = (page - 1) * limit;
  // const totalItems = await model.countDocuments(filterOptions);
  // const totalPages = Math.ceil(totalItems / limit);

  // const items = await model.find(filterOptions)
  //   .sort(sortOptions)
  //   .skip(skip)
  //   .limit(limit)
  //   .populate(populate);

  // return {
  //   items,
  //   totalItems,
  //   totalPages,
  //   currentPage: page,
  // };
};

export const makeResponse = (message = null, result = false, data = null) => {
  return {
    result: result,
    message: message,
    data: data,
  }
};

export const mapIds = (ids) => {
  if (!Array.isArray(ids)) return new mongoose.Types.ObjectId(ids);
  return ids
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));
}