import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";

import commonTypeDefs from './commonTypeDefs.js';
import commonResolvers from './commonResolvers.js';

import communityTypeDefs from './communityTypeDefs.js';
import communityResolvers from './communityResolvers.js'

import poiTypeDefs from './poiTypeDefs.js';
import poiResolvers from './poiResolvers.js';

const typeDefs = mergeTypeDefs([commonTypeDefs, communityTypeDefs, poiTypeDefs]);
const resolvers = mergeResolvers([commonResolvers, communityResolvers, poiResolvers]);

export { typeDefs, resolvers };