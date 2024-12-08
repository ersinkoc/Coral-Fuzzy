export type Method =
  | 'GET'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'POST'
  | 'PUT'
  | 'PATCH';

export type ResponseType = 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';

export interface Metadata {
  startTime?: number;
  duration?: number;
  retryCount?: number;
  cached?: boolean;
  offline?: boolean;
  [key: string]: any;
}

export interface BatchConfig {
  maxBatchSize?: number;
  batchDelay?: number;
}

export interface RequestConfig {
  url?: string;
  baseURL?: string;
  method?: Method;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
  signal?: AbortSignal;
  onUploadProgress?: (event: ProgressEvent) => void;
  onDownloadProgress?: (event: ProgressEvent) => void;
  formData?: FormDataConfig;
  cookies?: CookieConfig;
  security?: SecurityConfig;
  metadata?: Metadata;
  cache?: boolean | CacheConfig;
  retry?: boolean | RetryConfig;
  rateLimit?: boolean | RateLimitConfig;
  batch?: boolean | BatchConfig;
  compression?: boolean | CompressionConfig;
  offline?: boolean;
  plugins?: Record<string, any>;
  adapter?: 'fetch' | 'xhr';
  priority?: number;
  maxConcurrent?: number;
  requestsPerSecond?: number;
}

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  request?: any;
  metadata?: {
    duration?: number;
    [key: string]: any;
  };
  cached?: boolean;
}

export interface CacheConfig {
  maxAge?: number;
  exclude?: {
    query?: boolean;
    paths?: string[];
    methods?: Method[];
  };
  storage?: 'memory' | 'localStorage' | 'sessionStorage';
}

export interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
}

export interface RateLimitConfig {
  maxRequests?: number;
  perMilliseconds?: number;
  maxConcurrent?: number;
}

export interface CompressionConfig {
  enabled?: boolean;
  threshold?: number;
  algorithm?: 'gzip' | 'deflate';
}

export interface FormDataConfig {
  maxFileSize?: number;
  maxFiles?: number;
  allowedTypes?: string[];
  onProgress?: (event: ProgressEvent) => void;
}

export interface CookieConfig {
  enabled?: boolean;
  jar?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  domain?: string;
  path?: string;
}

export interface SecurityConfig {
  xsrf?: {
    enabled?: boolean;
    cookieName?: string;
    headerName?: string;
  };
  ssl?: {
    verify?: boolean;
    cert?: string;
    key?: string;
  };
  headers?: Record<string, string>;
  validateOrigin?: boolean;
  validateContentType?: boolean;
  validateResponseHeaders?: boolean;
  validateResponseContent?: boolean;
}

export interface ProgressEvent {
  loaded: number;
  total: number;
  progress: number;
  bytes: number;
  rate: number;
  estimated: number;
  upload: boolean;
}

export interface Adapter {
  request<T = any>(config: RequestConfig): Promise<Response<T>>;
}

export type InterceptorFn<T> = (value: T) => T | Promise<T>;
export type ErrorInterceptorFn = (error: any) => any;

export interface Interceptor<T> {
  fulfilled: InterceptorFn<T>;
  rejected?: ErrorInterceptorFn;
}

export interface Plugin {
  name: string;
  install: (client: CoralFuzzyInstance, options?: any) => Promise<void>;
}

export interface BrowserFeatures {
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

export interface RequestMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  status: number;
  error?: any;
}

export interface MetricsConfig {
  enabled?: boolean;
  sampleRate?: number;
  historySize?: number;
}

export interface CompressionMetrics {
  url: string;
  originalSize: number;
  compressedSize: number;
}

export interface MetricsStats {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  cacheStats: {
    hits: number;
    misses: number;
    ratio: number;
  };
  compressionStats: {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageRatio: number;
    count: number;
  };
  errorStats: {
    total: number;
    types: Record<string, number>;
  };
}

export interface PerformanceMetrics {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  cacheStats: {
    hits: number;
    misses: number;
    ratio: number;
  };
  compressionStats: {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageRatio: number;
    count: number;
  };
  errorStats: {
    total: number;
    types: Record<string, number>;
  };
}

export interface CoralError extends Error {
  config?: RequestConfig;
  response?: Response<any>;
  status?: number;
  code?: string;
}

export interface Middleware {
  name: string;
  pre?: (config: RequestConfig) => Promise<RequestConfig>;
  post?: (response: Response<any>) => Promise<Response<any>>;
  error?: (error: CoralError) => Promise<CoralError>;
}

export interface CoralFuzzyInstance {
  request<T = any>(config: RequestConfig): Promise<Response<T>>;
  get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  head<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  options<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  use(middleware: Middleware): void;
  usePlugin(plugin: Plugin): Promise<void>;
  getFeatures(): BrowserFeatures;
  getStats(): {
    requests: RequestMetrics[];
    performance: PerformanceMetrics;
  };
  getBatchStats(): { currentBatchSize: number; isProcessing: boolean };
  clearBatch(): void;
} 