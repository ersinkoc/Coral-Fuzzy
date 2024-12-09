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

### Network Metrics
- URL
- Method
- Start time
- End time
- Duration
- Status code
- Response size
- Time to first byte
- Download time
- Error details (if any)

### Performance Metrics
- Latency (min, max, avg)
- Time to first byte (min, max, avg)
- Download time (min, max, avg)
- Success rate
- Error rate
- Total requests
- Active requests

### Cache Metrics
- Hits
- Misses
- Hit rate
- Total requests
- Cache size
- Number of entries

### Compression Metrics
- Original size
- Compressed size
- Compression ratio
- Number of compressed requests

### Error Metrics
- Total errors
- Error types distribution
- Error rate by type

## Usage Examples

### Getting Overall Statistics
```typescript
const stats = client.metrics.getStats();
console.log('Network performance:', stats.network);
console.log('Cache performance:', stats.cache);
console.log('Compression stats:', stats.compression);
console.log('Error stats:', stats.errors);
```

### Monitoring Network Performance
```typescript
const stats = client.metrics.getStats();
const networkStats = stats.network;

console.log(`Average latency: ${networkStats.latency.avg}ms`);
console.log(`Time to first byte: ${networkStats.timeToFirstByte.avg}ms`);
console.log(`Download time: ${networkStats.downloadTime.avg}ms`);
```

### Tracking Cache Performance
```typescript
const stats = client.metrics.getStats();
const cacheStats = stats.cache;

console.log(`Cache hit rate: ${cacheStats.hitRate * 100}%`);
console.log(`Cache hits: ${cacheStats.hits}`);
console.log(`Cache misses: ${cacheStats.misses}`);
```

### Monitoring Compression
```typescript
const stats = client.metrics.getStats();
const compressionStats = stats.compression;

console.log(`Compression ratio: ${compressionStats.compressionRatio * 100}%`);
console.log(`Total size saved: ${compressionStats.totalOriginalSize - compressionStats.totalCompressedSize} bytes`);
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
    const stats = client.metrics.getStats();
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
    const stats = client.metrics.getStats();
    await errorTrackingSystem.report({
      error,
      metrics: stats
    });
    throw error;
  }
});
```

## TypeScript Support

```typescript
interface MetricsConfig {
  enabled?: boolean;
  sampleRate?: number;
  historySize?: number;
}

interface NetworkMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  size: number;
  timeToFirstByte?: number;
  downloadTime?: number;
  error?: Error;
}

interface PerformanceMetrics {
  min: number;
  max: number;
  avg: number;
  count: number;
  total: number;
}

interface NetworkStats {
  latency: PerformanceMetrics;
  timeToFirstByte: PerformanceMetrics;
  downloadTime: PerformanceMetrics;
}
``` 