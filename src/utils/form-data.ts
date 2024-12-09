import { RequestConfig, Response, FormDataConfig, ProgressEvent } from '../types/index';

export class FormDataHandler {
  private config: Required<FormDataConfig>;
  private chunkSize: number = 1024 * 1024; // 1MB chunk size
  private supportedFeatures: {
    streams: boolean;
    chunks: boolean;
  } = {
    streams: typeof ReadableStream !== 'undefined' && typeof window !== 'undefined',
    chunks: typeof Blob !== 'undefined' && 'slice' in Blob.prototype
  };

  constructor(config: FormDataConfig = {}) {
    this.config = {
      maxFileSize: config.maxFileSize ?? 50 * 1024 * 1024,
      maxFiles: config.maxFiles ?? 10,
      allowedTypes: config.allowedTypes ?? ['*/*'],
      onProgress: config.onProgress ?? ((event: ProgressEvent) => {})
    };

    this.supportedFeatures = {
      streams: typeof ReadableStream !== 'undefined' && typeof window !== 'undefined',
      chunks: typeof Blob !== 'undefined' && 'slice' in Blob.prototype
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    if (!config.data || !(config.data instanceof FormData)) {
      return request(config);
    }

    const formData = config.data as FormData;
    await this.validateFormData(formData);
    
    const updatedConfig = await this.prepareRequest(config, formData);
    return request(updatedConfig);
  }

  private async prepareRequest(config: RequestConfig, formData: FormData): Promise<RequestConfig> {
    const shouldUseChunks = this.shouldUseChunkedUpload(formData);
    
    if (shouldUseChunks) {
      return this.prepareChunkedRequest(config, formData);
    }

    return {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (event: ProgressEvent) => {
        this.config.onProgress(this.calculateProgress(event));
        config.onUploadProgress?.(event);
      }
    };
  }

  private shouldUseChunkedUpload(formData: FormData): boolean {
    let totalSize = 0;
    for (const [_, value] of formData.entries()) {
      if (value instanceof File) {
        totalSize += value.size;
      }
    }
    return totalSize > this.chunkSize && this.supportedFeatures.chunks;
  }

  private async prepareChunkedRequest(config: RequestConfig, formData: FormData): Promise<RequestConfig> {
    const chunks: Blob[] = [];
    let currentChunk = new Blob();
    
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        const fileChunks = await this.createFileChunks(value);
        chunks.push(...fileChunks);
      } else {
        currentChunk = new Blob([currentChunk, value]);
      }
    }

    return {
      ...config,
      headers: {
        ...config.headers,
        'Content-Type': 'multipart/form-data',
        'X-Chunked-Upload': 'true',
        'X-Chunk-Size': this.chunkSize.toString()
      },
      data: chunks,
      onUploadProgress: this.createChunkedProgressHandler(config, chunks.length)
    };
  }

  private async createFileChunks(file: File): Promise<Blob[]> {
    const chunks: Blob[] = [];
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + this.chunkSize);
      chunks.push(chunk);
      offset += this.chunkSize;
    }

    return chunks;
  }

  private createChunkedProgressHandler(config: RequestConfig, totalChunks: number) {
    let uploadedChunks = 0;

    return (event: ProgressEvent) => {
      const chunkProgress = event.loaded / event.total;
      uploadedChunks = Math.floor(chunkProgress * totalChunks);
      
      const progress: ProgressEvent = {
        loaded: uploadedChunks * this.chunkSize,
        total: totalChunks * this.chunkSize,
        progress: (uploadedChunks / totalChunks) * 100,
        bytes: event.loaded,
        rate: event.loaded / (Date.now() - performance.now()),
        estimated: (totalChunks - uploadedChunks) * (this.chunkSize / event.loaded),
        upload: true
      };

      this.config.onProgress(progress);
      config.onUploadProgress?.(progress);
    };
  }

  private async validateFormData(formData: FormData): Promise<void> {
    let totalFiles = 0;
    const errors: string[] = [];

    for (const [_, value] of formData.entries()) {
      if (value instanceof File) {
        totalFiles++;
        
        if (totalFiles > this.config.maxFiles) {
          errors.push(`Maximum number of files (${this.config.maxFiles}) exceeded`);
          break;
        }

        if (value.size > this.config.maxFileSize) {
          errors.push(`File "${value.name}" exceeds maximum size of ${this.formatSize(this.config.maxFileSize)}`);
        }

        if (!this.isAllowedType(value.type)) {
          errors.push(`File type "${value.type}" is not allowed`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }

  private isAllowedType(type: string): boolean {
    if (this.config.allowedTypes.includes('*/*')) {
      return true;
    }
    return this.config.allowedTypes.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const prefix = allowedType.slice(0, -2);
        return type.startsWith(prefix);
      }
      return type === allowedType;
    });
  }

  private calculateProgress(event: ProgressEvent): ProgressEvent {
    const rate = event.loaded / (Date.now() - performance.now());
    const remaining = event.total - event.loaded;
    const estimated = rate > 0 ? remaining / rate : 0;

    return {
      ...event,
      progress: (event.loaded / event.total) * 100,
      bytes: event.loaded,
      rate,
      estimated,
      upload: true
    };
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
} 