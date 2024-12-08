import { Adapter, RequestConfig, Response, ResponseType } from '../types/index';

export class FetchAdapter implements Adapter {
  static isSupported(): boolean {
    return typeof fetch !== 'undefined';
  }

  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    if (!config.url) {
      throw new Error('URL is required');
    }

    const headers = this.prepareHeaders(config.headers);
    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      body: this.prepareRequestData(config.data),
      signal: config.signal,
      credentials: config.withCredentials ? 'include' : 'same-origin',
    };

    try {
      const response = await this.performRequest(config.url, requestConfig);
      const result = await this.createResponse<T>(response, config);

      if (!this.validateStatus(response.status, config)) {
        throw Object.assign(new Error('Request failed with status ' + response.status), {
          config,
          response: result,
        });
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw Object.assign(error, { config });
      }
      throw error;
    }
  }

  private async performRequest(url: string, config: RequestInit): Promise<globalThis.Response> {
    try {
      return await fetch(url, config);
    } catch (error) {
      throw new Error('Network Error');
    }
  }

  private prepareHeaders(headers: Record<string, string> = {}): Headers {
    const result = new Headers();
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        result.set(key, value.toString());
      }
    });
    return result;
  }

  private prepareRequestData(data: any): BodyInit | undefined {
    if (!data) {
      return undefined;
    }

    if (data instanceof FormData || data instanceof URLSearchParams || typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data);
  }

  private validateStatus(status: number, config: RequestConfig): boolean {
    if (config.validateStatus) {
      return config.validateStatus(status);
    }
    return status >= 200 && status < 300;
  }

  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  private async createResponse<T>(
    response: globalThis.Response,
    config: RequestConfig
  ): Promise<Response<T>> {
    const responseType = config.responseType || 'json';
    let data: T;

    try {
      data = await this.parseResponseData<T>(response, responseType);
    } catch (error) {
      throw new Error(`Error parsing response: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: this.parseHeaders(response.headers),
      config,
      request: null,
    };
  }

  private async parseResponseData<T>(
    response: globalThis.Response,
    responseType: ResponseType
  ): Promise<T> {
    switch (responseType) {
      case 'text':
        return response.text() as unknown as T;
      case 'blob':
        return response.blob() as unknown as T;
      case 'arraybuffer':
        return response.arrayBuffer() as unknown as T;
      case 'document':
        const text = await response.text();
        const parser = new DOMParser();
        return parser.parseFromString(text, 'text/html') as unknown as T;
      case 'json':
      default:
        const content = await response.text();
        return content ? JSON.parse(content) : null;
    }
  }
} 