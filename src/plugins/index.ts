import { Plugin, CoralFuzzyInstance } from '../types';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private client: CoralFuzzyInstance;

  constructor(client: CoralFuzzyInstance) {
    this.client = client;
  }

  async register(plugin: Plugin, options?: any): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }

    try {
      await plugin.install(this.client, options);
      this.plugins.set(plugin.name, plugin);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to install plugin '${plugin.name}': ${message}`);
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  removePlugin(name: string): boolean {
    return this.plugins.delete(name);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

// Example plugins
export const loggingPlugin: Plugin = {
  name: 'logging',
  async install(client: CoralFuzzyInstance) {
    client.use({
      name: 'logging-middleware',
      pre: async (config) => {
        console.group(`Request: ${config.method} ${config.url}`);
        console.log('Config:', config);
        console.groupEnd();
        return config;
      },
      post: async (response) => {
        console.group(`Response: ${response.status}`);
        console.log('Data:', response.data);
        console.groupEnd();
        return response;
      },
      error: async (error) => {
        console.group('Error');
        console.error(error);
        console.groupEnd();
        throw error;
      }
    });
  }
};

export const metricsPlugin: Plugin = {
  name: 'metrics',
  async install(client: CoralFuzzyInstance) {
    const metrics = {
      requests: 0,
      errors: 0,
      totalTime: 0
    };

    client.use({
      name: 'metrics-middleware',
      pre: async (config) => {
        config.metadata = config.metadata || {};
        config.metadata.startTime = performance.now();
        metrics.requests++;
        return config;
      },
      post: async (response) => {
        if (response.config.metadata?.startTime) {
          const duration = performance.now() - response.config.metadata.startTime;
          metrics.totalTime += duration;
        }
        return response;
      },
      error: async (error) => {
        metrics.errors++;
        throw error;
      }
    });

    // Add metrics API to client
    (client as any).getMetrics = () => ({
      totalRequests: metrics.requests,
      errorRate: metrics.errors / metrics.requests,
      averageTime: metrics.totalTime / metrics.requests
    });
  }
};

export const authPlugin: Plugin = {
  name: 'auth',
  async install(client: CoralFuzzyInstance, options: { getToken: () => Promise<string> }) {
    if (!options?.getToken) {
      throw new Error('Auth plugin requires a getToken function');
    }

    client.use({
      name: 'auth-middleware',
      pre: async (config) => {
        const token = await options.getToken();
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`
        };
        return config;
      },
      error: async (error) => {
        if (error.response?.status === 401) {
          // Handle token refresh or logout logic here
        }
        throw error;
      }
    });
  }
};

export const offlinePlugin: Plugin = {
  name: 'offline',
  async install(client: CoralFuzzyInstance) {
    let isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      isOnline = true;
    });

    window.addEventListener('offline', () => {
      isOnline = false;
    });

    client.use({
      name: 'offline-middleware',
      pre: async (config) => {
        if (!isOnline && !config.offline) {
          throw new Error('No internet connection');
        }
        return config;
      }
    });
  }
}; 