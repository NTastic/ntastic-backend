import { gql } from 'apollo-server';

const commonTypeDefs = gql`
  scalar Date
  scalar Upload

  type User {
    id: ID!
    username: String!
    email: String!
    avatar: String
    avatarImageId: ID
    isBot: Boolean!
    phone: String
    createdAt: Date!
    updatedAt: Date
  }

  type VoteCount {
    upvotes: Int!
    downvotes: Int!
  }
  
  type Image {
    id: ID!
    filename: String!
    contentType: String!
    length: Int!
    uploadDate: Date
    url: String!
  }

  enum SortOrder {
    ASC
    DESC
  }

  enum MatchType {
    ANY
    ALL
  }

  enum TargetType {
    Question
    Answer
    POI
    Comment
  }

  enum VoteType {
    upvote
    downvote
    cancel
  }

  type Vote {
    id: ID!
    user: User!
    targetId: ID!
    targetType: TargetType!,
    voteType: VoteType!
    createdAt: Date!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  union Pageable = User | Question | Answer | POI | Comment

  type Pagination {
    items: [Pageable!]!
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type Response {
    result: Boolean!
    message: String
  }

  input PageOptions {
    page: Int
    limit: Int
    sortField: String
    order: SortOrder
  }

  type Query {
    getUser(id: ID!): User
    getUsers(
      pageOptions: PageOptions = {
        page: 1
        limit: 10
        sortField: username
        order:ASC
      }
    ): Pagination!

    getImage(id: ID!): Image
    getUserImages: [Image!]!
  }

  type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      phone: String
      isBot: Boolean = false
    ): AuthPayload
    login(email: String!, password: String!): AuthPayload

    updateUser(username: String, avatarImageId: ID, phone: String): User

    vote(
      targetId: ID!,
      targetType: String!,
      voteType: String!
    ): VoteResponse

    uploadImage(file: Upload!): Image!

    deleteImage(imageId: ID!): Boolean!
  }

  type VoteResponse {
    success: Boolean!
    message: String
    voteCount: VoteCount
  }
`;

export default commonTypeDefs;
