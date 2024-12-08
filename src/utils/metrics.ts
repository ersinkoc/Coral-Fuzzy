import { RequestMetrics, MetricsConfig, MetricsStats, CompressionMetrics, RequestConfig } from '../types';

export { MetricsConfig };
export class MetricsHandler {
  private config: Required<MetricsConfig>;
  private requests: RequestMetrics[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private compressionStats = {
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    count: 0
  };
  private errorTypes: Record<string, number> = {};
  private errorCount = 0;

  constructor(config: MetricsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      historySize: config.historySize ?? 1000
    };
  }

  trackRequest(metrics: RequestMetrics): void {
    if (!this.config.enabled || !this.shouldSample()) {
      return;
    }

    this.requests.push(metrics);
    if (metrics.error) {
      this.trackError(metrics.error);
    }

    this.maintainHistorySize();
  }

  trackCache(url: string, hit: boolean): void {
    if (!this.config.enabled) return;

    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  trackCompression(metrics: CompressionMetrics): void {
    if (!this.config.enabled) return;

    this.compressionStats.totalOriginalSize += metrics.originalSize;
    this.compressionStats.totalCompressedSize += metrics.compressedSize;
    this.compressionStats.count++;
  }

  trackError(error: Error): void {
    if (!this.config.enabled) return;

    this.errorCount++;
    const errorType = error.message || 'Unknown error';
    this.errorTypes[errorType] = (this.errorTypes[errorType] || 0) + 1;
  }

  shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private maintainHistorySize(): void {
    while (this.requests.length > this.config.historySize) {
      this.requests.shift();
    }
  }

  recordError(type: string, config: RequestConfig, error: any): void {
    if (!this.config.enabled) return;

    this.errorCount++;
    const errorType = error.message || 'Unknown error';
    this.errorTypes[errorType] = (this.errorTypes[errorType] || 0) + 1;

    this.trackRequest({
      url: config.url || '',
      method: config.method || 'GET',
      startTime: Date.now(),
      endTime: Date.now(),
      status: error.response?.status || 0,
      error: error
    });
  }

  getStats(): {
    requests: RequestMetrics[];
    performance: {
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
    };
  } {
    const successfulRequests = this.requests.filter(r => !r.error && r.status >= 200 && r.status < 300);
    const totalRequests = this.requests.length;
    const totalResponseTime = this.requests.reduce((sum, r) => sum + (r.endTime - r.startTime), 0);

    return {
      requests: this.requests,
      performance: {
        totalRequests,
        successRate: totalRequests ? successfulRequests.length / totalRequests : 0,
        errorRate: totalRequests ? (totalRequests - successfulRequests.length) / totalRequests : 0,
        averageResponseTime: totalRequests ? totalResponseTime / totalRequests : 0,
        cacheStats: {
          hits: this.cacheHits,
          misses: this.cacheMisses,
          ratio: this.cacheHits + this.cacheMisses > 0 
            ? this.cacheHits / (this.cacheHits + this.cacheMisses)
            : 0
        },
        compressionStats: {
          totalOriginalSize: this.compressionStats.totalOriginalSize,
          totalCompressedSize: this.compressionStats.totalCompressedSize,
          averageRatio: this.compressionStats.count > 0
            ? this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize
            : 0,
          count: this.compressionStats.count
        },
        errorStats: {
          total: this.errorCount,
          types: { ...this.errorTypes }
        }
      }
    };
  }

  clear(): void {
    this.requests = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.compressionStats = {
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      count: 0
    };
    this.errorTypes = {};
    this.errorCount = 0;
  }
} 