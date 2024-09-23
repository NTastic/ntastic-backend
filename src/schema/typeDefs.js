const { gql } = require('apollo-server');
const { GraphQLDateTime } = require('graphql-scalars');

const typeDefs = gql`
  scalar Date

  type User {
    id: ID!
    username: String!
    email: String!
    createdAt: Date!
    updatedAt: Date!
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
    updatedAt: Date!
    questions: [Question]
  }

  type Question {
    id: ID!
    title: String!
    content: String!
    author: User!
    tags: [Tag!]!
    createdAt: Date!
    updatedAt: Date!
    votes: VoteCount!
    answers: [Answer]
  }

  type Answer {
    id: ID!
    content: String!
    author: User!
    question: Question!
    createdAt: Date!
    updatedAt: Date!
    votes: VoteCount!
  }

  type VoteCount {
    upvotes: Int!
    downvotes: Int!
  }

  type Vote {
    id: ID!
    user: User!
    targetId: ID!
    targetType: String!
    voteType: String!
    createdAt: Date!
  }

  type Query {
    getUser(id: ID!): User
    getUsers: [User]

    getTag(id: ID!): Tag
    getTags: [Tag]
    searchTags(keyword: String!): [Tag]
    getQuestionsByTag(tagId: ID!): [Question]

    getQuestion(id: ID!): Question
    getQuestions: [Question]

    getAnswer(id: ID!): Answer
    getAnswers(questionId: ID!): [Answer]
  }

  type Mutation {
    register(username: String!, email: String!, password: String!): User
    login(email: String!, password: String!): String # JWT token

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
      tagIds: [ID!]!
    ): Question

    addTagsToQuestion(
      questionId: ID!,
      tagIds: [ID!]!
    ): Question

    createAnswer(
      questionId: ID!,
      content: String!
    ): Answer

    vote(
      targetId: ID!,
      targetType: String!,
      voteType: String!
    ): VoteResponse
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

module.exports = typeDefs;
