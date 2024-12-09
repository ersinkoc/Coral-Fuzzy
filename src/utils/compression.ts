import { CompressionConfig, RequestConfig, Response } from '../types';

export class CompressionHandler {
  private config: Required<CompressionConfig>;
  private compressionSupported: boolean;

  constructor(config: CompressionConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      threshold: config.threshold ?? 1024, // 1KB
      algorithm: config.algorithm ?? 'gzip'
    };

    this.compressionSupported = typeof CompressionStream !== 'undefined';
  }

  async processRequest(config: RequestConfig): Promise<RequestConfig> {
    if (!this.shouldCompress(config)) {
      return config;
    }

    const data = config.data;
    if (!data || typeof data !== 'string') {
      return config;
    }

    try {
      const compressedData = await this.compress(data);
      return {
        ...config,
        data: compressedData,
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

  async processResponse(response: Response): Promise<Response> {
    const contentEncoding = response.headers['content-encoding']?.toLowerCase();
    if (!contentEncoding || !this.isCompressed(contentEncoding)) {
      return response;
    }

    try {
      const decompressedData = await this.decompress(response.data, contentEncoding);
      return {
        ...response,
        data: decompressedData,
        headers: {
          ...response.headers,
          'content-length': String(decompressedData.length)
        }
      };
    } catch (error) {
      console.warn('Decompression failed:', error);
      return response;
    }
  }

  private shouldCompress(config: RequestConfig): boolean {
    if (!this.config.enabled || !this.compressionSupported) {
      return false;
    }

    const data = config.data;
    if (!data || typeof data !== 'string') {
      return false;
    }

    return data.length >= this.config.threshold;
  }

  private isCompressed(contentEncoding: string): boolean {
    return ['gzip', 'deflate'].includes(contentEncoding);
  }

  private async compress(data: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(data));
        controller.close();
      }
    });

    const cs = new CompressionStream(this.config.algorithm);
    const compressedStream = stream.pipeThrough(cs);
    const chunks: Uint8Array[] = [];

    const reader = compressedStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  private async decompress(data: Uint8Array, algorithm: string): Promise<string> {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });

    const ds = new DecompressionStream(algorithm as 'gzip' | 'deflate');
    const decompressedStream = stream.pipeThrough(ds);
    const chunks: Uint8Array[] = [];

    const reader = decompressedStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    const decoder = new TextDecoder();
    return decoder.decode(result);
  }

  getStats(): {
    enabled: boolean;
    algorithm: string;
    threshold: number;
    compressionSupported: boolean;
  } {
    return {
      enabled: this.config.enabled,
      algorithm: this.config.algorithm,
      threshold: this.config.threshold,
      compressionSupported: this.compressionSupported
    };
  }
} 