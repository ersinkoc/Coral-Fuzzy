import { GraphQLHandler } from '../src/utils/graphql';
import { RequestConfig, Response } from '../src/types';

describe('GraphQLHandler', () => {
  let graphqlHandler: GraphQLHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    graphqlHandler = new GraphQLHandler({
      url: 'http://localhost:8080/graphql',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    mockConfig = {
      url: '/graphql',
      method: 'POST'
    };

    mockResponse = {
      data: {
        data: {
          user: { id: 1, name: 'Test User' }
        }
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: mockConfig,
      request: {}
    };

    mockRequest = jest.fn().mockResolvedValue(mockResponse);
  });

  describe('query', () => {
    it('should execute GraphQL queries', async () => {
      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
          }
        }
      `;

      const variables = { id: '1' };

      await graphqlHandler.query(mockRequest, query, variables);

      expect(mockRequest).toHaveBeenCalledWith({
        ...mockConfig,
        data: {
          query,
          variables
        }
      });
    });

    it('should handle query errors', async () => {
      const errorResponse = {
        ...mockResponse,
        data: {
          errors: [{
            message: 'User not found',
            path: ['user']
          }]
        }
      };

      mockRequest = jest.fn().mockResolvedValue(errorResponse);

      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
          }
        }
      `;

      await expect(graphqlHandler.query(mockRequest, query, { id: '999' }))
        .rejects.toThrow('GraphQL Error: User not found');
    });

    it('should handle network errors', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Network error'));

      const query = `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            name
          }
        }
      `;

      await expect(graphqlHandler.query(mockRequest, query, { id: '1' }))
        .rejects.toThrow('Network error');
    });
  });

  describe('mutation', () => {
    it('should execute GraphQL mutations', async () => {
      const mutation = `
        mutation UpdateUser($id: ID!, $name: String!) {
          updateUser(id: $id, name: $name) {
            id
            name
          }
        }
      `;

      const variables = { id: '1', name: 'Updated Name' };

      await graphqlHandler.mutation(mockRequest, mutation, variables);

      expect(mockRequest).toHaveBeenCalledWith({
        ...mockConfig,
        data: {
          query: mutation,
          variables
        }
      });
    });

    it('should handle mutation errors', async () => {
      const errorResponse = {
        ...mockResponse,
        data: {
          errors: [{
            message: 'Validation error',
            path: ['updateUser']
          }]
        }
      };

      mockRequest = jest.fn().mockResolvedValue(errorResponse);

      const mutation = `
        mutation UpdateUser($id: ID!, $name: String!) {
          updateUser(id: $id, name: $name) {
            id
            name
          }
        }
      `;

      await expect(graphqlHandler.mutation(mockRequest, mutation, { id: '1', name: '' }))
        .rejects.toThrow('GraphQL Error: Validation error');
    });
  });

  describe('batch', () => {
    it('should execute batch queries', async () => {
      const queries = [
        {
          query: `
            query GetUser($id: ID!) {
              user(id: $id) {
                id
                name
              }
            }
          `,
          variables: { id: '1' }
        },
        {
          query: `
            query GetPosts($userId: ID!) {
              posts(userId: $userId) {
                id
                title
              }
            }
          `,
          variables: { userId: '1' }
        }
      ];

      const batchResponse = {
        ...mockResponse,
        data: [
          { data: { user: { id: 1, name: 'Test User' } } },
          { data: { posts: [{ id: 1, title: 'Test Post' }] } }
        ]
      };

      mockRequest = jest.fn().mockResolvedValue(batchResponse);

      await graphqlHandler.batch(mockRequest, queries);

      expect(mockRequest).toHaveBeenCalledWith({
        ...mockConfig,
        data: queries.map(q => ({
          query: q.query,
          variables: q.variables
        }))
      });
    });

    it('should handle partial batch errors', async () => {
      const batchResponse = {
        ...mockResponse,
        data: [
          { data: { user: { id: 1, name: 'Test User' } } },
          { errors: [{ message: 'Posts not found' }] }
        ]
      };

      mockRequest = jest.fn().mockResolvedValue(batchResponse);

      const queries = [
        {
          query: 'query GetUser($id: ID!) { user(id: $id) { id name } }',
          variables: { id: '1' }
        },
        {
          query: 'query GetPosts($userId: ID!) { posts(userId: $userId) { id title } }',
          variables: { userId: '1' }
        }
      ];

      const results = await graphqlHandler.batch(mockRequest, queries);

      expect(results[0].data).toBeDefined();
      expect(results[1].errors).toBeDefined();
    });
  });

  describe('subscription', () => {
    let mockWebSocket: any;

    beforeEach(() => {
      mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        readyState: WebSocket.OPEN
      };

      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);
    });

    it('should establish subscription connection', async () => {
      const subscription = `
        subscription OnUserUpdate($id: ID!) {
          userUpdate(id: $id) {
            id
            name
          }
        }
      `;

      const variables = { id: '1' };

      const onNext = jest.fn();
      const onError = jest.fn();
      const onComplete = jest.fn();

      await graphqlHandler.subscribe(subscription, variables, {
        next: onNext,
        error: onError,
        complete: onComplete
      });

      expect(global.WebSocket).toHaveBeenCalled();
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'start',
        id: expect.any(String),
        payload: {
          query: subscription,
          variables
        }
      }));
    });

    it('should handle subscription messages', async () => {
      const onNext = jest.fn();
      const subscription = await graphqlHandler.subscribe(
        'subscription { userUpdate { id name } }',
        {},
        { next: onNext }
      );

      // Simulate message
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({
        data: JSON.stringify({
          type: 'data',
          id: subscription.id,
          payload: {
            data: {
              userUpdate: { id: 1, name: 'Updated Name' }
            }
          }
        })
      });

      expect(onNext).toHaveBeenCalledWith({
        userUpdate: { id: 1, name: 'Updated Name' }
      });
    });

    it('should handle subscription errors', async () => {
      const onError = jest.fn();
      const subscription = await graphqlHandler.subscribe(
        'subscription { userUpdate { id name } }',
        {},
        { error: onError }
      );

      // Simulate error
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({
        data: JSON.stringify({
          type: 'error',
          id: subscription.id,
          payload: {
            message: 'Subscription error'
          }
        })
      });

      expect(onError).toHaveBeenCalledWith(new Error('Subscription error'));
    });

    it('should handle subscription completion', async () => {
      const onComplete = jest.fn();
      const subscription = await graphqlHandler.subscribe(
        'subscription { userUpdate { id name } }',
        {},
        { complete: onComplete }
      );

      // Simulate complete
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({
        data: JSON.stringify({
          type: 'complete',
          id: subscription.id
        })
      });

      expect(onComplete).toHaveBeenCalled();
    });
  });
}); 