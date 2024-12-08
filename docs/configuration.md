# Configuration Guide

Complete guide to configuring Coral Fuzzy.

## Basic Configuration

```typescript
const client = new CoralFuzzy({
  // Base configuration
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});
```

## Advanced Configuration

```typescript
const client = new CoralFuzzy({
  // Request configuration
  baseURL: 'https://api.example.com',
  timeout: 5000,
  withCredentials: true,
  responseType: 'json',
  validateStatus: (status) => status >= 200 && status < 300,

  // Headers
  headers: {
    common: {
      'Accept': 'application/json'
    },
    post: {
      'Content-Type': 'application/json'
    }
  },

  // Authentication
  auth: {
    username: 'user',
    password: 'pass'
  },

  // Proxy configuration
  proxy: {
    host: 'proxy.example.com',
    port: 8080,
    auth: {
      username: 'proxy-user',
      password: 'proxy-pass'
    }
  }
});
```

## Feature Configuration

### Cache Configuration

```typescript
const client = new CoralFuzzy({
  cache: {
    storage: 'memory',
    maxAge: 5 * 60 * 1000,
    exclude: {
      query: true,
      paths: ['/auth'],
      methods: ['POST', 'PUT', 'DELETE']
    }
  }
});
```

### Retry Configuration

```typescript
const client = new CoralFuzzy({
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      return !error.response || error.response.status >= 500;
    }
  }
});
```

### Rate Limit Configuration

```typescript
const client = new CoralFuzzy({
  rateLimit: {
    maxRequests: 100,
    perMilliseconds: 60000,
    maxConcurrent: 10
  }
});
```

### Security Configuration

```typescript
const client = new CoralFuzzy({
  security: {
    ssl: {
      enabled: true,
      verifyHost: true
    },
    csrf: {
      enabled: true,
      cookieName: 'XSRF-TOKEN'
    },
    headers: {
      'Strict-Transport-Security': 'max-age=31536000'
    }
  }
});
```

## Environment-based Configuration

```typescript
const config = {
  development: {
    baseURL: 'http://localhost:3000',
    timeout: 1000,
    logging: true
  },
  production: {
    baseURL: 'https://api.example.com',
    timeout: 5000,
    logging: false
  }
};

const client = new CoralFuzzy(config[process.env.NODE_ENV]);
```

## Dynamic Configuration

```typescript
// Create instance
const client = new CoralFuzzy();

// Update configuration
client.setConfig({
  timeout: 10000
});

// Update headers
client.setHeaders({
  'Authorization': `Bearer ${token}`
});

// Update base URL
client.setBaseURL('https://new-api.example.com');
```

## Instance Configuration

```typescript
// Create default instance
const defaultClient = new CoralFuzzy({
  baseURL: 'https://api.example.com'
});

// Create custom instance
const customClient = defaultClient.create({
  baseURL: 'https://other-api.example.com',
  timeout: 3000
});
```

## Configuration Inheritance

```typescript
// Parent configuration
const parentConfig = {
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
};

// Child configuration
const childConfig = {
  ...parentConfig,
  headers: {
    ...parentConfig.headers,
    'Authorization': 'Bearer token'
  }
};

const client = new CoralFuzzy(childConfig);
```

## Best Practices

1. **Environment Variables**: Use environment variables for sensitive data
2. **Configuration Files**: Separate configuration by environment
3. **Type Safety**: Use TypeScript interfaces for configuration
4. **Validation**: Validate configuration values
5. **Defaults**: Provide sensible default values
6. **Documentation**: Document all configuration options
7. **Security**: Never commit sensitive configuration

## Next Steps

- Learn about [Advanced Features](./advanced-features.md)
- Explore [Security Features](./security-features.md)
- Check out [API Reference](./api-reference.md) 