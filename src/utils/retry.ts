import { RequestConfig, Response, RetryConfig } from '../types/index';

export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryCondition: config.retryCondition ?? this.defaultRetryCondition.bind(this)
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    let lastError: any;
    let retryCount = 0;

    while (retryCount <= this.config.maxRetries) {
      try {
        const response = await request(config);
        return response;
      } catch (error) {
        lastError = error;

        if (
          retryCount === this.config.maxRetries ||
          !this.shouldRetry(error)
        ) {
          throw error;
        }

        await this.delay(this.getDelayTime(retryCount));
        retryCount++;
      }
    }

    throw lastError;
  }

  private shouldRetry(error: any): boolean {
    return this.config.retryCondition(error);
  }

  private defaultRetryCondition(error: any): boolean {
    // Retry for network errors
    if (!error.response) {
      return true;
    }

    // Retry for 5xx server errors
    if (error.response.status >= 500 && error.response.status <= 599) {
      return true;
    }

    // Retry for 429 (Too Many Requests)
    if (error.response.status === 429) {
      return true;
    }

    return false;
  }

  private getDelayTime(retryCount: number): number {
    // Exponential backoff strategy
    return this.config.retryDelay * Math.pow(2, retryCount);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 