import { RetryHandler } from '../src/utils/retry';
import { RequestConfig, Response } from '../src/types';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    retryHandler = new RetryHandler({
      maxRetries: 3,
      retryDelay: 50,
      retryCondition: (error) => error.response?.status === 500
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
    jest.clearAllMocks();
  });

  describe('executeRequest', () => {
    it('should execute successful requests without retry', async () => {
      const response = await retryHandler.executeRequest(mockRequest, mockConfig);

      expect(response).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should retry failed requests up to maxRetries', async () => {
      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const response = await retryHandler.executeRequest(mockRequest, mockConfig);

      expect(response).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('should respect retry delay', async () => {
      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const startTime = Date.now();
      await retryHandler.executeRequest(mockRequest, mockConfig);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should not retry if condition is not met', async () => {
      const error = new Error('Client error');
      Object.assign(error, { response: { status: 400 } });
      
      mockRequest = jest.fn().mockRejectedValue(error);

      await expect(retryHandler.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Client error');
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should give up after maxRetries', async () => {
      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn().mockRejectedValue(error);

      await expect(retryHandler.executeRequest(mockRequest, mockConfig))
        .rejects.toThrow('Server error');
      expect(mockRequest).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it('should handle exponential backoff', async () => {
      retryHandler = new RetryHandler({
        maxRetries: 2,
        retryDelay: 50,
        exponentialBackoff: true
      });

      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const startTime = Date.now();
      await retryHandler.executeRequest(mockRequest, mockConfig);
      const endTime = Date.now();

      // First retry: 50ms, Second retry: 100ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(150);
    });
  });

  describe('retry conditions', () => {
    it('should retry on network errors', async () => {
      retryHandler = new RetryHandler({
        maxRetries: 1,
        retryDelay: 50,
        retryCondition: (error) => error.message === 'Network error'
      });

      mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      const response = await retryHandler.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      retryHandler = new RetryHandler({
        maxRetries: 1,
        retryDelay: 50,
        retryCondition: (error) => error.code === 'ECONNABORTED'
      });

      const timeoutError = new Error('Timeout');
      timeoutError.code = 'ECONNABORTED';

      mockRequest = jest.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(mockResponse);

      const response = await retryHandler.executeRequest(mockRequest, mockConfig);
      expect(response).toEqual(mockResponse);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry metadata', () => {
    it('should track retry count in metadata', async () => {
      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ...mockResponse,
          metadata: {}
        });

      const response = await retryHandler.executeRequest(mockRequest, mockConfig);
      expect(response.metadata?.retryCount).toBe(1);
    });

    it('should preserve existing metadata', async () => {
      const error = new Error('Server error');
      Object.assign(error, { response: { status: 500 } });
      
      mockRequest = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ...mockResponse,
          metadata: { existingKey: 'value' }
        });

      const response = await retryHandler.executeRequest(mockRequest, mockConfig);
      expect(response.metadata?.existingKey).toBe('value');
      expect(response.metadata?.retryCount).toBe(1);
    });
  });
}); 