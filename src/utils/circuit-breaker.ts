import { RequestConfig, Response } from '../types';

interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  requestTimeout?: number;
  monitorInterval?: number;
  healthCheck?: () => Promise<boolean>;
}

interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  lastFailureTime: number | null;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastError: Error | null;
  uptime: number;
  downtime: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreakerHandler {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number | null = null;
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private lastError: Error | null = null;
  private startTime: number = Date.now();
  private lastDownTime: number = 0;

  private readonly config: Required<CircuitBreakerConfig>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 minute
      requestTimeout: config.requestTimeout ?? 10000, // 10 seconds
      monitorInterval: config.monitorInterval ?? 30000, // 30 seconds
      healthCheck: config.healthCheck ?? (async () => true)
    };

    this.startHealthCheck();
  }

  async executeRequest<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is OPEN');
    }

    this.totalRequests++;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout'));
        }, this.config.requestTimeout);
      });

      const response = await Promise.race([
        request(config),
        timeoutPromise
      ]);

      this.onSuccess();
      return response;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (this.lastFailureTime && (now - this.lastFailureTime) > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  private onSuccess(): void {
    this.successfulRequests++;
    if (this.state === CircuitState.HALF_OPEN) {
      this.reset();
    }
  }

  private onFailure(error: Error): void {
    this.failedRequests++;
    this.lastError = error;
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.lastDownTime = Date.now();
    }
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = null;
  }

  private async startHealthCheck(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.config.healthCheck();
        if (isHealthy && this.state === CircuitState.OPEN) {
          this.state = CircuitState.HALF_OPEN;
        }
      } catch (error) {
        console.warn('Health check failed:', error);
      }
    }, this.config.monitorInterval);
  }

  getStats(): CircuitBreakerStats {
    const now = Date.now();
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      lastError: this.lastError,
      uptime: now - this.startTime - this.lastDownTime,
      downtime: this.lastDownTime
    };
  }

  clear(): void {
    this.reset();
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.lastError = null;
    this.startTime = Date.now();
    this.lastDownTime = 0;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
} 