import { CacheConfig, RequestConfig, Response, Method } from '../types/index';

interface CacheEntry {
  timestamp: number;
  response: Response<any>;
}

export class CacheHandler {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.config = {
      maxAge: config.maxAge ?? 5 * 60 * 1000, // 5 dakika
      exclude: {
        query: config.exclude?.query ?? false,
        paths: config.exclude?.paths ?? [],
        methods: config.exclude?.methods ?? ['POST', 'PUT', 'PATCH', 'DELETE']
      },
      storage: config.storage ?? 'memory'
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (!this.isCacheable(config)) {
      return request(config);
    }

    const cacheKey = this.getCacheKey(config);
    const cachedEntry = this.cache.get(cacheKey);

    if (cachedEntry && !this.isExpired(cachedEntry)) {
      return {
        ...cachedEntry.response,
        cached: true
      };
    }

    try {
      const response = await request(config);
      if (this.isSuccessResponse(response)) {
        this.cache.set(cacheKey, {
          timestamp: Date.now(),
          response
        });
      }
      return response;
    } catch (error) {
      this.cache.delete(cacheKey);
      throw error;
    }
  }

  private isCacheable(config: RequestConfig): boolean {
    const method = (config.method || 'GET').toUpperCase() as Method;
    const url = config.url || '';

    // Method check
    if (this.config.exclude.methods?.includes(method)) {
      return false;
    }

    // Path check
    if (this.config.exclude.paths?.some(path => url.includes(path))) {
      return false;
    }

    // Query parameter check
    if (this.config.exclude.query && url.includes('?')) {
      return false;
    }

    return true;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.maxAge;
  }

  private isSuccessResponse(response: Response<any>): boolean {
    return response.status >= 200 && response.status < 300;
  }

  private getCacheKey(config: RequestConfig): string {
    const { url, method, params, data } = config;
    return JSON.stringify({
      url,
      method: method || 'GET',
      params: params || {},
      data: data || null
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(config: RequestConfig): void {
    const cacheKey = this.getCacheKey(config);
    this.cache.delete(cacheKey);
  }
} 