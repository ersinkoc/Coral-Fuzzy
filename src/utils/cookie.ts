import { RequestConfig, Response, CookieConfig } from '../types/index';

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export class CookieHandler {
  private config: Required<CookieConfig>;
  private cookieJar: Map<string, Cookie> = new Map();

  constructor(config: CookieConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      jar: config.jar ?? true,
      secure: config.secure ?? true,
      sameSite: config.sameSite ?? 'Lax',
      domain: config.domain ?? window.location.hostname,
      path: config.path ?? '/'
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (!this.config.enabled) {
      return request(config);
    }

    const updatedConfig = this.addCookiesToRequest(config);
    const response = await request(updatedConfig);
    
    if (this.config.jar) {
      this.saveCookiesFromResponse(response);
    }

    return response;
  }

  private addCookiesToRequest(config: RequestConfig): RequestConfig {
    if (!this.config.jar || this.cookieJar.size === 0) {
      return config;
    }

    const cookies = Array.from(this.cookieJar.values())
      .filter(cookie => this.isValidCookie(cookie))
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    return {
      ...config,
      headers: {
        ...config.headers,
        'Cookie': cookies
      }
    };
  }

  private saveCookiesFromResponse(response: Response<any>): void {
    const setCookie = response.headers['set-cookie'];
    if (!setCookie) return;

    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    cookies.forEach(cookieStr => {
      const cookie = this.parseCookie(cookieStr);
      if (cookie) {
        this.cookieJar.set(cookie.name, cookie);
      }
    });
  }

  private parseCookie(cookieStr: string): Cookie | null {
    const parts = cookieStr.split(';').map(part => part.trim());
    const [nameValue, ...attributes] = parts;
    
    const [name, value] = nameValue.split('=');
    if (!name || !value) return null;

    const cookie: Cookie = { name, value };

    attributes.forEach(attr => {
      const [key, val] = attr.split('=').map(s => s.toLowerCase());
      switch (key) {
        case 'domain':
          cookie.domain = val;
          break;
        case 'path':
          cookie.path = val;
          break;
        case 'expires':
          cookie.expires = new Date(val);
          break;
        case 'secure':
          cookie.secure = true;
          break;
        case 'samesite':
          cookie.sameSite = val as Cookie['sameSite'];
          break;
      }
    });

    return cookie;
  }

  private isValidCookie(cookie: Cookie): boolean {
    if (cookie.expires && cookie.expires < new Date()) {
      this.cookieJar.delete(cookie.name);
      return false;
    }

    if (cookie.secure && window.location.protocol !== 'https:') {
      return false;
    }

    if (cookie.domain && !window.location.hostname.endsWith(cookie.domain)) {
      return false;
    }

    if (cookie.path && !window.location.pathname.startsWith(cookie.path)) {
      return false;
    }

    return true;
  }

  getCookie(name: string): string | undefined {
    const cookie = this.cookieJar.get(name);
    return cookie && this.isValidCookie(cookie) ? cookie.value : undefined;
  }

  setCookie(name: string, value: string, options: Partial<Cookie> = {}): void {
    this.cookieJar.set(name, {
      name,
      value,
      domain: options.domain ?? this.config.domain,
      path: options.path ?? this.config.path,
      expires: options.expires,
      secure: options.secure ?? this.config.secure,
      sameSite: options.sameSite ?? this.config.sameSite
    });
  }

  deleteCookie(name: string): void {
    this.cookieJar.delete(name);
  }

  clearCookies(): void {
    this.cookieJar.clear();
  }
} 