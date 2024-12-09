import { MetricsConfig, Response } from '../types';

interface NetworkMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  size: number;
  timeToFirstByte?: number;
  downloadTime?: number;
  error?: Error;
}

interface PerformanceMetrics {
  min: number;
  max: number;
  avg: number;
  count: number;
  total: number;
}

interface NetworkStats {
  latency: PerformanceMetrics;
  timeToFirstByte: PerformanceMetrics;
  downloadTime: PerformanceMetrics;
}

export class MetricsHandler {
  private config: Required<MetricsConfig>;
  private networkMetrics: NetworkMetrics[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private compressionStats = {
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    count: 0
  };
  private errorTypes: Record<string, number> = {};
  private errorCount = 0;
  private networkStats: NetworkStats;

  constructor(config: MetricsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      historySize: config.historySize ?? 1000
    };

    this.networkStats = {
      latency: this.createPerformanceMetrics(),
      timeToFirstByte: this.createPerformanceMetrics(),
      downloadTime: this.createPerformanceMetrics()
    };
  }

  private createPerformanceMetrics(): PerformanceMetrics {
    return {
      min: Infinity,
      max: -Infinity,
      avg: 0,
      count: 0,
      total: 0
    };
  }

  private updatePerformanceMetrics(metrics: PerformanceMetrics, value: number): void {
    metrics.min = Math.min(metrics.min, value);
    metrics.max = Math.max(metrics.max, value);
    metrics.total += value;
    metrics.count++;
    metrics.avg = metrics.total / metrics.count;
  }

  trackRequest(metrics: NetworkMetrics): void {
    if (!this.config.enabled || !this.shouldSample()) {
      return;
    }

    this.networkMetrics.push(metrics);

    if (metrics.error) {
      this.trackError(metrics.error);
    }

    const duration = metrics.endTime - metrics.startTime;
    this.updatePerformanceMetrics(this.networkStats.latency, duration);

    if (metrics.timeToFirstByte) {
      this.updatePerformanceMetrics(this.networkStats.timeToFirstByte, metrics.timeToFirstByte);
    }

    if (metrics.downloadTime) {
      this.updatePerformanceMetrics(this.networkStats.downloadTime, metrics.downloadTime);
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

  trackCompression(originalSize: number, compressedSize: number): void {
    if (!this.config.enabled) return;

    this.compressionStats.totalOriginalSize += originalSize;
    this.compressionStats.totalCompressedSize += compressedSize;
    this.compressionStats.count++;
  }

  private trackError(error: Error): void {
    this.errorCount++;
    const errorType = error.name || 'UnknownError';
    this.errorTypes[errorType] = (this.errorTypes[errorType] || 0) + 1;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private maintainHistorySize(): void {
    while (this.networkMetrics.length > this.config.historySize) {
      this.networkMetrics.shift();
    }
  }

  getStats() {
    const totalRequests = this.networkMetrics.length;
    const successfulRequests = this.networkMetrics.filter(m => !m.error).length;
    const totalCacheRequests = this.cacheHits + this.cacheMisses;

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: this.errorCount,
        successRate: totalRequests ? successfulRequests / totalRequests : 0
      },
      network: {
        latency: { ...this.networkStats.latency },
        timeToFirstByte: { ...this.networkStats.timeToFirstByte },
        downloadTime: { ...this.networkStats.downloadTime }
      },
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        total: totalCacheRequests,
        hitRate: totalCacheRequests ? this.cacheHits / totalCacheRequests : 0
      },
      compression: {
        ...this.compressionStats,
        compressionRatio: this.compressionStats.count
          ? 1 - (this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize)
          : 0
      },
      errors: {
        total: this.errorCount,
        types: { ...this.errorTypes }
      }
    };
  }

  clear(): void {
    this.networkMetrics = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.compressionStats = {
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      count: 0
    };
    this.errorTypes = {};
    this.errorCount = 0;
    this.networkStats = {
      latency: this.createPerformanceMetrics(),
      timeToFirstByte: this.createPerformanceMetrics(),
      downloadTime: this.createPerformanceMetrics()
    };
  }
} 