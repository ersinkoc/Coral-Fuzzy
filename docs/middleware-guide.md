# Middleware Guide

Middleware allows you to intercept and modify requests and responses in your application.

## Creating Middleware

```typescript
const loggingMiddleware = {
  name: 'logger',
  pre: async (config) => {
    console.log(`Request to ${config.url}`);
    config.metadata = {
      startTime: Date.now()
    };
    return config;
  },
  post: async (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`Response from ${response.config.url} took ${duration}ms`);
    return response;
  },
  error: async (error) => {
    console.error(`Request failed: ${error.message}`);
    return error;
  }
};
```

## Using Middleware

```typescript
const client = new CoralFuzzy();

// Add middleware
client.use(loggingMiddleware);

// Multiple middleware
client.use(authMiddleware);
client.use(cacheMiddleware);
client.use(retryMiddleware);
```

## Common Middleware Examples

### Authentication Middleware

```typescript
const authMiddleware = {
  name: 'auth',
  pre: async (config) => {
    const token = await getAuthToken();
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
    return config;
  },
  error: async (error) => {
    if (error.response?.status === 401) {
      await refreshToken();
      return client.request(error.config);
    }
    return Promise.reject(error);
  }
};
```

### Caching Middleware

```typescript
const cacheMiddleware = {
  name: 'cache',
  pre: async (config) => {
    const cached = await getCachedResponse(config);
    if (cached) {
      return Promise.reject({
        config,
        response: cached,
        cached: true
      });
    }
    return config;
  },
  post: async (response) => {
    if (response.config.method === 'GET') {
      await cacheResponse(response);
    }
    return response;
  }
};
```

### Retry Middleware

```typescript
const retryMiddleware = {
  name: 'retry',
  error: async (error) => {
    if (error.config.retryCount < 3) {
      error.config.retryCount = (error.config.retryCount || 0) + 1;
      await delay(1000 * error.config.retryCount);
      return client.request(error.config);
    }
    return Promise.reject(error);
  }
};
```

## Middleware Order

Middleware execution order:

1. Pre-request middleware (in order of registration)
2. Request execution
3. Post-response middleware (in reverse order)
4. Error middleware (if error occurs)

```typescript
client.use(firstMiddleware);   // Executes first pre, last post
client.use(secondMiddleware);  // Executes second pre, second-to-last post
client.use(thirdMiddleware);   // Executes last pre, first post
```

## Best Practices

1. **Naming**: Give middleware descriptive names
2. **Error Handling**: Always handle errors appropriately
3. **Async Operations**: Use async/await for consistency
4. **Configuration**: Make middleware configurable
5. **Composition**: Keep middleware focused and composable

## TypeScript Support

```typescript
import { Middleware, RequestConfig, Response, CoralError } from 'coral-fuzzy';

const typedMiddleware: Middleware = {
  name: 'typed',
  pre: async (config: RequestConfig) => {
    // Type-safe config manipulation
    return config;
  },
  post: async (response: Response<any>) => {
    // Type-safe response handling
    return response;
  },
  error: async (error: CoralError) => {
    // Type-safe error handling
    return error;
  }
};
```

## Next Steps

- Explore [Plugin System](./plugin-system.md)
- Learn about [Security Features](./security-features.md)
- Check out [Performance Optimization](./performance-optimization.md) 