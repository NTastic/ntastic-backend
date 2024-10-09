import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";

import commonTypeDefs from './commonTypeDefs.js';
import commonResolvers from './commonResolvers.js';

import communityTypeDefs from './communityTypeDefs.js';
import communityResolvers from './communityResolvers.js'

import poiTypeDefs from './poiTypeDefs.js';
import poiResolvers from './poiResolvers.js';

import subTypeDefs from './subTypeDefs.js';
import subResolvers from './subResolvers.js';
import { makeExecutableSchema } from '@graphql-tools/schema';

const typeDefs = mergeTypeDefs([
    commonTypeDefs,
    communityTypeDefs,
    poiTypeDefs,
    subTypeDefs,
]);
const resolvers = mergeResolvers([
    commonResolvers,
    communityResolvers,
    poiResolvers,
    subResolvers,
]);
const schema = makeExecutableSchema({ typeDefs, resolvers, });

export default schema;