import { gql } from 'apollo-server';

const poiTypeDefs = gql`
  type Category {
    id: ID!
    name: String!
    slug: String!
    description: String
    parentCat: Category
    subCat: [Category!]
    poiCount: Int!
    createdAt: Date!
    updatedAt: Date
  }

  type Comment {
    id: ID!
    poi: POI!
    author: User!,
    content: String!
    rating: Float!
    createdAt: Date!
    updatedAt: Date
  }

  type POI {
    id: ID!
    name: String!
    phone: String
    address: String
    location: Location
    categoryIds: [ID!]!
    rating: Float!
    reviewsCount: Int!
    photoUrls: [String!]
    workingHours: [WorkingHour]
    website: String
    comments: Pagination!
    createdAt: Date!
    updatedAt: Date
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

  input POIInput {
    name: String
    phone: String
    address: String
    location: LocationInput
    categoryIds: [ID!]
    photoUrls: [String!]
    workingHours: [WorkingHourInput]
    website: String
  }

  input CommentInput {
    poiId: ID!
    content: String!
    rating: Float!
  }

  type Query {
    getCategories(parentCatId: ID = null): Category
    getPOIs(
      categoryIds: [ID!]
      catMatch: MatchType = ANY
      pageOptions: PageOptions
    ): Pagination!
    getComments(poiId: ID!, pageOptions: PageOptions): Pagination!
  }

  type Mutation {
    createCategory(input: CategoryInput): Category
    updateCategory(input: CategoryInput): Category
    deleteCategory(id: ID!): Response

    createPOI(input: POIInput): POI
    updatePOI(input: POIInput): POI
    deletePOI(id: ID!): Response

    createComment(input: CommentInput): Comment
    updateComment(input: CommentInput): Comment
    deleteComment(id: ID!): Response
  }
`;

export default poiTypeDefs;