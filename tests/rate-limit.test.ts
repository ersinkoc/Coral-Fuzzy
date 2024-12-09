import { RateLimitHandler } from '../src/utils/rate-limit';
import { RequestConfig, Response } from '../src/types';

describe('RateLimitHandler', () => {
  let rateLimiter: RateLimitHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    rateLimiter = new RateLimitHandler({
      maxRequests: 2,
      perMilliseconds: 100,
      maxConcurrent: 1
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
    rateLimiter.clear();
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should execute requests within rate limit', async () => {
      const response1 = await rateLimiter.executeRequest(mockRequest, mockConfig);
      const response2 = await rateLimiter.executeRequest(mockRequest, mockConfig);

      expect(response1).toEqual(mockResponse);
      expect(response2).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should queue requests when rate limit is exceeded', async () => {
      const startTime = Date.now();

      const promises = [
        rateLimiter.executeRequest(mockRequest, mockConfig),
        rateLimiter.executeRequest(mockRequest, mockConfig),
        rateLimiter.executeRequest(mockRequest, mockConfig)
      ];

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses).toHaveLength(3);
      expect(responses.every(r => r === mockResponse)).toBe(true);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should enforce concurrent request limit', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const startTime = Date.now();
      const promises = [
        rateLimiter.executeRequest(slowRequest, mockConfig),
        rateLimiter.executeRequest(slowRequest, mockConfig)
      ];

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      expect(responses).toHaveLength(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle request errors without affecting rate limit', async () => {
      mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Request failed'))
        .mockResolvedValue(mockResponse);

      await expect(rateLimiter.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Request failed');

      const response = await rateLimiter.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);
    });
  });

  describe('queue management', () => {
    it('should process queued requests in order', async () => {
      const order: number[] = [];
      const requests = [1, 2, 3].map(id => ({
        request: jest.fn().mockImplementation(async () => {
          order.push(id);
          return mockResponse;
        }),
        config: mockConfig
      }));

      await Promise.all(requests.map(({ request, config }) => 
        rateLimiter.executeRequest(request, config)
      ));

      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle queue cleanup on errors', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Request failed'));

      const promises = [
        rateLimiter.executeRequest(mockRequest, mockConfig),
        rateLimiter.executeRequest(mockRequest, mockConfig)
      ];

      await Promise.all(promises.map(p => p.catch(() => {})));

      const stats = rateLimiter.getStats();
      expect(stats.queuedRequests).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track request statistics', async () => {
      await rateLimiter.executeRequest(mockRequest, mockConfig);
      
      const stats = rateLimiter.getStats();
      expect(stats.activeRequests).toBe(0);
      expect(stats.queuedRequests).toBe(0);
      expect(stats.requestsInWindow).toBe(1);
    });

    it('should track concurrent requests', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise = rateLimiter.executeRequest(slowRequest, mockConfig);
      
      const stats = rateLimiter.getStats();
      expect(stats.activeRequests).toBe(1);

      await promise;
    });

    it('should track queued requests', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise1 = rateLimiter.executeRequest(slowRequest, mockConfig);
      const promise2 = rateLimiter.executeRequest(slowRequest, mockConfig);

      const stats = rateLimiter.getStats();
      expect(stats.queuedRequests).toBe(1);

      await Promise.all([promise1, promise2]);
    });
  });

  describe('clear', () => {
    it('should reset all state and reject queued requests', async () => {
      const slowRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResponse), 50)));
      
      const promise1 = rateLimiter.executeRequest(slowRequest, mockConfig);
      const promise2 = rateLimiter.executeRequest(slowRequest, mockConfig);

      rateLimiter.clear();

      await expect(promise2).rejects.toThrow('Rate limit handler cleared');
      await promise1.catch(() => {});

      const stats = rateLimiter.getStats();
      expect(stats.activeRequests).toBe(0);
      expect(stats.queuedRequests).toBe(0);
      expect(stats.requestsInWindow).toBe(0);
    });
  });
}); 