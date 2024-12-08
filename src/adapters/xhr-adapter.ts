import { Adapter, RequestConfig, Response } from '../types/index';

export class XHRAdapter implements Adapter {
  static isSupported(): boolean {
    return typeof XMLHttpRequest !== 'undefined';
  }

  async request<T = any>(config: RequestConfig): Promise<Response<T>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open(
        config.method || 'GET',
        config.url || '',
        true
      );

      this.setRequestHeaders(xhr, config.headers);
      this.setRequestConfig(xhr, config);

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;

        if (xhr.status === 0 && !xhr.responseURL) {
          return reject(new Error('Network Error'));
        }

        const response: Response<T> = {
          data: this.parseResponse(xhr, config.responseType),
          status: xhr.status,
          statusText: xhr.statusText,
          headers: this.parseHeaders(xhr.getAllResponseHeaders()),
          config,
          request: xhr
        };

        if (this.validateStatus(xhr.status, config)) {
          resolve(response);
        } else {
          reject(Object.assign(
            new Error('Request failed with status ' + xhr.status),
            { config, response }
          ));
        }
      };

      xhr.onerror = () => {
        reject(Object.assign(
          new Error('Network Error'),
          { config }
        ));
      };

      xhr.ontimeout = () => {
        reject(Object.assign(
          new Error('Timeout of ' + config.timeout + 'ms exceeded'),
          { config }
        ));
      };

      if (config.signal) {
        config.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(Object.assign(
            new Error('Request aborted'),
            { config }
          ));
        });
      }

      xhr.send(this.prepareRequestData(config.data));
    });
  }

  private setRequestHeaders(xhr: XMLHttpRequest, headers: Record<string, string> = {}): void {
    Object.entries(headers).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        xhr.setRequestHeader(key, value.toString());
      }
    });
  }

  private setRequestConfig(xhr: XMLHttpRequest, config: RequestConfig): void {
    if (config.timeout) {
      xhr.timeout = config.timeout;
    }

    if (config.withCredentials) {
      xhr.withCredentials = true;
    }

    if (config.responseType) {
      xhr.responseType = config.responseType;
    }
  }

  private prepareRequestData(data: any): any {
    if (!data) {
      return null;
    }

    if (data instanceof FormData || data instanceof URLSearchParams) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data);
  }

  private parseHeaders(headerStr: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (!headerStr) {
      return headers;
    }

    headerStr.split('\r\n').forEach(line => {
      const parts = line.split(': ');
      const key = parts.shift();
      if (key && parts.length) {
        headers[key.toLowerCase()] = parts.join(': ');
      }
    });

    return headers;
  }

  private parseResponse<T>(xhr: XMLHttpRequest, responseType?: string): T {
    switch (responseType) {
      case 'text':
        return xhr.responseText as unknown as T;
      case 'json':
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return xhr.responseText as unknown as T;
        }
      default:
        return xhr.response;
    }
  }

  private validateStatus(status: number, config: RequestConfig): boolean {
    if (config.validateStatus) {
      return config.validateStatus(status);
    }
    return status >= 200 && status < 300;
  }
} 