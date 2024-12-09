# API Reference

Complete API reference for Coral Fuzzy.

## Core

### CoralFuzzy Class

```typescript
class CoralFuzzy {
  constructor(config?: CoralFuzzyConfig);
  
  // HTTP Methods
  request<T = any>(config: RequestConfig): Promise<Response<T>>;
  get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  head<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  options<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  
  // Configuration
  setConfig(config: Partial<CoralFuzzyConfig>): void;
  getConfig(): CoralFuzzyConfig;
  
  // Middleware
  use(middleware: Middleware): void;
  
  // Plugins
  usePlugin(plugin: Plugin): Promise<void>;
  
  // Features
  getFeatures(): BrowserFeatures;
  
  // Stats
  getStats(): CoralStats;
}
```

## Types

### RequestConfig

```typescript
interface RequestConfig {
  url?: string;
  method?: Method;
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  signal?: AbortSignal;
  
  // Features
  cache?: boolean | CacheConfig;
  retry?: boolean | RetryConfig;
  rateLimit?: boolean | RateLimitConfig;
  batch?: boolean | BatchConfig;
}
```

### Response

```typescript
interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  request: any;
  cached?: boolean;
}
```

### Error Types

```typescript
class CoralError extends Error {
  config?: RequestConfig;
  response?: Response<any>;
  status?: number;
  code?: string;
}

class NetworkError extends CoralError {}
class TimeoutError extends CoralError {}
class ValidationError extends CoralError {}
```

## Features

### Cache

```typescript
interface CacheConfig {
  enabled?: boolean;
  storage?: 'memory' | 'localStorage' | 'sessionStorage';
  maxAge?: number;
  maxSize?: number;
  exclude?: {
    methods?: Method[];
    paths?: string[];
    query?: boolean;
  };
  validateCache?: (response: Response) => boolean;
}
```

### Retry

```typescript
interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
}
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  maxRequests?: number;
  perMilliseconds?: number;
  maxConcurrent?: number;
}
```

### Batch Processing

```typescript
interface BatchConfig {
  maxBatchSize?: number;
  batchDelay?: number;
}
```

## Middleware

### Middleware Interface

```typescript
interface Middleware {
  name: string;
  pre?: (config: RequestConfig) => Promise<RequestConfig>;
  post?: (response: Response<any>) => Promise<Response<any>>;
  error?: (error: CoralError) => Promise<CoralError>;
}
```

## Plugins

### Plugin Interface

```typescript
interface Plugin<T = any> {
  name: string;
  install: (client: CoralFuzzy, options?: T) => Promise<void>;
}
```

## Browser Features

```typescript
interface BrowserFeatures {
  fetch: boolean;
  xhr: boolean;
  streams: boolean;
  webCrypto: boolean;
  serviceWorker: boolean;
  webSocket: boolean;
  compression: boolean;
  storage: {
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
  };
  performance: {
    timing: boolean;
    memory: boolean;
    observer: boolean;
  };
  network: {
    online: boolean;
    connection: boolean;
  };
}
```

## Statistics

```typescript
interface CoralStats {
  requests: {
    total: number;
    active: number;
    success: number;
    error: number;
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
  };
  performance: {
    averageResponseTime: number;
    averageRetries: number;
    successRate: number;
  };
}
```

## Constants

```typescript
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';
type ResponseType = 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';
```

## Next Steps

- Check out [Basic Usage](./basic-usage.md)
- Learn about [Advanced Features](./advanced-features.md)
- Explore [Configuration](./configuration.md) 