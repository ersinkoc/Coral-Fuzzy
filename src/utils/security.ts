import { RequestConfig, SecurityConfig } from '../types';

export class SecurityHandler {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = config;
  }

  async validateRequest(config: RequestConfig): Promise<RequestConfig> {
    return this.processRequest(config);
  }

  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    // Security checks
    if (this.config.validateOrigin) {
      this.validateOrigin(config);
    }
    
    if (this.config.validateContentType) {
      this.validateContentType(config);
    }

    return config;
  }

  validateResponse(response: Response): void {
    // Response security checks
    if (this.config.validateResponseHeaders) {
      this.validateResponseHeaders(response);
    }

    if (this.config.validateResponseContent) {
      this.validateResponseContent(response);
    }
  }

  private validateOrigin(config: RequestConfig): void {
    // Origin security check
    if (config.url) {
      const urlObj = new URL(config.url);
      if (urlObj.origin !== window.location.origin) {
        throw new Error('Invalid origin');
      }
    }
  }

  private validateContentType(config: RequestConfig): void {
    // Content-Type security check
    if (config.headers) {
      const contentType = config.headers['Content-Type'];
      if (contentType && !contentType.includes('application/json')) {
        throw new Error('Invalid Content-Type');
      }
    }
  }

  private validateResponseHeaders(response: Response): void {
    // Response headers security check
    if (response.headers) {
      const contentType = response.headers.get('Content-Type');
      if (contentType && !contentType.includes('application/json')) {
        throw new Error('Invalid Content-Type');
      }
    }
  }

  private validateResponseContent(response: Response): void {
    // Response content security check
    if (response.status === 401) {
      throw new Error('Unauthorized access');
    }
  }
} 