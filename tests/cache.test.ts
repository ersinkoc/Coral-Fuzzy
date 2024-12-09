import { CacheHandler } from '../src/utils/cache';
import { Response, RequestConfig, Method } from '../src/types';

describe('CacheHandler', () => {
  let cacheHandler: CacheHandler;
  let mockRequest: jest.Mock;
  let mockResponse: Response;
  let mockConfig: RequestConfig;

  beforeEach(() => {
    cacheHandler = new CacheHandler();
    mockResponse = {
      data: { id: 1, name: 'test' },
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config: {},
      request: {}
    };
    mockRequest = jest.fn().mockResolvedValue(mockResponse);
    mockConfig = {
      url: '/test',
      method: Method.GET
    };
  });

  afterEach(() => {
    cacheHandler.clear();
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should cache successful GET requests', async () => {
      const response1 = await cacheHandler.execute(mockRequest, mockConfig);
      const response2 = await cacheHandler.execute(mockRequest, mockConfig);

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(true);
      expect(response2.data).toEqual(mockResponse.data);
    });

    it('should not cache excluded methods', async () => {
      const postConfig = { ...mockConfig, method: Method.POST };
      const response1 = await cacheHandler.execute(mockRequest, postConfig);
      const response2 = await cacheHandler.execute(mockRequest, postConfig);

      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(false);
    });

    it('should not cache excluded paths', async () => {
      const authConfig = { ...mockConfig, url: '/auth/login' };
      const response1 = await cacheHandler.execute(mockRequest, authConfig);
      const response2 = await cacheHandler.execute(mockRequest, authConfig);

      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(false);
    });

    it('should respect maxAge configuration', async () => {
      cacheHandler = new CacheHandler({ maxAge: 100 }); // 100ms cache duration
      
      const response1 = await cacheHandler.execute(mockRequest, mockConfig);
      await new Promise(resolve => setTimeout(resolve, 150));
      const response2 = await cacheHandler.execute(mockRequest, mockConfig);

      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(false);
    });

    it('should respect maxSize configuration', async () => {
      cacheHandler = new CacheHandler({ maxSize: 2 });

      await cacheHandler.execute(mockRequest, { ...mockConfig, url: '/test1' });
      await cacheHandler.execute(mockRequest, { ...mockConfig, url: '/test2' });
      await cacheHandler.execute(mockRequest, { ...mockConfig, url: '/test3' });

      const stats = cacheHandler.getStats();
      expect(stats.entries).toBe(2);
    });

    it('should handle cache validation', async () => {
      const validateCache = jest.fn().mockReturnValue(false);
      cacheHandler = new CacheHandler({ validateCache });

      const response1 = await cacheHandler.execute(mockRequest, mockConfig);
      const response2 = await cacheHandler.execute(mockRequest, mockConfig);

      expect(validateCache).toHaveBeenCalledWith(response1);
      expect(mockRequest).toHaveBeenCalledTimes(2);
      expect(response1.cached).toBe(false);
      expect(response2.cached).toBe(false);
    });
  });

  describe('storage', () => {
    beforeEach(() => {
      // Mock localStorage
      const store: Record<string, string> = {};
      global.localStorage = {
        getItem: jest.fn((key) => store[key]),
        setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: jest.fn((key) => delete store[key]),
        clear: jest.fn(() => Object.keys(store).forEach(key => delete store[key])),
        key: jest.fn((i) => Object.keys(store)[i]),
        length: 0
      };
    });

    it('should persist cache to localStorage', async () => {
      cacheHandler = new CacheHandler({ storage: 'localStorage' });

      await cacheHandler.execute(mockRequest, mockConfig);

      expect(localStorage.setItem).toHaveBeenCalled();
      expect(localStorage.getItem).toHaveBeenCalledWith('coral-fuzzy-cache');
    });

    it('should load cache from localStorage on initialization', async () => {
      // First, store something in cache
      cacheHandler = new CacheHandler({ storage: 'localStorage' });
      await cacheHandler.execute(mockRequest, mockConfig);

      // Create new instance - should load from localStorage
      const newCacheHandler = new CacheHandler({ storage: 'localStorage' });
      const response = await newCacheHandler.execute(mockRequest, mockConfig);

      expect(response.cached).toBe(true);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('should clear localStorage when cache is cleared', async () => {
      cacheHandler = new CacheHandler({ storage: 'localStorage' });
      await cacheHandler.execute(mockRequest, mockConfig);

      cacheHandler.clear();

      expect(localStorage.removeItem).toHaveBeenCalledWith('coral-fuzzy-cache');
    });
  });

  describe('stats', () => {
    it('should track cache hits and misses', async () => {
      await cacheHandler.execute(mockRequest, mockConfig);
      await cacheHandler.execute(mockRequest, mockConfig);
      await cacheHandler.execute(mockRequest, { ...mockConfig, url: '/test2' });

      const stats = cacheHandler.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });

    it('should track cache size', async () => {
      await cacheHandler.execute(mockRequest, mockConfig);
      const stats = cacheHandler.getStats();
      
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.entries).toBe(1);
    });

    it('should reset stats when cleared', async () => {
      await cacheHandler.execute(mockRequest, mockConfig);
      cacheHandler.clear();

      const stats = cacheHandler.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.entries).toBe(0);
    });
  });
});