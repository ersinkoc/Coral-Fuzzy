# TypeScript Guide

## Overview

Coral Fuzzy is built with TypeScript and provides first-class TypeScript support. This guide covers TypeScript-specific features and best practices.

## Type Definitions

### Core Types

```typescript
// Request Configuration
interface RequestConfig {
  url: string;
  method: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: ResponseType;
  validateStatus?: (status: number) => boolean;
}

// Response Interface
interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
  request?: any;
}

// Error Types
interface CoralFuzzyError extends Error {
  config: RequestConfig;
  code?: string;
  request?: any;
  response?: Response;
  isCoralFuzzyError: boolean;
}
```

### Advanced Types

```typescript
// Plugin System
interface Plugin {
  name: string;
  install: (client: CoralFuzzyInstance) => void | Promise<void>;
}

// Middleware Interface
interface Middleware {
  pre?: (config: RequestConfig) => Promise<RequestConfig>;
  post?: (response: Response) => Promise<Response>;
  error?: (error: CoralFuzzyError) => Promise<Response | void>;
}

// Performance Metrics
interface PerformanceMetrics {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  cacheStats: CacheStats;
  compressionStats: CompressionStats;
  errorStats: ErrorStats;
}
```

## Generic Types

### Making Type-Safe Requests

```typescript
// Define your data types
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
}

// Use with type parameters
const client = new CoralFuzzy();

// GET request with type inference
const user = await client.get<User>('/users/1');
console.log(user.data.name); // TypeScript knows this is a string

// POST request with type checking
const newUser = await client.post<User, CreateUserData>('/users', {
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secure123'
  }
});
```

### Response Type Safety

```typescript
// Define response types
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Use with pagination
const response = await client.get<PaginatedResponse<User>>('/users', {
  params: {
    page: 1,
    pageSize: 10
  }
});

// TypeScript provides full type inference
console.log(response.data.total); // number
response.data.data.forEach(user => {
  console.log(user.name); // string
});
```

## Type Guards

```typescript
// Error type guard
function isCoralFuzzyError(error: any): error is CoralFuzzyError {
  return error?.isCoralFuzzyError === true;
}

// Usage
try {
  await client.get('/users');
} catch (error) {
  if (isCoralFuzzyError(error)) {
    // TypeScript knows this is a CoralFuzzyError
    console.error(error.config);
    console.error(error.response?.status);
  }
}
```

## Configuration Types

### Client Configuration

```typescript
interface CoralFuzzyConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  
  // Advanced features
  retry?: RetryConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  performance?: PerformanceConfig;
  metrics?: MetricsConfig;
}

// Type-safe configuration
const client = new CoralFuzzy({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
    retryCondition: (error) => {
      return error.response?.status === 429;
    }
  },
  cache: {
    maxAge: 5 * 60 * 1000,
    exclude: ['/auth']
  }
});
```

## Plugin Development

### Type-Safe Plugin Creation

```typescript
interface LoggerPlugin extends Plugin {
  name: 'logger';
  options?: {
    logLevel: 'info' | 'warn' | 'error';
    format?: (message: string) => string;
  };
}

// Create plugin with type safety
const loggerPlugin: LoggerPlugin = {
  name: 'logger',
  options: {
    logLevel: 'info',
    format: (message) => `[${new Date().toISOString()}] ${message}`
  },
  install: (client) => {
    client.use({
      pre: async (config) => {
        console.log(`Request: ${config.method} ${config.url}`);
        return config;
      },
      post: async (response) => {
        console.log(`Response: ${response.status}`);
        return response;
      }
    });
  }
};

// Use plugin
await client.usePlugin(loggerPlugin);
```

## Best Practices

1. **Always Use Type Annotations**
   ```typescript
   // Good
   const config: RequestConfig = {
     url: '/users',
     method: 'GET'
   };

   // Avoid
   const config = {
     url: '/users',
     method: 'GET'
   };
   ```

2. **Leverage Type Inference**
   ```typescript
   // TypeScript can infer complex types
   const response = await client.get<User>('/users/1');
   const { id, name, email } = response.data; // All properties are typed
   ```

3. **Use Strict Mode**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true
     }
   }
   ```

4. **Create Custom Type Guards**
   ```typescript
   function isSuccessResponse<T>(response: Response<T>): boolean {
     return response.status >= 200 && response.status < 300;
   }
   ```

5. **Utilize Utility Types**
   ```typescript
   // Make all properties optional for patch requests
   type PatchUserData = Partial<User>;

   // Make specific properties required
   type RequiredUser = Required<Pick<User, 'id' | 'email'>>;
   ```

## Advanced TypeScript Features

### Conditional Types

```typescript
type ResponseDataType<T> = T extends undefined ? void : T;

async function request<T>(config: RequestConfig): Promise<Response<ResponseDataType<T>>> {
  // Implementation
}
```

### Mapped Types

```typescript
type ReadonlyResponse<T> = {
  readonly [P in keyof T]: T[P];
};

function freezeResponse<T>(response: Response<T>): ReadonlyResponse<Response<T>> {
  return Object.freeze(response) as ReadonlyResponse<Response<T>>;
}
```

### Template Literal Types

```typescript
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type URLPath = `/api/v1/${string}`;

interface TypedRequestConfig extends RequestConfig {
  method: HTTPMethod;
  url: URLPath;
}
```

## Type Declaration Files

If you're creating custom plugins or extending Coral Fuzzy, you can declare additional types:

```typescript
// coral-fuzzy-plugin.d.ts
declare module 'coral-fuzzy' {
  export interface CoralFuzzyInstance {
    customMethod<T = any>(config: RequestConfig): Promise<Response<T>>;
  }

  export interface RequestConfig {
    customOption?: boolean;
  }
}
```

## Further Reading

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Coral Fuzzy API Reference](./api-reference.md) 