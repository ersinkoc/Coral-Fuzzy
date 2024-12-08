# Request Batching

Coral Fuzzy provides automatic request batching to improve performance by grouping multiple requests together. This feature is particularly useful when making many small requests.

## Basic Usage

```typescript
const client = new CoralFuzzy({
  batch: {
    maxBatchSize: 5, // Maximum number of requests per batch
    batchDelay: 50   // Delay before processing batch (ms)
  }
});

// Requests will be automatically batched
const [users, posts, comments] = await Promise.all([
  client.get('/users/1'),
  client.get('/posts/1'),
  client.get('/comments/1')
]);
```

## Batch Configuration

```typescript
interface BatchConfig {
  maxBatchSize?: number;  // Default: 5
  batchDelay?: number;    // Default: 50ms
}
```

## Disabling Batching

You can disable batching for specific requests:

```typescript
// This request won't be batched
const response = await client.get('/users/1', {
  batch: false
});
```

## Batch Statistics

You can monitor the status of batch operations:

```typescript
const stats = client.getBatchStats();
console.log(stats.currentBatchSize); // Number of requests in current batch
console.log(stats.isProcessing);     // Whether a batch is being processed
```

## Important Notes

1. Only GET requests are batched
2. POST, PUT, DELETE requests are automatically excluded from batching
3. Responses from batched requests are distributed in the original request order
4. If any request in a batch fails, the entire batch is rejected

## Best Practice Examples

1. Fetching related data at once:
```typescript
const [user, posts, followers] = await Promise.all([
  client.get(`/users/${id}`),
  client.get(`/users/${id}/posts`),
  client.get(`/users/${id}/followers`)
]);
```

2. Parallel fetching of list data:
```typescript
const userIds = ['1', '2', '3', '4', '5'];
const users = await Promise.all(
  userIds.map(id => client.get(`/users/${id}`))
);
```

## Error Handling

```typescript
try {
  const responses = await Promise.all([
    client.get('/users/1'),
    client.get('/users/2'),
    client.get('/users/3')
  ]);
} catch (error) {
  if (error.batch) {
    console.error('Batch operation failed:', error.message);
  }
}
```

## Performance Tips

1. Adjust `maxBatchSize` according to your API limits
2. Optimize `batchDelay` based on your application needs
3. Try to make related requests simultaneously
4. Keep batch sizes small for large datasets