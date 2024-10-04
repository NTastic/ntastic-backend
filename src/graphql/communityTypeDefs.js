import { gql } from 'apollo-server';

const communityTypeDefs = gql`
  type Tag {
    id: ID!
    name: String!
    questionCount: Int!
    slug: String!
    description: String
    synonyms: [String]
    parentTag: Tag
    createdAt: Date!
    updatedAt: Date
  }

  type Question {
    id: ID!
    title: String!
    content: String!
    imageIds: [ID!]
    images: [String]
    externalImageUrls: [String]
    author: User!
    tags: [Tag!]!
    createdAt: Date!
    updatedAt: Date
    votes: VoteCount!
    answers: Pagination!
  }

  type Answer {
    id: ID!
    content: String!
    imageIds: [ID!]
    images: [String]
    externalImageUrls: [String]
    author: User!
    question: Question!
    createdAt: Date!
    updatedAt: Date
    votes: VoteCount!
  }

  enum TagSortField {
    name
    questionCount
  }

  input TagSortInput {
    field: TagSortField!
    order: SortOrder!
  }

  enum TargetType {
    Question
    Answer
  }

  type Query {
    getTag(id: ID!): Tag
    getTags(
      sort: TagSortInput = { field: name, order: ASC }
    ): [Tag]
    searchTags(keyword: String!): [Tag]

    getQuestion(id: ID!): Question
    getQuestions(
      tagIds: [ID!]
      tagMatch: MatchType = ANY
      userId: ID
      pageOptions: PageOptions = {
        page: 1
        limit: 10
        order: DESC
      }
    ): Pagination!

    getAnswer(id: ID!): Answer
    getAnswers(
      questionId: ID
      userId: ID
      pageOptions: PageOptions = {
        page: 1
        limit: 10
        order: ASC
      }
    ): Pagination!
  }

  type Mutation {
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

    deleteTag(id: ID!): Boolean!

    createQuestion(
      title: String!,
      content: String!,
      tagIds: [ID!]!,
      imageIds: [ID!],
      externalImageUrls: [String!]
    ): Question

    updateQuestion(
      id: ID!,
      title: String,
      content: String,
      tagIds: [ID!],
      imageIds: [ID!],
      externalImageUrls: [String!]
    ): Question

    deleteQuestion(id: ID!): Response!

    createAnswer(
      questionId: ID!,
      content: String!,
      imageIds: [ID!],
      externalImageUrls: [String!]
    ): Answer

    updateAnswer(
      id: ID!,
      content: String,
      imageIds: [ID!],
      externalImageUrls: [String!]
    ): Answer

    deleteAnswer(id: ID!): Boolean!
  }

  type MergeTagsResponse {
    success: Boolean!
    message: String
    mergedTag: Tag
  }
`;

export default communityTypeDefs;
