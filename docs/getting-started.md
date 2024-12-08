# Getting Started with Coral Fuzzy

## Prerequisites

- Node.js >= 14.0.0
- TypeScript >= 4.5.0 (for TypeScript usage)
- Modern browser with ES2020 support

## Installation

```bash
npm install coral-fuzzy
```

## Basic Setup

```typescript
import { CoralFuzzy } from 'coral-fuzzy';

const client = new CoralFuzzy({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});
```

## Making Your First Request

```typescript
// GET request
try {
  const response = await client.get('/users');
  console.log(response.data);
} catch (error) {
  console.error('Error:', error.message);
}

// POST request
const newUser = {
  name: 'John Doe',
  email: 'john@example.com'
};

try {
  const response = await client.post('/users', newUser);
  console.log('User created:', response.data);
} catch (error) {
  console.error('Error creating user:', error.message);
}
```

## Error Handling

```typescript
try {
  const response = await client.get('/users');
} catch (error) {
  if (error.response) {
    // Server responded with an error status
    console.error('Server Error:', error.response.status);
    console.error('Error Data:', error.response.data);
  } else if (error.request) {
    // Request was made but no response received
    console.error('Network Error:', error.request);
  } else {
    // Error in request configuration
    console.error('Request Error:', error.message);
  }
}
```

## TypeScript Support

Coral Fuzzy is written in TypeScript and provides full type support:

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Type-safe requests
const response = await client.get<User>('/users/1');
const user: User = response.data;

// Type-safe request body
const newUser: Omit<User, 'id'> = {
  name: 'John Doe',
  email: 'john@example.com'
};
const created = await client.post<User>('/users', newUser);
```

## Next Steps

- Check out [Basic Usage](./basic-usage.md) for more examples
- Learn about [Configuration](./configuration.md) options
- Explore [Advanced Features](./advanced-features.md) 