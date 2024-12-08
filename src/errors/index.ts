import { RequestConfig, Response } from '../types';

export class CoralFuzzyError extends Error {
  constructor(
    message: string,
    public code: string,
    public config?: RequestConfig,
    public response?: Response<any>
  ) {
    super(message);
    this.name = 'CoralFuzzyError';
    Object.setPrototypeOf(this, CoralFuzzyError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      config: this.config,
      response: this.response
    };
  }
}

export class NetworkError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig) {
    super(message, 'NETWORK_ERROR', config);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class TimeoutError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig) {
    super(message, 'TIMEOUT_ERROR', config);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class ValidationError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig) {
    super(message, 'VALIDATION_ERROR', config);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class CancelError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig) {
    super(message, 'CANCEL_ERROR', config);
    this.name = 'CancelError';
    Object.setPrototypeOf(this, CancelError.prototype);
  }
}

export class AuthenticationError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig, response?: Response<any>) {
    super(message, 'AUTHENTICATION_ERROR', config, response);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class RateLimitError extends CoralFuzzyError {
  constructor(
    message: string,
    public retryAfter?: number,
    config?: RequestConfig,
    response?: Response<any>
  ) {
    super(message, 'RATE_LIMIT_ERROR', config, response);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

export class CircuitBreakerError extends CoralFuzzyError {
  constructor(
    message: string,
    public resetTimeout?: number,
    config?: RequestConfig
  ) {
    super(message, 'CIRCUIT_BREAKER_ERROR', config);
    this.name = 'CircuitBreakerError';
    Object.setPrototypeOf(this, CircuitBreakerError.prototype);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resetTimeout: this.resetTimeout
    };
  }
}

export class ServerError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig, response?: Response<any>) {
    super(message, 'SERVER_ERROR', config, response);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class ClientError extends CoralFuzzyError {
  constructor(message: string, config?: RequestConfig, response?: Response<any>) {
    super(message, 'CLIENT_ERROR', config, response);
    this.name = 'ClientError';
    Object.setPrototypeOf(this, ClientError.prototype);
  }
}

export function createError(
  message: string,
  code: string,
  config?: RequestConfig,
  response?: Response<any>
): CoralFuzzyError {
  const status = response?.status;

  if (code === 'ECONNABORTED') {
    return new TimeoutError(message, config);
  }

  if (!response || !status) {
    return new NetworkError(message, config);
  }

  if (status === 429) {
    const retryAfter = parseInt(response.headers['retry-after'] || '0', 10);
    return new RateLimitError(message, retryAfter, config, response);
  }

  if (status === 401 || status === 403) {
    return new AuthenticationError(message, config, response);
  }

  if (status >= 400 && status < 500) {
    return new ClientError(message, config, response);
  }

  if (status >= 500) {
    return new ServerError(message, config, response);
  }

  return new CoralFuzzyError(message, code, config, response);
} 