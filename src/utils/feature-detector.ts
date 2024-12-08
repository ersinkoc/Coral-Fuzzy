export interface BrowserFeatures {
  fetch: boolean;
  xhr: boolean;
  streams: boolean;
  webCrypto: boolean;
  serviceWorker: boolean;
  webSocket: boolean;
  compression: boolean;
  storage: {
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
  };
  performance: {
    timing: boolean;
    memory: boolean;
    observer: boolean;
  };
  network: {
    online: boolean;
    connection: boolean;
  };
}

export class FeatureDetector {
  private static instance: FeatureDetector;
  private features: BrowserFeatures;

  private constructor() {
    this.features = this.detectFeatures();
  }

  static getInstance(): FeatureDetector {
    if (!FeatureDetector.instance) {
      FeatureDetector.instance = new FeatureDetector();
    }
    return FeatureDetector.instance;
  }

  private detectFeatures(): BrowserFeatures {
    return {
      fetch: typeof fetch !== 'undefined',
      xhr: typeof XMLHttpRequest !== 'undefined',
      streams: typeof ReadableStream !== 'undefined',
      webCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
      serviceWorker: 'serviceWorker' in navigator,
      webSocket: typeof WebSocket !== 'undefined',
      compression: typeof CompressionStream !== 'undefined',
      storage: {
        localStorage: this.checkStorage('localStorage'),
        sessionStorage: this.checkStorage('sessionStorage'),
        indexedDB: 'indexedDB' in window
      },
      performance: {
        timing: 'performance' in window,
        memory: !!(performance as any).memory,
        observer: typeof PerformanceObserver !== 'undefined'
      },
      network: {
        online: 'onLine' in navigator,
        connection: 'connection' in navigator
      }
    };
  }

  private checkStorage(type: 'localStorage' | 'sessionStorage'): boolean {
    try {
      const storage = window[type];
      const testKey = '__test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getFeatures(): BrowserFeatures {
    return { ...this.features };
  }

  hasFeature(feature: keyof BrowserFeatures): boolean {
    if (typeof this.features[feature] === 'boolean') {
      return this.features[feature] as boolean;
    }
    return false;
  }

  hasStorageFeature(feature: keyof BrowserFeatures['storage']): boolean {
    return this.features.storage[feature];
  }

  hasPerformanceFeature(feature: keyof BrowserFeatures['performance']): boolean {
    return this.features.performance[feature];
  }

  hasNetworkFeature(feature: keyof BrowserFeatures['network']): boolean {
    return this.features.network[feature];
  }

  getPolyfillsNeeded(): string[] {
    const polyfills: string[] = [];

    if (!this.features.fetch) polyfills.push('fetch');
    if (!this.features.streams) polyfills.push('streams');
    if (!this.features.webCrypto) polyfills.push('web-crypto');
    if (!this.features.compression) polyfills.push('compression-streams');

    return polyfills;
  }

  getBrowserCapabilities(): {
    modern: boolean;
    supported: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let modern = true;
    let supported = true;

    // Check for modern browser features
    if (!this.features.fetch || !this.features.streams) {
      modern = false;
      warnings.push('Browser lacks modern fetch or streams support');
    }

    if (!this.features.webCrypto) {
      modern = false;
      warnings.push('Browser lacks Web Crypto API support');
    }

    // Check for minimum required features
    if (!this.features.xhr) {
      supported = false;
      warnings.push('Browser lacks XMLHttpRequest support');
    }

    if (!this.features.storage.localStorage) {
      warnings.push('Browser lacks localStorage support');
    }

    return {
      modern,
      supported,
      warnings
    };
  }

  watchFeatures(callback: (features: BrowserFeatures) => void): () => void {
    const networkHandler = () => {
      this.features.network.online = navigator.onLine;
      callback(this.getFeatures());
    };

    window.addEventListener('online', networkHandler);
    window.addEventListener('offline', networkHandler);

    if ('connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', () => {
        callback(this.getFeatures());
      });
    }

    return () => {
      window.removeEventListener('online', networkHandler);
      window.removeEventListener('offline', networkHandler);
      if ('connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', () => {});
      }
    };
  }
} 