import { CacheConfig, RequestConfig, Response, Method } from '../types';

interface CacheEntry<T = any> {
  data: Response<T>;
  timestamp: number;
  key: string;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
}

export class CacheHandler {
  private static readonly DEFAULT_MAX_AGE = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULT_MAX_SIZE = 100; // Maximum number of entries
  private static readonly DEFAULT_EXCLUDED_METHODS: Method[] = ['POST', 'PUT', 'DELETE', 'PATCH'];
  private static readonly DEFAULT_EXCLUDED_PATHS = ['/auth'];

  private cache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private config: Required<CacheConfig>;

  constructor(config: CacheConfig = {}) {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0
    };

    this.config = {
      enabled: config.enabled ?? true,
      maxAge: config.maxAge ?? CacheHandler.DEFAULT_MAX_AGE,
      storage: config.storage ?? 'memory',
      exclude: {
        methods: config.exclude?.methods ?? CacheHandler.DEFAULT_EXCLUDED_METHODS,
        paths: config.exclude?.paths ?? CacheHandler.DEFAULT_EXCLUDED_PATHS,
        query: config.exclude?.query ?? false
      },
      maxSize: config.maxSize ?? CacheHandler.DEFAULT_MAX_SIZE,
      validateCache: config.validateCache ?? this.defaultCacheValidator
    };

    this.initializeStorage();
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (!this.shouldCache(config)) {
      return request(config);
    }

    const cacheKey = this.generateCacheKey(config);
    const cachedResponse = this.getFromCache<T>(cacheKey);

    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true,
        headers: {
          ...cachedResponse.headers,
          'x-cache': 'HIT',
          'x-cache-age': String(Date.now() - this.getCacheEntryTimestamp(cacheKey))
        }
      };
    }

    const response = await request(config);
    if (this.isCacheable(response)) {
      await this.addToCache(cacheKey, response);
    }

    return {
      ...response,
      cached: false,
      headers: {
        ...response.headers,
        'x-cache': 'MISS'
      }
    };
  }

  private initializeStorage(): void {
    if (this.config.storage === 'localStorage' || this.config.storage === 'sessionStorage') {
      try {
        const storage = window[this.config.storage];
        const cacheData = storage.getItem('coral-fuzzy-cache');
        if (cacheData) {
          const parsedData = JSON.parse(cacheData);
          Object.entries(parsedData).forEach(([key, value]) => {
            this.cache.set(key, value as CacheEntry);
          });
        }
      } catch (error) {
        console.warn('Failed to initialize storage:', error);
      }
    }
  }

  private shouldCache(config: RequestConfig): boolean {
    if (!this.config.enabled || config.cache === false) {
      return false;
    }

    const method = (config.method?.toUpperCase() ?? 'GET') as Method;
    if (this.config.exclude?.methods?.includes(method)) {
      return false;
    }

    const url = config.url ?? '';
    if (this.config.exclude?.paths?.some(path => url.includes(path))) {
      return false;
    }

    if (this.config.exclude?.query && url.includes('?')) {
      return false;
    }

    return true;
  }

  private generateCacheKey(config: RequestConfig): string {
    const { method = 'GET', url = '', params, data } = config;
    const parts = [method.toUpperCase(), url];

    if (params) {
      parts.push(JSON.stringify(params));
    }

    if (data && typeof data === 'object') {
      parts.push(JSON.stringify(data));
    }

    return parts.join('|');
  }

  private getFromCache<T>(key: string): Response<T> | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.removeEntry(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  private async addToCache<T>(key: string, response: Response<T>): Promise<void> {
    const entry: CacheEntry<T> = {
      data: response,
      timestamp: Date.now(),
      key,
      size: this.calculateSize(response)
    };

    while (this.stats.entries >= this.config.maxSize) {
      this.removeLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    this.stats.entries++;
    this.stats.size += entry.size;

    if (this.config.storage !== 'memory') {
      await this.persistCache();
    }
  }

  private async persistCache(): Promise<void> {
    if (this.config.storage === 'localStorage' || this.config.storage === 'sessionStorage') {
      try {
        const storage = window[this.config.storage];
        const cacheData = Object.fromEntries(this.cache.entries());
        storage.setItem('coral-fuzzy-cache', JSON.stringify(cacheData));
      } catch (error) {
        console.warn('Failed to persist cache:', error);
      }
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.config.maxAge;
  }

  private removeLeastRecentlyUsed(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.removeEntry(oldestKey);
    }
  }

  private removeEntry(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.entries--;
      this.stats.size -= entry.size;
    }
  }

  private calculateSize(response: Response): number {
    try {
      return JSON.stringify(response).length;
    } catch {
      return 0;
    }
  }

  private getCacheEntryTimestamp(key: string): number {
    return this.cache.get(key)?.timestamp ?? 0;
  }

  private isCacheable(response: Response): boolean {
    return (
      response.status >= 200 &&
      response.status < 300 &&
      this.config.validateCache(response)
    );
  }

  private defaultCacheValidator(response: Response): boolean {
    const cacheControl = response.headers['cache-control'];
    if (cacheControl) {
      return !cacheControl.includes('no-store') && !cacheControl.includes('no-cache');
    }
    return true;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0
    };

    if (this.config.storage !== 'memory') {
      try {
        const storage = window[this.config.storage];
        storage.removeItem('coral-fuzzy-cache');
      } catch (error) {
        console.warn('Failed to clear storage:', error);
      }
    }
  }
}