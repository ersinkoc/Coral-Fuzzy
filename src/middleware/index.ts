import { RequestConfig, Response } from '../types';
import { CoralFuzzyError } from '../errors';

export interface Middleware {
  name: string;
  pre?: (config: RequestConfig) => Promise<RequestConfig>;
  post?: (response: Response<any>) => Promise<Response<any>>;
  error?: (error: any) => Promise<any>;
}

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    if (!middleware.name) {
      throw new Error('Middleware must have a name');
    }
    this.middlewares.push(middleware);
  }

  remove(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.name !== name);
  }

  clear(): void {
    this.middlewares = [];
  }

  async execute<T>(
    config: RequestConfig,
    request: (config: RequestConfig) => Promise<Response<T>>
  ): Promise<Response<T>> {
    let currentConfig = { ...config };

    try {
      // Execute pre-request middlewares
      for (const middleware of this.middlewares) {
        if (middleware.pre) {
          currentConfig = await middleware.pre(currentConfig);
        }
      }

      // Execute request
      let response = await request(currentConfig);

      // Execute post-request middlewares in reverse order
      for (const middleware of [...this.middlewares].reverse()) {
        if (middleware.post) {
          response = await middleware.post(response);
        }
      }

      return response;
    } catch (error) {
      // Execute error middlewares in reverse order
      let currentError = error;

      for (const middleware of [...this.middlewares].reverse()) {
        if (middleware.error) {
          try {
            currentError = await middleware.error(currentError);
          } catch (e) {
            currentError = e;
          }
        }
      }

      throw currentError;
    }
  }

  getMiddlewares(): Middleware[] {
    return [...this.middlewares];
  }
}

// Common middleware implementations
export const loggingMiddleware: Middleware = {
  name: 'logging',
  pre: async (config) => {
    console.group(`Request: ${config.method} ${config.url}`);
    console.log('Config:', config);
    console.groupEnd();
    return config;
  },
  post: async (response) => {
    console.group(`Response: ${response.status}`);
    console.log('Data:', response.data);
    console.groupEnd();
    return response;
  },
  error: async (error) => {
    console.group('Error');
    console.error(error);
    console.groupEnd();
    throw error;
  }
};

export const timingMiddleware: Middleware = {
  name: 'timing',
  pre: async (config) => {
    config.metadata = {
      ...config.metadata,
      startTime: performance.now()
    };
    return config;
  },
  post: async (response) => {
    const startTime = response.config.metadata?.startTime;
    if (startTime) {
      const duration = performance.now() - startTime;
      response.metadata = {
        ...response.metadata,
        duration
      };
    }
    return response;
  }
};

export const authMiddleware = (getToken: () => Promise<string>): Middleware => ({
  name: 'auth',
  pre: async (config) => {
    if (!config.headers) {
      config.headers = {};
    }
    const token = await getToken();
    config.headers['Authorization'] = `Bearer ${token}`;
    return config;
  },
  error: async (error) => {
    if (error instanceof CoralFuzzyError && error.response?.status === 401) {
      // Handle token refresh or logout logic here
    }
    throw error;
  }
});

export const retryMiddleware = (
  maxRetries: number = 3,
  retryDelay: number = 1000
): Middleware => ({
  name: 'retry',
  error: async (error) => {
    const config = error.config;
    if (!config) throw error;

    config.metadata = config.metadata || {};
    const retryCount = config.metadata.retryCount || 0;

    if (retryCount >= maxRetries) {
      throw error;
    }

    config.metadata.retryCount = retryCount + 1;
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    throw error; // Let the middleware chain handle the retry
  }
});

export const cacheMiddleware = (
  storage: Storage = localStorage,
  ttl: number = 5 * 60 * 1000
): Middleware => ({
  name: 'cache',
  pre: async (config) => {
    if (config.method !== 'GET') return config;

    const cacheKey = `cache:${config.url}`;
    const cached = storage.getItem(cacheKey);

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ttl) {
        throw { 
          cached: true,
          data,
          config,
          status: 200,
          statusText: 'OK',
          headers: {}
        };
      }
    }

    return config;
  },
  post: async (response) => {
    if (response.config.method === 'GET' && response.status === 200) {
      const cacheKey = `cache:${response.config.url}`;
      storage.setItem(cacheKey, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));
    }
    return response;
  }
}); 