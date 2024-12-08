# Error Handling

Comprehensive guide to error handling in Coral Fuzzy.

## Error Types

```typescript
import { CoralError, NetworkError, TimeoutError, ValidationError } from 'coral-fuzzy';

// Basic error handling
try {
  const response = await client.get('/api/data');
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.details);
  } else if (error instanceof CoralError) {
    console.error('Coral error:', error.message);
  }
}
```

## Global Error Handler

```typescript
const client = new CoralFuzzy({
  errorHandler: {
    onError: (error) => {
      if (error.response) {
        // Server responded with error status
        console.error('Server Error:', {
          status: error.response.status,
          data: error.response.data
        });
      } else if (error.request) {
        // Request made but no response
        console.error('Network Error:', error.request);
      } else {
        // Error in request setup
        console.error('Request Error:', error.message);
      }
    }
  }
});
```

## Retry on Error

```typescript
const client = new CoralFuzzy({
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      return (
        error instanceof NetworkError ||
        (error.response && error.response.status >= 500)
      );
    }
  }
});
```

## Error Transformation

```typescript
const client = new CoralFuzzy({
  errorHandler: {
    transform: (error) => {
      if (error.response?.status === 401) {
        return new AuthenticationError('Authentication failed');
      }
      if (error.response?.status === 403) {
        return new AuthorizationError('Access denied');
      }
      return error;
    }
  }
});
```

## Custom Error Classes

```typescript
class BusinessError extends CoralError {
  constructor(message: string, code: string) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
  }
}

const client = new CoralFuzzy({
  errorHandler: {
    transform: (error) => {
      if (error.response?.data?.businessCode) {
        return new BusinessError(
          error.response.data.message,
          error.response.data.businessCode
        );
      }
      return error;
    }
  }
});
```

## Error Recovery

```typescript
const client = new CoralFuzzy({
  errorHandler: {
    recover: async (error) => {
      if (error.response?.status === 401) {
        // Try to refresh token
        await refreshToken();
        // Retry original request
        return client.request(error.config);
      }
      throw error;
    }
  }
});
```

## Error Logging

```typescript
const client = new CoralFuzzy({
  errorHandler: {
    log: (error) => {
      // Log to external service
      errorLogger.log({
        type: error.name,
        message: error.message,
        stack: error.stack,
        request: {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        },
        response: error.response && {
          status: error.response.status,
          data: error.response.data
        }
      });
    }
  }
});
```

## Error Response Handling

```typescript
const client = new CoralFuzzy({
  validateStatus: (status) => {
    return status >= 200 && status < 300;
  },
  errorHandler: {
    parseError: (response) => {
      return {
        message: response.data.message || 'Unknown error',
        code: response.data.code,
        details: response.data.details
      };
    }
  }
});
```

## Best Practices

1. **Use Specific Error Types**: Create custom error classes for different scenarios
2. **Implement Recovery Logic**: Add recovery strategies for common errors
3. **Log Errors Properly**: Include relevant context in error logs
4. **Handle Async Errors**: Use try/catch with async/await
5. **Validate Responses**: Set appropriate status validation
6. **Transform Errors**: Convert error responses to meaningful formats
7. **Provide Feedback**: Give users helpful error messages

## Next Steps

- Check out [API Reference](./api-reference.md)
- Explore [Migration Guide](./migration-guide.md)
- Learn about [Testing](./testing.md) 