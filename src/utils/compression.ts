import { CompressionConfig, RequestConfig } from '../types';
import type { Response } from '../types';

export class CompressionHandler {
  private config: Required<CompressionConfig>;

  constructor(config: CompressionConfig = {}) {
    this.config = {
      threshold: config.threshold ?? 1024, // 1KB
      algorithm: config.algorithm ?? 'gzip',
      enabled: config.enabled ?? true
    };
  }

  async compressRequest(config: RequestConfig): Promise<RequestConfig> {
    if (!this.shouldCompress(config)) {
      return config;
    }

    const data = config.data;
    if (!data) return config;

    try {
      const compressed = await this.compress(data);
      return {
        ...config,
        data: compressed,
        headers: {
          ...config.headers,
          'Content-Encoding': this.config.algorithm
        }
      };
    } catch (error) {
      console.warn('Compression failed:', error);
      return config;
    }
  }

  async decompressResponse<T>(response: Response<T>): Promise<Response<T>> {
    const contentEncoding = response.headers['content-encoding']?.toLowerCase();
    if (!contentEncoding) return response;

    try {
      const decompressed = await this.decompress(response.data, contentEncoding);
      return {
        ...response,
        data: decompressed,
        headers: {
          ...response.headers,
          'content-length': String(this.getDataSize(decompressed))
        }
      };
    } catch (error) {
      console.warn('Decompression failed:', error);
      return response;
    }
  }

  private shouldCompress(config: RequestConfig): boolean {
    if (!this.config.enabled) return false;
    if (config.compression === false) return false;

    const data = config.data;
    if (!data) return false;

    const size = this.getDataSize(data);
    return size >= this.config.threshold;
  }

  private async compress(data: any): Promise<ArrayBuffer> {
    if (typeof CompressionStream === 'undefined') {
      throw new Error('CompressionStream not supported');
    }

    const textEncoder = new TextEncoder();
    const buffer = typeof data === 'string' ? 
      textEncoder.encode(data) : 
      textEncoder.encode(JSON.stringify(data));

    const stream = new Blob([buffer]).stream();
    const compressedStream = stream.pipeThrough(
      new CompressionStream(this.config.algorithm as 'gzip' | 'deflate')
    );

    return new Response(compressedStream).arrayBuffer();
  }

  private async decompress(data: any, algorithm: string): Promise<any> {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream not supported');
    }

    const buffer = data instanceof ArrayBuffer ? 
      data : 
      await new Response(data).arrayBuffer();

    const stream = new Blob([buffer]).stream();
    const decompressedStream = stream.pipeThrough(
      new DecompressionStream(algorithm as 'gzip' | 'deflate')
    );

    const response = await new Response(decompressedStream).arrayBuffer();
    const textDecoder = new TextDecoder();
    const text = textDecoder.decode(response);

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private getDataSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (data instanceof Blob) {
      return data.size;
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data).length;
    }
    return new TextEncoder().encode(JSON.stringify(data)).length;
  }

  getStats(): {
    enabled: boolean;
    algorithm: string;
    threshold: number;
  } {
    return {
      enabled: this.config.enabled,
      algorithm: this.config.algorithm,
      threshold: this.config.threshold
    };
  }
} 