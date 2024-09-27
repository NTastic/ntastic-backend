import { gql } from 'apollo-server';

const typeDefs = gql`
  scalar Date
  scalar Upload

  type User {
    id: ID!
    username: String!
    email: String!
    avatar: String
    avatarImageId: ID
    createdAt: Date!
    updatedAt: Date
    questions: [Question]
    answers: [Answer]
  }

  type Tag {
    id: ID!
    name: String!
    slug: String!
    description: String
    synonyms: [String]
    parentTag: Tag
    createdAt: Date!
    updatedAt: Date
    questions: [Question]
  }

  type Question {
    id: ID!
    title: String!
    content: String!
    imageIds: [ID!]
    images: [String]
    author: User!
    tags: [Tag!]!
    createdAt: Date!
    updatedAt: Date
    votes: VoteCount!
    answers: [Answer]
  }

  type Answer {
    id: ID!
    content: String!
    imageIds: [ID!]
    images: [String]
    author: User!
    question: Question!
    createdAt: Date!
    updatedAt: Date
    votes: VoteCount!
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

  enum TagMatchType {
    ANY
    ALL
  }

  enum TargetType {
    Question
    Answer
  }

  enum VoteType {
    upvote
    downvote
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

  type QuestionPagination {
    items: [Question!]!
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type AnswerPagination {
    items: [Answer!]!
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
  }

  type Query {
    getUser(id: ID!): User
    getUsers: [User]

    getTag(id: ID!): Tag
    getTags: [Tag]
    searchTags(keyword: String!): [Tag]

    getQuestion(id: ID!): Question
    getQuestions(
      tagIds: [ID!]
      tagMatch: TagMatchType = ANY
      page: Int = 1
      limit: Int = 10
      sortOrder: SortOrder = DESC
    ): QuestionPagination!

    getAnswer(id: ID!): Answer
    getAnswers(
      questionId: ID!
      page: Int = 1
      limit: Int = 10
      sortOrder: SortOrder = ASC
    ): AnswerPagination!

    getImage(id: ID!): Image
    getUserImages: [Image!]!
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): AuthPayload
    login(email: String!, password: String!): AuthPayload

    updateUser(username: String, avatarImageId: ID): User

    createTag(
      name: String!,
      description: String,
      synonyms: [String],
      parentTagId: ID
    ): Tag

    updateTag(
      id: ID!,
      name: String,
      description: String,
      synonyms: [String],
      parentTagId: ID
    ): Tag

    mergeTags(
      sourceTagIds: [ID!]!,
      targetTagId: ID!
    ): MergeTagsResponse

    createQuestion(
      title: String!,
      content: String!,
      tagIds: [ID!]!,
      imageIds: [ID!]
    ): Question

    updateQuestion(
      id: ID!,
      title: String,
      content: String,
      tagIds: [ID!],
      imageIds: [ID!]
    ): Question

    createAnswer(
      questionId: ID!,
      content: String!,
      imageIds: [ID!]
    ): Answer

    updateAnswer(
      id: ID!,
      content: String,
      imageIds: [ID!]
    ): Answer

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

  type MergeTagsResponse {
    success: Boolean!
    message: String
    mergedTag: Tag
  }
`;

export default typeDefs;
