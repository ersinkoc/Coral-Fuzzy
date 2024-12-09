import { FeatureDetector, BrowserFeatures } from '../src/utils/feature-detector';

describe('FeatureDetector', () => {
  let featureDetector: FeatureDetector;

  beforeEach(() => {
    // Test ortamını temizle
    (global as any).window = {
      fetch: () => {},
      XMLHttpRequest: function() {},
      crypto: { subtle: {} },
      localStorage: {
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      sessionStorage: {
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      performance: {
        timing: {},
        memory: {},
        observer: {}
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    (global as any).navigator = {
      serviceWorker: {},
      onLine: true,
      connection: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      }
    };

    (global as any).WebSocket = function() {};
    (global as any).ReadableStream = function() {};
    (global as any).CompressionStream = function() {};

    // FeatureDetector örneğini yeniden oluştur
    featureDetector = FeatureDetector.getInstance();
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = FeatureDetector.getInstance();
      const instance2 = FeatureDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Feature Detection', () => {
    test('should detect fetch availability', () => {
      expect(featureDetector.hasFeature('fetch')).toBe(true);
      delete (global as any).window.fetch;
      // Yeni instance oluştur
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasFeature('fetch')).toBe(false);
    });

    test('should detect XHR availability', () => {
      expect(featureDetector.hasFeature('xhr')).toBe(true);
      delete (global as any).window.XMLHttpRequest;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasFeature('xhr')).toBe(false);
    });

    test('should detect WebSocket availability', () => {
      expect(featureDetector.hasFeature('webSocket')).toBe(true);
      delete (global as any).WebSocket;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasFeature('webSocket')).toBe(false);
    });
  });

  describe('Storage Features', () => {
    test('should detect localStorage availability', () => {
      expect(featureDetector.hasStorageFeature('localStorage')).toBe(true);
      
      // localStorage hatası simülasyonu
      (global as any).window.localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });
      
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasStorageFeature('localStorage')).toBe(false);
    });

    test('should detect sessionStorage availability', () => {
      expect(featureDetector.hasStorageFeature('sessionStorage')).toBe(true);
      delete (global as any).window.sessionStorage;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasStorageFeature('sessionStorage')).toBe(false);
    });
  });

  describe('Performance Features', () => {
    test('should detect performance timing', () => {
      expect(featureDetector.hasPerformanceFeature('timing')).toBe(true);
      delete (global as any).window.performance.timing;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasPerformanceFeature('timing')).toBe(false);
    });

    test('should detect performance memory', () => {
      expect(featureDetector.hasPerformanceFeature('memory')).toBe(true);
      delete (global as any).window.performance.memory;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasPerformanceFeature('memory')).toBe(false);
    });
  });

  describe('Network Features', () => {
    test('should detect online status', () => {
      expect(featureDetector.hasNetworkFeature('online')).toBe(true);
      delete (global as any).navigator.onLine;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasNetworkFeature('online')).toBe(false);
    });

    test('should detect connection API', () => {
      expect(featureDetector.hasNetworkFeature('connection')).toBe(true);
      delete (global as any).navigator.connection;
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.hasNetworkFeature('connection')).toBe(false);
    });
  });

  describe('Polyfills', () => {
    test('should return needed polyfills', () => {
      expect(featureDetector.getPolyfillsNeeded()).toEqual([]);
      
      delete (global as any).window.fetch;
      delete (global as any).ReadableStream;
      delete (global as any).window.crypto;
      delete (global as any).CompressionStream;
      
      featureDetector = FeatureDetector.getInstance();
      expect(featureDetector.getPolyfillsNeeded()).toEqual([
        'fetch',
        'streams',
        'web-crypto',
        'compression-streams'
      ]);
    });
  });

  describe('Browser Capabilities', () => {
    test('should detect modern browser', () => {
      const capabilities = featureDetector.getBrowserCapabilities();
      expect(capabilities.modern).toBe(true);
      expect(capabilities.supported).toBe(true);
      expect(capabilities.warnings).toEqual([]);
    });

    test('should detect legacy browser', () => {
      delete (global as any).window.fetch;
      delete (global as any).ReadableStream;
      featureDetector = FeatureDetector.getInstance();
      
      const capabilities = featureDetector.getBrowserCapabilities();
      expect(capabilities.modern).toBe(false);
      expect(capabilities.supported).toBe(true);
      expect(capabilities.warnings).toContain('Browser lacks modern fetch or streams support');
    });

    test('should detect unsupported browser', () => {
      delete (global as any).window.XMLHttpRequest;
      featureDetector = FeatureDetector.getInstance();
      
      const capabilities = featureDetector.getBrowserCapabilities();
      expect(capabilities.supported).toBe(false);
      expect(capabilities.warnings).toContain('Browser lacks XMLHttpRequest support');
    });
  });

  describe('Feature Watching', () => {
    test('should watch for network changes', () => {
      const callback = jest.fn();
      const unwatch = featureDetector.watchFeatures(callback);

      // Online event simülasyonu
      (global as any).navigator.onLine = false;
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      expect(callback).toHaveBeenCalled();
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));

      // Temizleme fonksiyonunu çağır
      unwatch();
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
}); 