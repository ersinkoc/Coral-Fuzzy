import { RequestPool } from '../src/utils/request-pool';
import { RequestConfig, Response } from '../src/types';

describe('RequestPool', () => {
  let requestPool: RequestPool;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    requestPool = new RequestPool({
      maxConcurrent: 2,
      requestsPerSecond: 10
    });

    mockConfig = {
      url: '/test',
      method: 'GET'
    };

    mockResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: mockConfig,
      request: {}
    };

    mockRequest = jest.fn().mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    requestPool.clear();
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should execute requests within limits', async () => {
      const response1 = await requestPool.executeRequest(mockRequest, mockConfig);
      const response2 = await requestPool.executeRequest(mockRequest, mockConfig);

      expect(response1).toEqual(mockResponse);
      expect(response2).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should queue requests when concurrent limit is reached', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const startTime = Date.now();
      const promises = [
        requestPool.executeRequest(slowRequest, mockConfig),
        requestPool.executeRequest(slowRequest, mockConfig),
        requestPool.executeRequest(slowRequest, mockConfig)
      ];

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses).toHaveLength(3);
      expect(responses.every(r => r === mockResponse)).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should throttle requests per second', async () => {
      requestPool = new RequestPool({
        maxConcurrent: 10,
        requestsPerSecond: 10
      });

      const startTime = Date.now();
      const promises = Array(15).fill(null).map(() => 
        requestPool.executeRequest(mockRequest, mockConfig)
      );

      await Promise.all(promises);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(500); // At least 0.5s for 5 extra requests
    });

    it('should handle request errors', async () => {
      mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Request failed'))
        .mockResolvedValue(mockResponse);

      await expect(requestPool.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Request failed');

      const response = await requestPool.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);
    });
  });

  describe('priority handling', () => {
    it('should process high priority requests first', async () => {
      const order: string[] = [];
      const requests = [
        { priority: 1, id: 'low' },
        { priority: 3, id: 'high' },
        { priority: 2, id: 'medium' }
      ].map(({ priority, id }) => ({
        request: jest.fn().mockImplementation(async () => {
          order.push(id);
          return mockResponse;
        }),
        config: { ...mockConfig, priority }
      }));

      await Promise.all(requests.map(({ request, config }) => 
        requestPool.executeRequest(request, config)
      ));

      expect(order).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('queue management', () => {
    it('should maintain request order within same priority', async () => {
      const order: number[] = [];
      const requests = [1, 2, 3].map(id => ({
        request: jest.fn().mockImplementation(async () => {
          order.push(id);
          return mockResponse;
        }),
        config: mockConfig
      }));

      await Promise.all(requests.map(({ request, config }) => 
        requestPool.executeRequest(request, config)
      ));

      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle queue cleanup on errors', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Request failed'));

      const promises = [
        requestPool.executeRequest(mockRequest, mockConfig),
        requestPool.executeRequest(mockRequest, mockConfig)
      ];

      await Promise.all(promises.map(p => p.catch(() => {})));

      const stats = requestPool.getStats();
      expect(stats.queuedRequests).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track active requests', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise = requestPool.executeRequest(slowRequest, mockConfig);
      
      const stats = requestPool.getStats();
      expect(stats.activeRequests).toBe(1);

      await promise;
    });

    it('should track queued requests', async () => {
      requestPool = new RequestPool({ maxConcurrent: 1 });
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise1 = requestPool.executeRequest(slowRequest, mockConfig);
      const promise2 = requestPool.executeRequest(slowRequest, mockConfig);

      const stats = requestPool.getStats();
      expect(stats.queuedRequests).toBe(1);

      await Promise.all([promise1, promise2]);
    });

    it('should track requests in time window', async () => {
      await Promise.all([
        requestPool.executeRequest(mockRequest, mockConfig),
        requestPool.executeRequest(mockRequest, mockConfig)
      ]);

      const stats = requestPool.getStats();
      expect(stats.requestsInWindow).toBe(2);
    });
  });

  describe('clear', () => {
    it('should reset all state and reject queued requests', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise1 = requestPool.executeRequest(slowRequest, mockConfig);
      const promise2 = requestPool.executeRequest(slowRequest, mockConfig);

      requestPool.clear();

      await expect(promise2).rejects.toThrow('Request pool cleared');
      await promise1.catch(() => {});

      const stats = requestPool.getStats();
      expect(stats.activeRequests).toBe(0);
      expect(stats.queuedRequests).toBe(0);
      expect(stats.requestsInWindow).toBe(0);
    });
  });
}); 