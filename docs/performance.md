# Performance Optimization

Coral Fuzzy provides several features to optimize performance and handle high-load scenarios.

[← Back to Documentation](README.md) | [Metrics & Monitoring →](metrics.md)

## Table of Contents
- [Request Pooling](#request-pooling)
- [Response Compression](#response-compression)
- [Rate Limiting](#rate-limiting)
- [Circuit Breaker](#circuit-breaker)
- [Best Practices](#best-practices)
- [Monitoring](#monitoring)
- [TypeScript Support](#typescript-support)

## Related Documentation
- [Metrics & Monitoring](metrics.md)
- [Advanced Protocols](protocols.md)
- [Error Handling](error-handling.md)

## Request Pooling

### Configuration
```typescript
const client = new CoralFuzzy({
  maxConcurrent: 10,        // Maximum concurrent requests
  requestsPerSecond: 50     // Rate limiting
});
```

### How It Works
- Manages concurrent requests
- Queues excess requests
- Implements rate limiting
- Prioritizes critical requests

### Usage
```typescript
// High priority request
await client.get('/critical-endpoint', { priority: 10 });

// Normal request
await client.get('/normal-endpoint');

// Low priority request
await client.get('/background-task', { priority: -1 });
```

## Response Compression

### Configuration
```typescript
const client = new CoralFuzzy({
  compression: {
    enabled: true,
    threshold: 1024,        // Compress responses larger than 1KB
    algorithm: 'gzip'       // 'gzip' or 'deflate'
  }
});
```

### Features
- Automatic compression detection
- Configurable compression threshold
- Multiple compression algorithms
- Transparent decompression

## Rate Limiting

### Configuration
```typescript
const client = new CoralFuzzy({
  rateLimit: {
    maxRequests: 50,        // Maximum requests
    perMilliseconds: 1000,  // Time window
    maxConcurrent: 10       // Concurrent requests
  }
});
```

### Features
- Request throttling
- Configurable time windows
- Concurrent request limiting
- Queue management

## Circuit Breaker

### Configuration
```typescript
const client = new CoralFuzzy({
  circuitBreaker: {
    failureThreshold: 5,    // Number of failures before opening
    resetTimeout: 30000,    // Time before retry (30 seconds)
    monitorTimeout: 10000   // Health check interval
  }
});
```

### States
1. **Closed** (Normal operation)
2. **Open** (Failing, no requests allowed)
3. **Half-Open** (Testing recovery)

### Usage
```typescript
try {
  await client.get('/api/endpoint');
} catch (error) {
  if (error.code === 'CIRCUIT_OPEN') {
    console.log('Circuit breaker is open, service is unavailable');
  }
}
```

## Best Practices

### Request Management
```typescript
// Group similar requests
const batchHandler = new BatchHandler({
  maxBatchSize: 5,
  batchDelay: 50
});

// Handle multiple requests efficiently
const responses = await Promise.all([
  client.get('/api/1'),
  client.get('/api/2'),
  client.get('/api/3')
]);
```

### Error Handling
```typescript
// Implement retry with backoff
const client = new CoralFuzzy({
  retry: {
    maxRetries: 3,
    retryDelay: (retryCount) => Math.pow(2, retryCount) * 1000,
    retryCondition: (error) => {
      return error.status === 429 || error.status >= 500;
    }
  }
});
```

### Resource Management
```typescript
// Clean up resources
client.on('beforeunload', () => {
  client.clearBatch();
  client.disconnect();
});
```

## Monitoring

### Performance Metrics
```typescript
const stats = client.getStats();
console.log('Active requests:', stats.performance.activeRequests);
console.log('Queue size:', client.getQueuedRequests());
```

### Circuit Breaker Status
```typescript
const status = client.circuitBreaker.getStatus();
console.log('Circuit state:', status.state);
console.log('Failure count:', status.failures);
```

### Rate Limit Monitoring
```typescript
const rateLimitStats = client.rateLimit.getStats();
console.log('Requests remaining:', rateLimitStats.remaining);
console.log('Reset time:', rateLimitStats.resetTime);
```

## TypeScript Support

```typescript
import { 
  CircuitBreakerState,
  RateLimitStats,
  CompressionStats 
} from 'coral-fuzzy';

// Type-safe configuration
interface PerformanceConfig {
  maxConcurrent: number;
  requestsPerSecond: number;
  compression: {
    enabled: boolean;
    threshold: number;
    algorithm: 'gzip' | 'deflate';
  };
}

// Type-safe metrics
interface PerformanceMetrics {
  activeRequests: number;
  queueSize: number;
  circuitState: CircuitBreakerState;
  rateLimitStats: RateLimitStats;
  compressionStats: CompressionStats;
}
``` 