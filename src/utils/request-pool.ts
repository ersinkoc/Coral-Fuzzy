import { RequestConfig, Response } from '../types';

interface RequestPoolConfig {
  maxConcurrent: number;
  requestsPerSecond: number;
}

interface QueuedRequest<T> {
  config: RequestConfig;
  resolve: (value: Response<T>) => void;
  reject: (reason: any) => void;
  priority: number;
}

export class RequestPool {
  private config: Required<RequestPoolConfig>;
  private activeRequests: Set<Promise<any>> = new Set();
  private queue: QueuedRequest<any>[] = [];
  private processingQueue: boolean = false;
  private requestTimestamps: number[] = [];

  constructor(config: RequestPoolConfig) {
    this.config = {
      maxConcurrent: config.maxConcurrent,
      requestsPerSecond: config.requestsPerSecond
    };
  }

  async execute<T>(
    request: () => Promise<Response<T>>,
    priority: number = 0
  ): Promise<Response<T>> {
    if (this.canProcessImmediately()) {
      return this.processRequest(request);
    }

    return new Promise<Response<T>>((resolve, reject) => {
      this.queue.push({
        config: {},
        resolve,
        reject,
        priority
      });

      this.processQueue();
    });
  }

  private canProcessImmediately(): boolean {
    this.cleanupTimestamps();
    return (
      this.activeRequests.size < this.config.maxConcurrent &&
      this.requestTimestamps.length < this.config.requestsPerSecond
    );
  }

  private async processRequest<T>(
    request: () => Promise<Response<T>>
  ): Promise<Response<T>> {
    const requestPromise = new Promise<Response<T>>(async (resolve, reject) => {
      try {
        this.requestTimestamps.push(Date.now());
        const response = await request();
        resolve(response);
      } catch (error) {
        reject(error);
      } finally {
        this.activeRequests.delete(requestPromise);
        this.processQueue();
      }
    });

    this.activeRequests.add(requestPromise);
    return requestPromise;
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.queue.length > 0 && this.canProcessImmediately()) {
        const nextRequest = this.getNextRequest();
        if (!nextRequest) break;

        const { resolve, reject } = nextRequest;

        try {
          const response = await this.processRequest(async () => {
            const config = nextRequest.config;
            return {
              data: null,
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
              request: null
            };
          });
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private getNextRequest(): QueuedRequest<any> | undefined {
    if (this.queue.length === 0) return undefined;

    // Önceliğe göre sırala
    this.queue.sort((a, b) => b.priority - a.priority);
    return this.queue.shift();
  }

  private cleanupTimestamps(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 1000
    );
  }

  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    requestsInWindow: number;
  } {
    this.cleanupTimestamps();
    return {
      activeRequests: this.activeRequests.size,
      queuedRequests: this.queue.length,
      requestsInWindow: this.requestTimestamps.length
    };
  }

  clear(): void {
    this.queue.forEach(request => {
      request.reject(new Error('Request pool cleared'));
    });
    this.queue = [];
    this.requestTimestamps = [];
    this.activeRequests.clear();
  }
} 