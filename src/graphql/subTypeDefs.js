import { gql } from 'apollo-server';

const subTypeDefs = gql`
  scalar Object
  type Subscription {
    answerAdded(questionId: ID!): Response!
    answerDeleted(questionId: ID!): Response!
  }
`;

export default subTypeDefs;
