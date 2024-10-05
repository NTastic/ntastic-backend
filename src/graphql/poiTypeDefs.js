import { gql } from 'apollo-server';

const poiTypeDefs = gql`
  type Category {
    id: ID!
    name: String!
    slug: String!
    description: String
    parentCat: Category
    subCats: [Category]
    poiCount: Int!
    createdAt: Date!
    updatedAt: Date
  }

  type Comment {
    id: ID!
    poi: POI!
    author: User!
    content: String!
    rating: Float!
    imageUrls: [String!]
    createdAt: Date!
    updatedAt: Date
  }

  type POI {
    id: ID!
    name: String!
    phone: String
    address: String
    location: Location
    catIds: [ID!]!
    rating: Float!
    reviewsCount: Int!
    photoUrls: [String!]
    workingHours: [WorkingHour]
    website: String
    comments: Pagination!
    createdAt: Date!
    updatedAt: Date
  }

  type RecommendPOI {
    poi: POI
    comment: Comment
  }
  type Recommendation {
    id: ID!
    title: String!
    description: String
    catIds: [ID!]
    list: [RecommendPOI!]
  }

  type Location {
    type: String!
    coordinates: [Float!]
  }

  type WorkingHour {
    day: String!
    open: String
    close: String
  }

  input CategoryInput {
    name: String
    description: String
    parentCatId: ID
    subCatIds: [ID!]
  }

  input LocationInput {
    latitude: Float!
    longitude: Float!
  }

  input WorkingHourInput {
    day: String
    open: String
    close: String
  }

  input RecommendationInput {
    title: String!
    description: String
    commentIds: [ID!]
  }

  input POIInput {
    name: String
    phone: String
    address: String
    locationInput: LocationInput
    catIds: [ID!]
    photoUrls: [String!]
    workingHours: [WorkingHourInput]
    website: String
  }

  input CommentInput {
    poiId: ID!
    content: String!
    rating: Float!
    imageUrls: [String!]
  }

  type Query {
    getCategories(catIds: [ID!] = null): [Category!]
    getRecommendations(
      catIds: [ID!]
      catMatch: MatchType = ANY
      pageOptions:PageOptions
    ): Pagination!

    getPOIs(
      catIds: [ID!]
      catMatch: MatchType = ANY
      pageOptions: PageOptions
    ): Pagination!
    getComments(
      poiId: ID!
      pageOptions: PageOptions
    ): Pagination!
  }

  type Mutation {
    createRecommendation(
      input: RecommendationInput
    ): Recommendation
    updateRecommendation(
      id: ID!
      input: RecommendationInput
    ): Recommendation
    deleteRecommendation(id: ID!): Response

    createCategory(input: CategoryInput): Category
    updateCategory(id: ID!, input: CategoryInput): Category
    deleteCategory(id: ID!): Response

    createPOI(input: POIInput): POI
    updatePOI(id: ID!, input: POIInput): POI
    deletePOI(id: ID!): Response

    createComment(input: CommentInput): Comment
    updateComment(id: ID!, input: CommentInput): Comment
    deleteComment(id: ID!): Response
  }
`;

export default poiTypeDefs;