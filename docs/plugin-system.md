# Plugin System

Coral Fuzzy provides a powerful plugin system that allows you to extend its functionality. Plugins can add new features, modify behavior, and integrate with other tools and services.

## Using Plugins

```typescript
import { CoralFuzzy } from 'coral-fuzzy';
import { loggingPlugin, metricsPlugin, authPlugin } from 'coral-fuzzy/plugins';

const client = new CoralFuzzy();

// Install plugins
await client.usePlugin(loggingPlugin);
await client.usePlugin(metricsPlugin);
await client.usePlugin(authPlugin, {
  getToken: async () => 'your-auth-token'
});
```

## Built-in Plugins

### Logging Plugin

Provides detailed request and response logging:

```typescript
await client.usePlugin(loggingPlugin);

// Now all requests will be logged:
// Request: GET https://api.example.com/users
// Response: 200 OK
```

### Metrics Plugin

Collects performance metrics and statistics:

```typescript
await client.usePlugin(metricsPlugin);

// Get metrics
const metrics = client.getMetrics();
console.log(metrics.totalRequests);    // Total number of requests
console.log(metrics.errorRate);        // Error rate
console.log(metrics.averageTime);      // Average response time
```

### Auth Plugin

Handles authentication and token management:

```typescript
await client.usePlugin(authPlugin, {
  getToken: async () => {
    // Your token retrieval logic
    return localStorage.getItem('auth_token');
  }
});

// Requests will automatically include the auth token
const response = await client.get('/protected-resource');
```

### Offline Plugin

Handles offline scenarios and request queueing:

```typescript
await client.usePlugin(offlinePlugin);

// Requests will fail gracefully when offline
try {
  await client.get('/api/data');
} catch (error) {
  if (error.message === 'No internet connection') {
    // Handle offline scenario
  }
}
```

## Creating Custom Plugins

You can create your own plugins by implementing the `Plugin` interface:

```typescript
import { Plugin, CoralFuzzyInstance } from 'coral-fuzzy';

const customPlugin: Plugin = {
  name: 'custom-plugin',
  async install(client: CoralFuzzyInstance, options?: any) {
    // Add middleware
    client.use({
      name: 'custom-middleware',
      pre: async (config) => {
        // Modify request config
        return config;
      },
      post: async (response) => {
        // Process response
        return response;
      },
      error: async (error) => {
        // Handle errors
        throw error;
      }
    });

    // Add custom functionality
    (client as any).customFeature = () => {
      // Your custom feature implementation
    };
  }
};

// Use your custom plugin
await client.usePlugin(customPlugin, {
  // Plugin options
});
```

## Plugin Development Guidelines

1. **Naming**: Use clear, descriptive names for your plugins
2. **Error Handling**: Properly handle and propagate errors
3. **Cleanup**: Clean up resources when plugins are removed
4. **Documentation**: Document your plugin's features and options
5. **Testing**: Write tests for your plugin's functionality

## Plugin Lifecycle

1. **Registration**: Plugin is registered with `usePlugin()`
2. **Installation**: Plugin's `install()` method is called
3. **Configuration**: Plugin configures itself with provided options
4. **Usage**: Plugin functionality is available
5. **Removal**: Plugin can be removed with `removePlugin()`

## Best Practices

1. **Modularity**: Keep plugins focused on specific functionality
2. **Dependencies**: Clearly document plugin dependencies
3. **Performance**: Minimize performance impact
4. **Compatibility**: Test compatibility with other plugins
5. **Configuration**: Make plugins configurable for flexibility
 