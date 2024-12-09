import { BatchHandler } from '../src/utils/batch';
import { RequestConfig, Response } from '../src/types';

describe('BatchHandler', () => {
  let batchHandler: BatchHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    batchHandler = new BatchHandler({
      maxBatchSize: 3,
      batchDelay: 50
    });

    mockConfig = {
      url: '/test',
      method: 'GET'
    };

    mockResponse = {
      data: { id: 1, name: 'test' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: mockConfig,
      request: {}
    };

    mockRequest = jest.fn().mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    batchHandler.clear();
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should batch similar requests', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [
          { id: 1, name: 'test1' },
          { id: 2, name: 'test2' },
          { id: 3, name: 'test3' }
        ]
      });

      const promises = [
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/1' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/2' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/3' })
      ];

      const responses = await Promise.all(promises);

      expect(batchRequest).toHaveBeenCalledTimes(1);
      expect(responses).toHaveLength(3);
      expect(responses[0].data).toEqual({ id: 1, name: 'test1' });
      expect(responses[1].data).toEqual({ id: 2, name: 'test2' });
      expect(responses[2].data).toEqual({ id: 3, name: 'test3' });
    });

    it('should respect batch delay', async () => {
      const startTime = Date.now();

      await Promise.all([
        batchHandler.executeRequest(mockRequest, mockConfig),
        batchHandler.executeRequest(mockRequest, mockConfig)
      ]);

      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should respect max batch size', async () => {
      const batchRequest = jest.fn()
        .mockResolvedValueOnce({
          data: [{ id: 1 }, { id: 2 }, { id: 3 }]
        })
        .mockResolvedValueOnce({
          data: [{ id: 4 }, { id: 5 }]
        });

      const promises = Array(5).fill(null).map((_, i) =>
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: `/test/${i + 1}` })
      );

      await Promise.all(promises);

      expect(batchRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle request errors', async () => {
      const error = new Error('Batch request failed');
      mockRequest = jest.fn().mockRejectedValue(error);

      const promises = [
        batchHandler.executeRequest(mockRequest, mockConfig),
        batchHandler.executeRequest(mockRequest, mockConfig)
      ];

      await expect(Promise.all(promises)).rejects.toThrow('Batch request failed');
    });

    it('should handle partial batch failures', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [
          { id: 1, error: 'Failed' },
          { id: 2, name: 'success' }
        ]
      });

      const promises = [
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/1' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/2' })
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].data).toEqual({ id: 1, error: 'Failed' });
      expect(responses[1].data).toEqual({ id: 2, name: 'success' });
    });
  });

  describe('batch key generation', () => {
    it('should batch requests with same method and base URL', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }]
      });

      await Promise.all([
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/api/users/1' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/api/users/2' })
      ]);

      expect(batchRequest).toHaveBeenCalledTimes(1);
    });

    it('should not batch requests with different methods', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [{ id: 1 }]
      });

      await Promise.all([
        batchHandler.executeRequest(batchRequest, { ...mockConfig, method: 'GET' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, method: 'POST' })
      ]);

      expect(batchRequest).toHaveBeenCalledTimes(2);
    });

    it('should not batch requests with different base URLs', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [{ id: 1 }]
      });

      await Promise.all([
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/api/users' }),
        batchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/api/posts' })
      ]);

      expect(batchRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('request transformation', () => {
    it('should transform batch request parameters', async () => {
      const batchRequest = jest.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }]
      });

      await Promise.all([
        batchHandler.executeRequest(batchRequest, {
          ...mockConfig,
          params: { id: 1 }
        }),
        batchHandler.executeRequest(batchRequest, {
          ...mockConfig,
          params: { id: 2 }
        })
      ]);

      expect(batchRequest).toHaveBeenCalledWith(expect.objectContaining({
        params: { ids: ['1', '2'] }
      }));
    });

    it('should handle custom batch transformers', async () => {
      const customBatchHandler = new BatchHandler({
        maxBatchSize: 2,
        batchDelay: 50,
        transformRequest: (requests) => ({
          url: '/batch',
          method: 'POST',
          data: {
            requests: requests.map(r => ({
              path: r.url,
              method: r.method
            }))
          }
        })
      });

      const batchRequest = jest.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }]
      });

      await Promise.all([
        customBatchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/1' }),
        customBatchHandler.executeRequest(batchRequest, { ...mockConfig, url: '/test/2' })
      ]);

      expect(batchRequest).toHaveBeenCalledWith(expect.objectContaining({
        url: '/batch',
        method: 'POST',
        data: {
          requests: [
            { path: '/test/1', method: 'GET' },
            { path: '/test/2', method: 'GET' }
          ]
        }
      }));
    });
  });

  describe('clear', () => {
    it('should cancel pending batch requests', async () => {
      const promise1 = batchHandler.executeRequest(mockRequest, mockConfig);
      const promise2 = batchHandler.executeRequest(mockRequest, mockConfig);

      batchHandler.clear();

      await expect(promise1).rejects.toThrow('Batch handler cleared');
      await expect(promise2).rejects.toThrow('Batch handler cleared');
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });
}); 