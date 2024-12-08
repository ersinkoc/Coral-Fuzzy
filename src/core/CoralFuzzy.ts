import { RequestConfig, Response, Method, CoralFuzzyInstance, Adapter, BatchConfig, CacheConfig, RetryConfig, RateLimitConfig, CompressionConfig, Middleware, Plugin, BrowserFeatures, RequestMetrics, PerformanceMetrics, SecurityConfig } from '../types';
import { FetchAdapter } from '../adapters/fetch-adapter';
import { XHRAdapter } from '../adapters/xhr-adapter';
import { InterceptorManager } from '../interceptors/interceptor-manager';
import { PluginManager } from '../plugins';
import { FeatureDetector } from '../utils/feature-detector';
import { RequestPool } from '../utils/request-pool';
import { BatchHandler } from '../utils/batch';
import { CacheHandler } from '../utils/cache';
import { RetryHandler } from '../utils/retry';
import { RateLimitHandler } from '../utils/rate-limit';
import { CircuitBreakerHandler, CircuitBreakerConfig } from '../utils/circuit-breaker';
import { CompressionHandler } from '../utils/compression';
import { MetricsHandler, MetricsConfig } from '../utils/metrics';
import { SecurityHandler } from '../utils/security';
import { WebSocketHandler, WebSocketConfig } from '../utils/websocket';
import { SSEHandler, SSEConfig } from '../utils/sse';
import { GraphQLHandler, GraphQLConfig } from '../utils/graphql';

export interface CoralFuzzyConfig extends RequestConfig {
  maxConcurrent?: number;
  cache?: boolean | CacheConfig;
  retry?: boolean | RetryConfig;
  batch?: boolean | BatchConfig;
  rateLimit?: boolean | RateLimitConfig;
  circuitBreaker?: CircuitBreakerConfig;
  compression?: boolean | CompressionConfig;
  metrics?: MetricsConfig;
  security?: SecurityConfig;
  websocket?: WebSocketConfig;
  sse?: SSEConfig;
  graphql?: GraphQLConfig;
}

export class CoralFuzzy implements CoralFuzzyInstance {
  private adapter: Adapter;
  private features: FeatureDetector;
  private interceptors: {
    request: InterceptorManager<RequestConfig>;
    response: InterceptorManager<Response<any>>;
  };
  private plugins: PluginManager;
  private requestPool: RequestPool;
  private cache: CacheHandler;
  private batchHandler: BatchHandler;
  private retry: RetryHandler;
  private rateLimit: RateLimitHandler;
  private circuitBreaker: CircuitBreakerHandler;
  private compression: CompressionHandler;
  private metrics: MetricsHandler;
  private security: SecurityHandler;
  private websocket: WebSocketHandler | null = null;
  private sse: SSEHandler | null = null;
  private graphql: GraphQLHandler | null = null;

  constructor(config: CoralFuzzyConfig = {}) {
    this.features = FeatureDetector.getInstance();
    this.adapter = this.resolveAdapter(config);

    this.interceptors = {
      request: new InterceptorManager<RequestConfig>(),
      response: new InterceptorManager<Response<any>>()
    };

    this.plugins = new PluginManager(this);
    this.requestPool = new RequestPool({
      maxConcurrent: config.maxConcurrent ?? 10,
      requestsPerSecond: typeof config.rateLimit === 'object' ? 
        config.rateLimit.maxRequests ?? 50 : 50
    });

    this.cache = new CacheHandler(
      typeof config.cache === 'object' ? config.cache : undefined
    );

    this.batchHandler = new BatchHandler(
      typeof config.batch === 'object' ? config.batch : undefined
    );

    this.retry = new RetryHandler(
      typeof config.retry === 'object' ? config.retry : undefined
    );

    this.rateLimit = new RateLimitHandler(
      typeof config.rateLimit === 'object' ? config.rateLimit : undefined
    );

    this.circuitBreaker = new CircuitBreakerHandler(config.circuitBreaker);
    this.compression = new CompressionHandler(
      typeof config.compression === 'object' ? config.compression : undefined
    );
    this.metrics = new MetricsHandler(config.metrics);
    this.security = new SecurityHandler(config.security);

    if (config.websocket) {
      this.websocket = new WebSocketHandler(config.websocket);
    }

    if (config.sse) {
      this.sse = new SSEHandler(config.sse);
    }

    if (config.graphql) {
      this.graphql = new GraphQLHandler(config.graphql);
    }

    this.initializeDefaults(config);
  }

  private resolveAdapter(config: RequestConfig): Adapter {
    if (config.adapter === 'fetch' && FetchAdapter.isSupported()) {
      return new FetchAdapter();
    }
    if (config.adapter === 'xhr' || XHRAdapter.isSupported()) {
      return new XHRAdapter();
    }
    throw new Error('Uyumlu HTTP adaptörü bulunamadı');
  }

  private initializeDefaults(config: CoralFuzzyConfig): void {
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    this.interceptors.request.use(config => ({
      ...config,
      headers: { ...defaultHeaders, ...config.headers }
    }));
  }

  private async executeRequest<T>(config: RequestConfig): Promise<Response<T>> {
    try {
      config = await this.security.validateRequest(config);
      return await this.requestPool.execute(async () => {
        return await this.circuitBreaker.execute(async () => {
          return await this.rateLimit.execute(async () => {
            config = await this.compression.compressRequest(config);
            const response = await this.adapter.request<T>(config);
            return await this.compression.decompressResponse(response);
          }, config);
        }, config);
      });
    } catch (error) {
      this.metrics.recordError('request', config, error);
      throw error;
    }
  }

  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    return this.executeRequest<T>(config);
  }

  async get<T = any>(url: string, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async delete<T = any>(url: string, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async head<T = any>(url: string, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'HEAD', url });
  }

  async options<T = any>(url: string, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'OPTIONS', url });
  }

  async post<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T = any>(url: string, data?: any, config: RequestConfig = {}): Promise<Response<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  use(middleware: Middleware): void {
    this.interceptors.request.use(
      async (config) => middleware.pre ? await middleware.pre(config) : config,
      async (error) => middleware.error ? await middleware.error(error) : Promise.reject(error)
    );
  }

  async usePlugin(plugin: Plugin): Promise<void> {
    await this.plugins.register(plugin);
  }

  getFeatures(): BrowserFeatures {
    return this.features.getFeatures();
  }

  getStats() {
    const stats = this.metrics.getStats();
    return {
      requests: stats.requests,
      performance: {
        totalRequests: stats.performance.totalRequests,
        successRate: stats.performance.successRate,
        errorRate: stats.performance.errorRate,
        averageResponseTime: stats.performance.averageResponseTime,
        cacheStats: {
          hits: stats.performance.cacheStats.hits,
          misses: stats.performance.cacheStats.misses,
          ratio: stats.performance.cacheStats.ratio
        },
        compressionStats: {
          totalOriginalSize: stats.performance.compressionStats.totalOriginalSize,
          totalCompressedSize: stats.performance.compressionStats.totalCompressedSize,
          averageRatio: stats.performance.compressionStats.averageRatio,
          count: stats.performance.compressionStats.count
        },
        errorStats: {
          total: stats.performance.errorStats.total,
          types: stats.performance.errorStats.types
        }
      }
    };
  }

  getBatchStats(): { currentBatchSize: number; isProcessing: boolean } {
    return this.batchHandler.getStats();
  }

  clearBatch(): void {
    this.batchHandler.clear();
  }
} 