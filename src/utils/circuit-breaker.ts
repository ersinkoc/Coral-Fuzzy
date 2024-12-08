import { RequestConfig, Response } from '../types';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  requestTimeout?: number;
  monitoredErrors?: Array<number | string>;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreakerHandler {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeout: config.resetTimeout ?? 60000, // 1 dakika
      requestTimeout: config.requestTimeout ?? 10000, // 10 saniye
      monitoredErrors: config.monitoredErrors ?? [500, 502, 503, 504, 'ECONNREFUSED', 'ETIMEDOUT']
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (this.isOpen()) {
      throw new Error(`Circuit breaker is ${this.state}`);
    }

    try {
      const response = await this.executeWithTimeout(request, config);
      this.onSuccess();
      return response;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const response = await request({
        ...config,
        signal: controller.signal
      });

      if (this.isErrorResponse(response)) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) { // 2 başarılı istek sonrası tamamen kapat
        this.reset();
      }
    }
  }

  private onFailure(error: any): void {
    if (!this.shouldCountError(error)) {
      return;
    }

    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldCountError(error: any): boolean {
    if (error.response) {
      return this.config.monitoredErrors.includes(error.response.status);
    }
    
    if (error.code) {
      return this.config.monitoredErrors.includes(error.code);
    }

    return true;
  }

  private isErrorResponse(response: Response): boolean {
    return response.status >= 500;
  }

  private reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.state = CircuitState.CLOSED;
  }

  getState(): string {
    return this.state;
  }

  getStats(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    isOpen: boolean;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      isOpen: this.isOpen()
    };
  }
} 