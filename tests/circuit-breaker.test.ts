import { CircuitBreakerHandler } from '../src/utils/circuit-breaker';
import { RequestConfig, Response } from '../src/types';

describe('CircuitBreakerHandler', () => {
  let circuitBreaker: CircuitBreakerHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerHandler({
      failureThreshold: 2,
      resetTimeout: 100,
      requestTimeout: 50
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
    circuitBreaker.clear();
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should execute successful requests', async () => {
      const response = await circuitBreaker.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should handle request timeouts', async () => {
      mockRequest = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Request timeout');
    });

    it('should trip after reaching failure threshold', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Server error'));

      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Circuit breaker is OPEN');

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
      expect(stats.failures).toBe(2);
    });

    it('should reset after timeout', async () => {
      mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Server error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(mockResponse);

      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');

      await new Promise(resolve => setTimeout(resolve, 150));

      const response = await circuitBreaker.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(0);
    });

    it('should handle half-open state', async () => {
      mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Server error'))
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(mockResponse);

      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');

      await new Promise(resolve => setTimeout(resolve, 150));

      const response = await circuitBreaker.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
    });
  });

  describe('health check', () => {
    it('should perform health checks', async () => {
      const healthCheck = jest.fn().mockResolvedValue(true);
      circuitBreaker = new CircuitBreakerHandler({
        healthCheck,
        monitorInterval: 50
      });

      mockRequest = jest.fn().mockRejectedValue(new Error('Server error'));

      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      await expect(circuitBreaker.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(healthCheck).toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('should track request statistics', async () => {
      await circuitBreaker.executeRequest(mockRequest, mockConfig);
      await circuitBreaker.executeRequest(mockRequest, mockConfig);

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
    });

    it('should track failure statistics', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Server error'));

      try {
        await circuitBreaker.executeRequest(mockRequest, mockConfig);
      } catch {}

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(1);
      expect(stats.lastError).toBeInstanceOf(Error);
    });

    it('should calculate uptime and downtime', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Server error'));

      const startTime = Date.now();
      try {
        await circuitBreaker.executeRequest(mockRequest, mockConfig);
        await circuitBreaker.executeRequest(mockRequest, mockConfig);
      } catch {}

      const stats = circuitBreaker.getStats();
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.downtime).toBeGreaterThan(0);
      expect(stats.uptime + stats.downtime).toBeGreaterThanOrEqual(Date.now() - startTime);
    });
  });

  describe('clear', () => {
    it('should reset all state and statistics', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Server error'));

      try {
        await circuitBreaker.executeRequest(mockRequest, mockConfig);
      } catch {}

      circuitBreaker.clear();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.lastError).toBeNull();
    });
  });
}); 