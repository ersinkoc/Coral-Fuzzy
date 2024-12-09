import { MetricsHandler } from '../src/utils/metrics';
import { NetworkMetrics } from '../src/types';

describe('MetricsHandler', () => {
  let metricsHandler: MetricsHandler;

  beforeEach(() => {
    metricsHandler = new MetricsHandler();
  });

  afterEach(() => {
    metricsHandler.clear();
  });

  describe('request tracking', () => {
    const createMetrics = (overrides: Partial<NetworkMetrics> = {}): NetworkMetrics => ({
      url: '/test',
      method: 'GET',
      startTime: Date.now(),
      endTime: Date.now() + 100,
      duration: 100,
      status: 200,
      size: 1024,
      ...overrides
    });

    it('should track successful requests', () => {
      const metrics = createMetrics();
      metricsHandler.trackRequest(metrics);

      const stats = metricsHandler.getStats();
      expect(stats.requests.total).toBe(1);
      expect(stats.requests.successful).toBe(1);
      expect(stats.requests.failed).toBe(0);
      expect(stats.requests.successRate).toBe(1);
    });

    it('should track failed requests', () => {
      const metrics = createMetrics({
        status: 500,
        error: new Error('Server error')
      });
      metricsHandler.trackRequest(metrics);

      const stats = metricsHandler.getStats();
      expect(stats.requests.total).toBe(1);
      expect(stats.requests.successful).toBe(0);
      expect(stats.requests.failed).toBe(1);
      expect(stats.requests.successRate).toBe(0);
    });

    it('should track network performance metrics', () => {
      const metrics = createMetrics({
        duration: 100,
        timeToFirstByte: 50,
        downloadTime: 30
      });
      metricsHandler.trackRequest(metrics);

      const stats = metricsHandler.getStats();
      expect(stats.network.latency.avg).toBe(100);
      expect(stats.network.timeToFirstByte.avg).toBe(50);
      expect(stats.network.downloadTime.avg).toBe(30);
    });

    it('should respect sample rate', () => {
      metricsHandler = new MetricsHandler({ sampleRate: 0 });
      const metrics = createMetrics();
      metricsHandler.trackRequest(metrics);

      const stats = metricsHandler.getStats();
      expect(stats.requests.total).toBe(0);
    });

    it('should maintain history size limit', () => {
      metricsHandler = new MetricsHandler({ historySize: 2 });
      
      metricsHandler.trackRequest(createMetrics({ url: '/test1' }));
      metricsHandler.trackRequest(createMetrics({ url: '/test2' }));
      metricsHandler.trackRequest(createMetrics({ url: '/test3' }));

      const stats = metricsHandler.getStats();
      expect(stats.requests.total).toBe(2);
    });
  });

  describe('cache tracking', () => {
    it('should track cache hits and misses', () => {
      metricsHandler.trackCache('/test', true);  // hit
      metricsHandler.trackCache('/test', true);  // hit
      metricsHandler.trackCache('/test', false); // miss

      const stats = metricsHandler.getStats();
      expect(stats.cache.hits).toBe(2);
      expect(stats.cache.misses).toBe(1);
      expect(stats.cache.hitRate).toBe(2/3);
    });
  });

  describe('compression tracking', () => {
    it('should track compression stats', () => {
      metricsHandler.trackCompression(1000, 400);  // 60% compression
      metricsHandler.trackCompression(2000, 800);  // 60% compression

      const stats = metricsHandler.getStats();
      expect(stats.compression.totalOriginalSize).toBe(3000);
      expect(stats.compression.totalCompressedSize).toBe(1200);
      expect(stats.compression.count).toBe(2);
      expect(stats.compression.compressionRatio).toBe(0.6);
    });
  });

  describe('error tracking', () => {
    it('should track error types', () => {
      metricsHandler.trackRequest(createMetrics({
        error: new TypeError('Type error')
      }));
      metricsHandler.trackRequest(createMetrics({
        error: new Error('Generic error')
      }));
      metricsHandler.trackRequest(createMetrics({
        error: new TypeError('Another type error')
      }));

      const stats = metricsHandler.getStats();
      expect(stats.errors.total).toBe(3);
      expect(stats.errors.types['TypeError']).toBe(2);
      expect(stats.errors.types['Error']).toBe(1);
    });
  });

  describe('performance metrics', () => {
    it('should calculate min, max, and average values', () => {
      metricsHandler.trackRequest(createMetrics({ duration: 100 }));
      metricsHandler.trackRequest(createMetrics({ duration: 200 }));
      metricsHandler.trackRequest(createMetrics({ duration: 300 }));

      const stats = metricsHandler.getStats();
      expect(stats.network.latency.min).toBe(100);
      expect(stats.network.latency.max).toBe(300);
      expect(stats.network.latency.avg).toBe(200);
    });
  });

  describe('clear', () => {
    it('should reset all metrics', () => {
      metricsHandler.trackRequest(createMetrics());
      metricsHandler.trackCache('/test', true);
      metricsHandler.trackCompression(1000, 400);

      metricsHandler.clear();

      const stats = metricsHandler.getStats();
      expect(stats.requests.total).toBe(0);
      expect(stats.cache.hits).toBe(0);
      expect(stats.compression.count).toBe(0);
      expect(stats.errors.total).toBe(0);
    });
  });
}); 