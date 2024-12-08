# Migration Guide

Guide for migrating from other HTTP clients to Coral Fuzzy.

## Migrating from Axios

### Basic Requests

```typescript
// Axios
import axios from 'axios';
const response = await axios.get('/users');

// Coral Fuzzy
import { CoralFuzzy } from 'coral-fuzzy';
const client = new CoralFuzzy();
const response = await client.get('/users');
```

### Configuration

```typescript
// Axios
const axios = require('axios');
const instance = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {'X-Custom-Header': 'value'}
});

// Coral Fuzzy
const client = new CoralFuzzy({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {'X-Custom-Header': 'value'}
});
```

### Interceptors

```typescript
// Axios
axios.interceptors.request.use(
  config => {
    config.headers.token = 'token';
    return config;
  },
  error => Promise.reject(error)
);

// Coral Fuzzy
client.use({
  name: 'auth',
  pre: async (config) => {
    config.headers.token = 'token';
    return config;
  }
});
```

## Migrating from Fetch

### Basic Requests

```typescript
// Fetch
const response = await fetch('/users');
const data = await response.json();

// Coral Fuzzy
const response = await client.get('/users');
const data = response.data; // Automatically parsed
```

### POST Requests

```typescript
// Fetch
const response = await fetch('/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});

// Coral Fuzzy
const response = await client.post('/users', data);
```

### Error Handling

```typescript
// Fetch
try {
  const response = await fetch('/users');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('Error:', error);
}

// Coral Fuzzy
try {
  const response = await client.get('/users');
  console.log(response.data);
} catch (error) {
  if (error.response) {
    console.error('Server Error:', error.response.status);
  } else {
    console.error('Error:', error.message);
  }
}
```

## Migrating from XMLHttpRequest

### Basic Requests

```typescript
// XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.open('GET', '/users');
xhr.onload = () => {
  if (xhr.status === 200) {
    const data = JSON.parse(xhr.responseText);
  }
};
xhr.send();

// Coral Fuzzy
const response = await client.get('/users');
const data = response.data;
```

### POST Requests

```typescript
// XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.open('POST', '/users');
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.onload = () => {
  if (xhr.status === 201) {
    const data = JSON.parse(xhr.responseText);
  }
};
xhr.send(JSON.stringify(data));

// Coral Fuzzy
const response = await client.post('/users', data);
```

## Feature Comparison

### Caching

```typescript
// Manual caching
const cache = new Map();

// Coral Fuzzy
const client = new CoralFuzzy({
  cache: {
    storage: 'memory',
    maxAge: 5 * 60 * 1000
  }
});
```

### Retry Logic

```typescript
// Manual retry
async function fetchWithRetry(url, retries = 3) {
  try {
    return await fetch(url);
  } catch (error) {
    if (retries > 0) {
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

// Coral Fuzzy
const client = new CoralFuzzy({
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  }
});
```

## Breaking Changes

1. **Response Format**: Different response structure
2. **Configuration**: New configuration options
3. **Error Handling**: Enhanced error types
4. **Middleware**: New middleware system
5. **TypeScript Support**: Improved type definitions

## Best Practices

1. **Gradual Migration**: Migrate one feature at a time
2. **Testing**: Write tests for migrated code
3. **Type Safety**: Use TypeScript for better migration
4. **Documentation**: Update documentation
5. **Error Handling**: Update error handling logic

## Next Steps

- Check out [Basic Usage](./basic-usage.md)
- Learn about [Advanced Features](./advanced-features.md)
- Explore [API Reference](./api-reference.md) 