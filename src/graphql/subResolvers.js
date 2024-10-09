import mongoose from "mongoose";
import { pubsub } from "../utils/pubsub.js";

const { ObjectId } = mongoose.Types;

const subsriptionResolvers = {
  Subscription: {
    answerAdded: {
      subscribe: (_, { questionId }) => { 
        return pubsub.asyncIterator(`ANSWER_ADDED_${questionId}`);
      },
    },
    answerDeleted: {
      subscribe: (_, { questionId }) => { 
        return pubsub.asyncIterator(`ANSWER_DELETED_${questionId}`);
      },
    },
  }
};

export default subsriptionResolvers;
