# Advanced Features

## Caching

Coral Fuzzy provides a powerful caching system:

```typescript
const client = new CoralFuzzy({
  cache: {
    // Cache duration in milliseconds
    maxAge: 5 * 60 * 1000, // 5 minutes
    
    // Cache storage type
    storage: 'memory', // 'memory' | 'localStorage' | 'sessionStorage'
    
    // Cache exclusion rules
    exclude: {
      query: true, // Exclude URLs with query parameters
      paths: ['/auth', '/live'], // Exclude specific paths
      methods: ['POST', 'PUT', 'DELETE'] // Exclude specific methods
    }
  }
});

// Check if response was cached
const response = await client.get('/users');
console.log(response.cached); // true/false
```

## Request Retry

Automatic retry for failed requests:

```typescript
const client = new CoralFuzzy({
  retry: {
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    retryCondition: (error) => {
      // Retry on network errors or 5xx server errors
      return !error.response || error.response.status >= 500;
    }
  }
});
```

## Rate Limiting

Control request rates to prevent API throttling:

```typescript
const client = new CoralFuzzy({
  rateLimit: {
    maxRequests: 100, // Maximum requests
    perMilliseconds: 60000, // Time window (1 minute)
    maxConcurrent: 10 // Maximum concurrent requests
  }
});

// Get rate limit stats
const stats = client.getRateLimitStats();
console.log(stats.requestsInWindow);
console.log(stats.windowReset);
```

## Circuit Breaker

Prevent cascading failures:

```typescript
const client = new CoralFuzzy({
  circuitBreaker: {
    failureThreshold: 5, // Number of failures before opening
    resetTimeout: 60000, // Time before attempting to close (1 minute)
    requestTimeout: 5000 // Individual request timeout
  }
});

// Check circuit breaker state
const state = client.getCircuitBreakerState(); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
```

## Request Batching

Combine multiple requests:

```typescript
const client = new CoralFuzzy({
  batch: {
    maxBatchSize: 5, // Maximum requests per batch
    batchDelay: 50 // Delay before processing batch
  }
});

// Requests will be automatically batched
const [users, posts, comments] = await Promise.all([
  client.get('/users'),
  client.get('/posts'),
  client.get('/comments')
]);
```

## Compression

Automatic request/response compression:

```typescript
const client = new CoralFuzzy({
  compression: {
    threshold: 1024, // Minimum size for compression (1KB)
    algorithm: 'gzip', // Compression algorithm
    enabled: true
  }
});
```

## Performance Metrics

Track request performance:

```typescript
// Enable metrics collection
const client = new CoralFuzzy({
  metrics: {
    enabled: true,
    sampleRate: 1.0 // Sample 100% of requests
  }
});

// Get performance metrics
const metrics = client.getMetrics();
console.log(metrics.averageResponseTime);
console.log(metrics.successRate);
console.log(metrics.errorRate);
```

## Browser Feature Detection

Automatic feature detection and polyfill loading:

```typescript
const features = client.getFeatures();

// Check specific features
if (features.webCrypto) {
  // Use Web Crypto API
}

if (features.storage.indexedDB) {
  // Use IndexedDB
}

// Check performance features
if (features.performance.observer) {
  // Use Performance Observer
}
```

## Request Pooling

Manage concurrent requests:

```typescript
const client = new CoralFuzzy({
  pool: {
    maxSize: 10, // Maximum pool size
    timeout: 30000, // Pool timeout
    priorityQueue: true // Enable priority queue
  }
});

// High priority request
await client.get('/important', { priority: 'high' });

// Normal priority request
await client.get('/normal', { priority: 'normal' });
```

## Next Steps

- Learn about [Middleware Guide](./middleware-guide.md)
- Explore [Plugin System](./plugin-system.md)
- Check out [Security Features](./security-features.md)
