import { RateLimitConfig, RequestConfig, Response } from '../types';

interface QueuedRequest<T> {
  resolve: (value: Response<T>) => void;
  reject: (reason: any) => void;
  config: RequestConfig;
  request: (config: RequestConfig) => Promise<Response<T>>;
  priority: number;
}

export class RateLimitHandler {
  private requestTimestamps: number[] = [];
  private activeRequests: number = 0;
  private queue: QueuedRequest<any>[] = [];
  private config: Required<RateLimitConfig>;
  private processingQueue: boolean = false;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? 50,
      perMilliseconds: config.perMilliseconds ?? 1000,
      maxConcurrent: config.maxConcurrent ?? 10
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (!this.shouldRateLimit(config)) {
      return request(config);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        config,
        request,
        priority: config.priority ?? 0
      });

      this.processQueue();
    });
  }

  private shouldRateLimit(config: RequestConfig): boolean {
    if (config.rateLimit === false) return false;
    return true;
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      while (this.queue.length > 0) {
        if (!this.canProcessRequest()) {
          await this.delay(100);
          continue;
        }

        const nextRequest = this.getNextRequest();
        if (!nextRequest) break;

        this.activeRequests++;
        this.requestTimestamps.push(Date.now());

        try {
          const response = await nextRequest.request(nextRequest.config);
          nextRequest.resolve(response);
        } catch (error) {
          nextRequest.reject(error);
        } finally {
          this.activeRequests--;
        }
      }
    } finally {
      this.processingQueue = false;
      this.cleanupTimestamps();
    }
  }

  private getNextRequest(): QueuedRequest<any> | undefined {
    if (this.queue.length === 0) return undefined;

    // Önceliğe göre sırala
    this.queue.sort((a, b) => b.priority - a.priority);
    return this.queue.shift();
  }

  private canProcessRequest(): boolean {
    this.cleanupTimestamps();

    return (
      this.activeRequests < this.config.maxConcurrent &&
      this.requestTimestamps.length < this.config.maxRequests
    );
  }

  private cleanupTimestamps(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < this.config.perMilliseconds
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    requestsInWindow: number;
    windowReset: number;
  } {
    this.cleanupTimestamps();
    const now = Date.now();
    const oldestTimestamp = Math.min(...this.requestTimestamps, now);
    
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      requestsInWindow: this.requestTimestamps.length,
      windowReset: Math.max(0, this.config.perMilliseconds - (now - oldestTimestamp))
    };
  }

  clear(): void {
    this.queue.forEach(({ reject }) => {
      reject(new Error('Rate limit handler cleared'));
    });
    this.queue = [];
    this.requestTimestamps = [];
    this.activeRequests = 0;
  }
} 