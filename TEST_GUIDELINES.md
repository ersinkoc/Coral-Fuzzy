# Test Guidelines

This document outlines testing practices and guidelines for Coral Fuzzy.

## Testing Philosophy

1. **Test Pyramid**
   - Unit Tests: 70%
   - Integration Tests: 20%
   - E2E Tests: 10%

2. **Test Coverage**
   - Minimum 80% coverage required
   - 100% coverage for core functionality
   - Focus on critical paths

## Test Structure

### Directory Structure

```
tests/
├── unit/              # Unit tests
│   ├── core/         # Core functionality tests
│   ├── adapters/     # Adapter tests
│   └── utils/        # Utility function tests
├── integration/      # Integration tests
├── e2e/             # End-to-end tests
└── __mocks__/       # Mock files
```

### File Naming

```
component-name.test.ts     # Unit tests
component-name.spec.ts     # Integration tests
component-name.e2e.ts     # E2E tests
```

## Writing Tests

### Unit Tests

```typescript
import { RequestHandler } from '../src/core/request-handler';

describe('RequestHandler', () => {
  let handler: RequestHandler;

  beforeEach(() => {
    handler = new RequestHandler();
  });

  describe('send()', () => {
    it('should send successful request', async () => {
      const response = await handler.send({
        url: 'https://api.example.com',
        method: 'GET'
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });

    it('should handle network errors', async () => {
      await expect(handler.send({
        url: 'invalid-url',
        method: 'GET'
      })).rejects.toThrow('Network Error');
    });
  });
});
```

### Integration Tests

```typescript
import { CoralFuzzy } from '../src/core/coral-fuzzy';
import { CacheHandler } from '../src/utils/cache';

describe('CoralFuzzy with CacheHandler', () => {
  let client: CoralFuzzy;
  let cache: CacheHandler;

  beforeEach(() => {
    cache = new CacheHandler();
    client = new CoralFuzzy({
      cache: {
        handler: cache,
        enabled: true
      }
    });
  });

  it('should cache successful responses', async () => {
    const firstResponse = await client.get('/data');
    const secondResponse = await client.get('/data');
    
    expect(secondResponse.cached).toBe(true);
    expect(secondResponse.data).toEqual(firstResponse.data);
  });
});
```

### E2E Tests

```typescript
import { CoralFuzzy } from '../src/index';

describe('CoralFuzzy E2E', () => {
  let client: CoralFuzzy;

  beforeAll(() => {
    client = new CoralFuzzy({
      baseURL: 'https://api.example.com'
    });
  });

  it('should perform complete request lifecycle', async () => {
    // Create resource
    const createResponse = await client.post('/users', {
      name: 'Test User'
    });
    expect(createResponse.status).toBe(201);

    // Retrieve resource
    const getResponse = await client.get(`/users/${createResponse.data.id}`);
    expect(getResponse.status).toBe(200);

    // Update resource
    const updateResponse = await client.put(`/users/${createResponse.data.id}`, {
      name: 'Updated User'
    });
    expect(updateResponse.status).toBe(200);

    // Delete resource
    const deleteResponse = await client.delete(`/users/${createResponse.data.id}`);
    expect(deleteResponse.status).toBe(204);
  });
});
```

## Mocking

### HTTP Requests

```typescript
import { MockAdapter } from '../__mocks__/mock-adapter';

describe('HTTP Client', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter();
  });

  it('should handle mocked response', async () => {
    mock.onGet('/users').reply(200, {
      data: [{ id: 1, name: 'User' }]
    });

    const response = await client.get('/users');
    expect(response.data.data).toHaveLength(1);
  });
});
```

### Time-based Tests

```typescript
describe('Cache Expiry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should expire cache after timeout', async () => {
    const response = await client.get('/data');
    
    jest.advanceTimersByTime(6 * 60 * 1000); // Advance 6 minutes
    
    const cachedResponse = await client.get('/data');
    expect(cachedResponse.cached).toBe(false);
  });
});
```

## Test Coverage

### Running Coverage

```bash
# Run tests with coverage
npm run test:coverage

# Generate coverage report
npm run coverage:report
```

### Coverage Requirements

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Performance Testing

### Load Tests

```typescript
describe('Performance', () => {
  it('should handle concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() =>
      client.get('/data')
    );

    const responses = await Promise.all(requests);
    expect(responses).toHaveLength(100);
  });
});
```

### Memory Tests

```typescript
describe('Memory Usage', () => {
  it('should not leak memory', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 1000; i++) {
      await client.get('/data');
    }

    const finalMemory = process.memoryUsage().heapUsed;
    expect(finalMemory - initialMemory).toBeLessThan(5 * 1024 * 1024); // 5MB
  });
});
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Best Practices

1. **Test Organization**
   - Group related tests
   - Use descriptive names
   - Follow AAA pattern (Arrange, Act, Assert)

2. **Test Independence**
   - Each test should be independent
   - Clean up after tests
   - Don't share state

3. **Test Readability**
   - Clear test descriptions
   - Meaningful assertions
   - Avoid test complexity

4. **Test Maintenance**
   - Keep tests up to date
   - Refactor tests with code
   - Remove obsolete tests

## Troubleshooting

Common test issues and solutions:

1. **Flaky Tests**
   - Use stable selectors
   - Add proper waits
   - Handle async properly

2. **Slow Tests**
   - Mock external services
   - Use test doubles
   - Optimize setup/teardown

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/)
- [Test Coverage Reports](./coverage/lcov-report/index.html) 