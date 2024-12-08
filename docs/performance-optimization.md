# Performance Optimization

Guide to optimizing performance with Coral Fuzzy.

## Caching Strategies

### Memory Cache

```typescript
const client = new CoralFuzzy({
  cache: {
    storage: 'memory',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Maximum items in cache
    exclude: {
      query: true,
      paths: ['/auth'],
      methods: ['POST', 'PUT', 'DELETE']
    }
  }
});
```

### Persistent Cache

```typescript
const client = new CoralFuzzy({
  cache: {
    storage: 'localStorage',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    compression: true, // Compress cached data
    encryption: true  // Encrypt sensitive data
  }
});
```

## Request Optimization

### Request Batching

```typescript
const client = new CoralFuzzy({
  batch: {
    enabled: true,
    maxSize: 5,
    delay: 50,
    endpoints: {
      '/api/users': true,
      '/api/posts': true
    }
  }
});

// Requests are automatically batched
const [users, posts] = await Promise.all([
  client.get('/api/users'),
  client.get('/api/posts')
]);
```

### Request Deduplication

```typescript
const client = new CoralFuzzy({
  deduplication: {
    enabled: true,
    cacheTime: 1000, // Deduplicate identical requests within 1 second
    methods: ['GET']
  }
});
```

## Response Optimization

### Compression

```typescript
const client = new CoralFuzzy({
  compression: {
    enabled: true,
    threshold: 1024, // Compress responses larger than 1KB
    algorithm: 'gzip',
    level: 6 // Compression level (1-9)
  }
});
```

### Streaming

```typescript
const client = new CoralFuzzy({
  streaming: {
    enabled: true,
    chunkSize: 16384,
    onProgress: (progress) => {
      console.log(`Downloaded: ${progress.loaded}/${progress.total} bytes`);
    }
  }
});
```

## Connection Optimization

### Keep-Alive

```typescript
const client = new CoralFuzzy({
  keepAlive: {
    enabled: true,
    maxSockets: 10,
    maxFreeSockets: 2,
    timeout: 60000
  }
});
```

### Connection Pooling

```typescript
const client = new CoralFuzzy({
  pool: {
    maxSize: 10,
    minSize: 2,
    timeout: 30000,
    idle: 10000
  }
});
```

## Resource Management

### Memory Management

```typescript
const client = new CoralFuzzy({
  memory: {
    maxSize: 50 * 1024 * 1024, // 50MB max memory usage
    gcInterval: 60000, // Garbage collection interval
    onLimitReached: 'clear' // 'clear' | 'error' | 'warn'
  }
});
```

### Request Prioritization

```typescript
const client = new CoralFuzzy({
  priority: {
    enabled: true,
    levels: {
      high: { weight: 3, timeout: 5000 },
      normal: { weight: 2, timeout: 10000 },
      low: { weight: 1, timeout: 30000 }
    }
  }
});

// High priority request
await client.get('/important', { priority: 'high' });
```

## Monitoring and Metrics

### Performance Metrics

```typescript
const client = new CoralFuzzy({
  metrics: {
    enabled: true,
    collect: {
      timing: true,
      memory: true,
      cache: true,
      network: true
    }
  }
});

// Get performance metrics
const metrics = client.getMetrics();
console.log(metrics.averageResponseTime);
console.log(metrics.cacheHitRate);
console.log(metrics.networkUsage);
```

### Performance Tracing

```typescript
const client = new CoralFuzzy({
  tracing: {
    enabled: true,
    sampleRate: 0.1, // Trace 10% of requests
    exporters: ['console', 'jaeger'],
    tags: {
      service: 'my-app',
      version: '1.0.0'
    }
  }
});
```

## Best Practices

1. **Use Appropriate Caching**: Choose the right caching strategy
2. **Enable Compression**: For large responses
3. **Batch Related Requests**: Reduce network overhead
4. **Monitor Performance**: Track metrics and optimize
5. **Resource Limits**: Set appropriate limits
6. **Connection Pooling**: Reuse connections
7. **Request Priority**: Prioritize important requests

## Next Steps

- Learn about [Error Handling](./error-handling.md)
- Check out [API Reference](./api-reference.md)
- Explore [Migration Guide](./migration-guide.md) 