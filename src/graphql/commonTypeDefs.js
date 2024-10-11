import { gql } from 'apollo-server';

const commonTypeDefs = gql`
  scalar Date
  scalar Upload
  scalar Object

  type User {
    id: ID!
    username: String!
    email: String!
    avatar: String
    avatarId: ID
    isBot: Boolean!
    phone: String
    characters: [Character!]
    faveCats: [Category!]
    faveSubCats: [Category!]
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
    Recommendation
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
    targetType: TargetType!
    voteType: VoteType!
    createdAt: Date!
  }

  type Character {
    id: ID!
    name: String!
    slug: String!
    description: String
    createdAt: Date!
    updatedAt: Date
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  union Pageable = User | Question | Answer | Recommendation | POI | Comment

  type Pagination {
    items: [Pageable!]!
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type Response {
    result: Boolean!
    message: String
    data: Object
  }

  input PageOptions {
    page: Int
    limit: Int
    sortField: String
    order: SortOrder
  }

  input UserInput {
    username: String
    avatarId: ID
    phone: String
    charIds: [ID!]
    faveCatIds: [ID!]
    faveSubCatIds: [ID!]
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

    isVoted(targetId: ID!): Response!

    getCharacters: [Character!]
  }

  type Mutation {
    register(
      username: String!
      email: String!
      password: String!
      phone: String
      isBot: Boolean = false
      deviceInfo: String = null
    ): AuthPayload
    login(
      email: String!
      password: String!
      deviceInfo: String = null
    ): AuthPayload
    refreshToken(
      refreshToken: String!
      deviceInfo: String = null
    ): AuthPayload!
    logout(refreshToken: String!): Response

    updateUser(input: UserInput): User

    vote(
      targetId: ID!,
      targetType: TargetType!,
      voteType: VoteType!
    ): VoteResponse

    uploadImage(file: Upload!): Image!
    deleteImage(imageId: ID!): Response!

    createCharacter(
      name: String!
      description: String
    ): Character
    updateCharacter(
      id: ID!
      name: String!
      description: String
    ): Character
    deleteCharacter(id: ID!): Response
  }

  type VoteResponse {
    success: Boolean!
    message: String
    voteCount: VoteCount
  }
`;

export default commonTypeDefs;
