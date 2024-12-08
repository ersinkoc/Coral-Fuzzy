# Basic Usage

## HTTP Methods

Coral Fuzzy supports all standard HTTP methods:

```typescript
// GET request
const users = await client.get('/users');

// POST request
const newUser = await client.post('/users', { name: 'John' });

// PUT request
const updated = await client.put('/users/1', { name: 'John Updated' });

// PATCH request
const patched = await client.patch('/users/1', { status: 'active' });

// DELETE request
const deleted = await client.delete('/users/1');

// HEAD request
const headers = await client.head('/users');

// OPTIONS request
const options = await client.options('/users');
```

## Request Configuration

```typescript
const response = await client.get('/users', {
  // Request timeout in milliseconds
  timeout: 5000,

  // Custom headers
  headers: {
    'Authorization': 'Bearer token',
    'Custom-Header': 'value'
  },

  // URL parameters
  params: {
    page: 1,
    limit: 10,
    sort: 'name'
  },

  // Request body (for POST, PUT, PATCH)
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },

  // Enable credentials
  withCredentials: true,

  // Response type
  responseType: 'json' // 'arraybuffer' | 'blob' | 'document' | 'json' | 'text'
});
```

## Response Handling

```typescript
const response = await client.get('/users/1');

// Response data
console.log(response.data);

// HTTP status
console.log(response.status); // e.g., 200
console.log(response.statusText); // e.g., "OK"

// Response headers
console.log(response.headers);

// Original request config
console.log(response.config);
```

## Global Configuration

```typescript
const client = new CoralFuzzy({
  // Base URL for all requests
  baseURL: 'https://api.example.com',

  // Default timeout
  timeout: 5000,

  // Default headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },

  // Default response type
  responseType: 'json',

  // Validate status function
  validateStatus: (status) => status >= 200 && status < 300
});
```

## Working with Forms

```typescript
// Simple form data
const formData = new FormData();
formData.append('username', 'john');
formData.append('password', 'secret');

await client.post('/login', formData);

// File upload
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const uploadData = new FormData();
uploadData.append('file', file);

await client.post('/upload', uploadData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

## URL Parameters

```typescript
// Using params object
await client.get('/users', {
  params: {
    page: 1,
    limit: 10,
    search: 'john',
    filters: ['active', 'verified']
  }
});
// Results in: /users?page=1&limit=10&search=john&filters=active&filters=verified

// Using URLSearchParams
const params = new URLSearchParams();
params.append('page', '1');
params.append('limit', '10');

await client.get('/users', { params });
```

## Next Steps

- Learn about [Advanced Features](./advanced-features.md)
- Explore [Middleware Guide](./middleware-guide.md)
- Check out [Security Features](./security-features.md) 