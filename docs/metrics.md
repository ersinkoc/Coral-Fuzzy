# Metrics & Monitoring

Coral Fuzzy provides comprehensive metrics and monitoring capabilities to help you understand your application's HTTP performance and behavior.

[← Back to Documentation](README.md) | [Performance Optimization →](performance.md)

## Table of Contents
- [Configuration](#configuration)
- [Available Metrics](#available-metrics)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Integration with Monitoring Systems](#integration-with-monitoring-systems)
- [TypeScript Support](#typescript-support)

## Related Documentation
- [Performance Optimization](performance.md)
- [Error Handling](error-handling.md)
- [Advanced Features](advanced-features.md)

## Configuration

```typescript
const client = new CoralFuzzy({
  metrics: {
    enabled: true,
    sampleRate: 1.0,    // Sample 100% of requests
    historySize: 1000   // Keep last 1000 requests in memory
  }
});
```

## Available Metrics

### Request Metrics
- Start time
- End time
- Duration
- Method
- URL
- Status code
- Response size
- Cache status
- Success/Error status
- Error details (if any)

### Performance Metrics
- Average response time
- Success rate
- Error rate
- Total requests
- Active requests
- Status code distribution
- Cache statistics
  - Hit rate
  - Miss rate
  - Hit/Miss ratio
- Compression statistics
  - Compressed requests
  - Uncompressed requests
  - Average compression ratio
- Timeout rate
- Retry statistics
  - Total retries
  - Average retries per request

## Usage Examples

### Getting Overall Statistics
```typescript
const stats = client.getStats();
console.log('Performance metrics:', stats.performance);
console.log('Recent requests:', stats.requests);
```

### Monitoring Cache Performance
```typescript
const stats = client.getStats();
const cacheStats = stats.performance.cachingStats;
console.log(`Cache hit rate: ${cacheStats.ratio}`);
console.log(`Cache hits: ${cacheStats.hits}`);
console.log(`Cache misses: ${cacheStats.misses}`);
```

### Tracking Response Times
```typescript
const stats = client.getStats();
console.log(`Average response time: ${stats.performance.averageResponseTime}ms`);
```

### Error Monitoring
```typescript
const stats = client.getStats();
console.log(`Error rate: ${stats.performance.errorRate * 100}%`);
console.log(`Success rate: ${stats.performance.successRate * 100}%`);
```

## Best Practices

1. **Sample Rate Adjustment**
   - Use lower sample rates in high-traffic applications
   - Increase sample rate for debugging

2. **History Size Management**
   - Adjust based on memory constraints
   - Consider application requirements

3. **Regular Monitoring**
   - Implement periodic metrics collection
   - Set up alerts for anomalies

4. **Performance Impact**
   - Monitor the overhead of metrics collection
   - Disable metrics in performance-critical scenarios

## Integration with Monitoring Systems

### Custom Metrics Export
```typescript
client.use({
  name: 'metrics-export',
  post: async (response) => {
    const stats = client.getStats();
    await sendToMonitoringSystem(stats);
    return response;
  }
});
```

### Error Tracking Integration
```typescript
client.use({
  name: 'error-tracking',
  error: async (error) => {
    const stats = client.getStats();
    await errorTrackingSystem.report({
      error,
      metrics: stats.performance
    });
    throw error;
  }
});
```

## TypeScript Support

```typescript
import { RequestMetrics, PerformanceMetrics } from 'coral-fuzzy';

interface MetricsResponse {
  requests: RequestMetrics[];
  performance: PerformanceMetrics;
}

const stats: MetricsResponse = client.getStats();
``` 