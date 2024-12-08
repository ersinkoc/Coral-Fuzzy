import { BatchConfig, RequestConfig, Response } from '../types/index';

interface BatchItem<T> {
  config: RequestConfig;
  resolve: (response: Response<T>) => void;
  reject: (error: any) => void;
}

export class BatchHandler {
  private batch: BatchItem<any>[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private config: Required<BatchConfig>;

  constructor(config: BatchConfig = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 5,
      batchDelay: config.batchDelay ?? 50
    };
  }

  async execute<T>(
    request: (config: RequestConfig) => Promise<Response<T>>,
    config: RequestConfig
  ): Promise<Response<T>> {
    // Eğer batch özelliği kapalıysa veya POST/PUT/DELETE ise direkt çalıştır
    if (config.batch === false || ['POST', 'PUT', 'DELETE'].includes(config.method || 'GET')) {
      return request(config);
    }

    return new Promise((resolve, reject) => {
      this.batch.push({ config, resolve, reject });

      if (this.batch.length >= this.config.maxBatchSize) {
        this.processBatch(request);
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch(request);
        }, this.config.batchDelay);
      }
    });
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
      // Batch içindeki istekleri grupla
      const batchGroups = this.groupBatchRequests(currentBatch);

      // Her grup için paralel istek gönder
      await Promise.all(
        Object.entries(batchGroups).map(async ([key, items]) => {
          try {
            const batchConfig = this.createBatchConfig(items);
            const response = await request(batchConfig);
            
            // Başarılı yanıtı ilgili isteklere dağıt
            items.forEach(item => {
              item.resolve({
                ...response,
                config: item.config,
                data: this.extractResponseData(response.data, item.config)
              });
            });
          } catch (error) {
            // Hata durumunda tüm batch'i reddet
            items.forEach(item => item.reject(error));
          }
        })
      );
    } catch (error) {
      // Genel hata durumunda tüm batch'i reddet
      currentBatch.forEach(item => item.reject(error));
    }
  }

  private groupBatchRequests(batch: BatchItem<any>[]): Record<string, BatchItem<any>[]> {
    return batch.reduce((groups, item) => {
      const key = this.getBatchKey(item.config);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, BatchItem<any>[]>);
  }

  private getBatchKey(config: RequestConfig): string {
    const { baseURL, url, method = 'GET' } = config;
    return `${baseURL || ''}|${url || ''}|${method}`;
  }

  private createBatchConfig(items: BatchItem<any>[]): RequestConfig {
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

  private extractResponseData(data: any, config: RequestConfig): any {
    // URL'den veri ID'sini çıkar
    const urlParts = (config.url || '').split('/');
    const id = urlParts[urlParts.length - 1];
    
    // Eğer batch response bir array ise ve ID varsa
    if (Array.isArray(data) && id) {
      return data.find(item => item.id === id) || data;
    }
    
    return data;
  }

  getStats(): {
    currentBatchSize: number;
    isProcessing: boolean;
  } {
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