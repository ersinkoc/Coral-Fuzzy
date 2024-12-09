import { SecurityConfig, RequestConfig, Response } from '../types';

export class SecurityHandler {
  private config: Required<SecurityConfig>;
  private xsrfToken: string | null = null;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      xsrf: {
        enabled: config.xsrf?.enabled ?? true,
        cookieName: config.xsrf?.cookieName ?? 'XSRF-TOKEN',
        headerName: config.xsrf?.headerName ?? 'X-XSRF-TOKEN'
      },
      ssl: {
        verify: config.ssl?.verify ?? true,
        cert: config.ssl?.cert ?? '',
        key: config.ssl?.key ?? ''
      },
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        ...config.headers
      },
      validateOrigin: config.validateOrigin ?? true
    };
  }

  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    if (!config.headers) {
      config.headers = {};
    }

    // XSRF Token işleme
    if (this.config.xsrf.enabled && this.shouldAddXsrfToken(config)) {
      const token = await this.getXsrfToken();
      if (token) {
        config.headers[this.config.xsrf.headerName] = token;
      }
    }

    // Güvenlik başlıklarını ekle
    config.headers = {
      ...this.config.headers,
      ...config.headers
    };

    // SSL doğrulama
    if (this.config.ssl.verify && config.url?.startsWith('https://')) {
      if (this.config.ssl.cert) {
        config.cert = this.config.ssl.cert;
      }
      if (this.config.ssl.key) {
        config.key = this.config.ssl.key;
      }
    }

    // Origin doğrulama
    if (this.config.validateOrigin && typeof window !== 'undefined') {
      config.headers['Origin'] = window.location.origin;
    }

    return config;
  }

  processResponse(response: Response): Response {
    // XSRF token'ı güncelle
    if (this.config.xsrf.enabled) {
      const token = response.headers[this.config.xsrf.cookieName.toLowerCase()];
      if (token) {
        this.xsrfToken = token;
      }
    }

    return response;
  }

  private shouldAddXsrfToken(config: RequestConfig): boolean {
    const method = (config.method || 'get').toLowerCase();
    return ['post', 'put', 'patch', 'delete'].includes(method);
  }

  private async getXsrfToken(): Promise<string | null> {
    if (this.xsrfToken) {
      return this.xsrfToken;
    }

    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === this.config.xsrf.cookieName) {
          this.xsrfToken = value;
          return value;
        }
      }
    }

    return null;
  }

  validateUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // HTTP/HTTPS protokol kontrolü
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return false;
      }

      // SSL zorunluluğu kontrolü
      if (this.config.ssl.verify && parsedUrl.protocol !== 'https:') {
        return false;
      }

      // Origin doğrulama
      if (this.config.validateOrigin && typeof window !== 'undefined') {
        const isSameOrigin = parsedUrl.origin === window.location.origin;
        if (!isSameOrigin) {
          // CORS başlıklarını kontrol et
          if (!this.validateCorsHeaders(url)) {
            return false;
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private validateCorsHeaders(url: string): boolean {
    // CORS başlıkları kontrolü burada yapılabilir
    // Bu örnek implementasyonda basit bir kontrol yapıyoruz
    return true;
  }

  getSecurityHeaders(): Record<string, string> {
    return { ...this.config.headers };
  }

  clear(): void {
    this.xsrfToken = null;
  }
} 