import { BatchConfig, RequestConfig, Response } from '../types/index';

interface BatchItem<T> {
  config: RequestConfig;
  resolve: (response: Response<T>) => void;
  reject: (error: unknown) => void;
}

export class BatchHandler {
  private batch: BatchItem<unknown>[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly maxBatchSize: number;
  private readonly batchDelay: number;

  constructor(config: BatchConfig = {}) {
    this.maxBatchSize = config.maxBatchSize ?? 5;
    this.batchDelay = config.batchDelay ?? 50;
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    const method = (config.method ?? 'GET').toUpperCase();

    if (config.batch === false || ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return request(config);
    }

    return new Promise<Response<T>>((resolve, reject) => {
      this.batch.push({ config, resolve, reject } as BatchItem<unknown>);
      this.scheduleBatchProcessing(request);
    });
  }

  private scheduleBatchProcessing<T>(
    request: (config: RequestConfig) => Promise<Response<T>>
  ): void {
    if (this.batch.length >= this.maxBatchSize) {
      void this.processBatch(request);
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        void this.processBatch(request);
      }, this.batchDelay);
    }
  }

  private async processBatch<T>(
    request: (config: RequestConfig) => Promise<Response<T>>
  ): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      const batchGroups = this.groupBatchRequests(currentBatch);
      await Promise.all(
        Object.entries(batchGroups).map(async ([, items]) => {
          try {
            const batchConfig = this.createBatchConfig(items);
            const response = await request(batchConfig);
            
            items.forEach(item => {
              item.resolve({
                ...response,
                config: item.config,
                data: this.extractResponseData(response.data, item.config)
              });
            });
          } catch (error) {
            items.forEach(item => item.reject(error));
          }
        })
      );
    } catch (error) {
      currentBatch.forEach(item => item.reject(error));
    }
  }

  private groupBatchRequests(
    batch: BatchItem<unknown>[]
  ): Record<string, BatchItem<unknown>[]> {
    return batch.reduce((groups, item) => {
      const key = this.getBatchKey(item.config);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, BatchItem<unknown>[]>);
  }

  private getBatchKey(config: RequestConfig): string {
    const baseURL = config.baseURL ?? '';
    const url = config.url ?? '';
    const method = config.method ?? 'GET';
    return `${baseURL}|${url}|${method}`.toUpperCase();
  }

  private createBatchConfig(items: BatchItem<unknown>[]): RequestConfig {
    const baseConfig = items[0].config;
    return {
      ...baseConfig,
      batch: true,
      metadata: {
        ...baseConfig.metadata,
        batchSize: items.length
      }
    };
  }

  private extractResponseData(data: unknown, config: RequestConfig): unknown {
    if (!Array.isArray(data)) return data;
    
    const urlParts = (config.url ?? '').split('/');
    const id = urlParts[urlParts.length - 1];
    if (!id) return data;
    
    const item = data.find(item => 
      typeof item === 'object' && 
      item !== null && 
      'id' in item && 
      item.id === id
    );
    return item ?? data;
  }

  getStats(): { currentBatchSize: number; isProcessing: boolean } {
    return {
      currentBatchSize: this.batch.length,
      isProcessing: this.batchTimeout !== null
    };
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    this.batch.forEach(item => {
      item.reject(new Error('Batch handler cleared'));
    });
    this.batch = [];
  }
}