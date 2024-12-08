# Advanced Protocols

Coral Fuzzy supports various advanced protocols beyond standard HTTP requests.

[← Back to Documentation](README.md) | [Performance Optimization →](performance.md)

## Table of Contents
- [WebSocket Support](#websocket-support)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [GraphQL Integration](#graphql-integration)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)

## Related Documentation
- [Performance Optimization](performance.md)
- [Security Features](security-features.md)
- [Error Handling](error-handling.md)

## WebSocket Support

### Configuration
```typescript
const client = new CoralFuzzy({
  websocket: {
    reconnect: true,
    maxRetries: 3,
    retryDelay: 1000
  }
});
```

### Usage
```typescript
// Connect to WebSocket server
const ws = await client.websocket.connect('wss://api.example.com/ws');

// Send message
ws.send({ type: 'subscribe', channel: 'updates' });

// Listen for messages
ws.on('message', (data) => {
  console.log('Received:', data);
});

// Handle connection events
ws.on('open', () => console.log('Connected'));
ws.on('close', () => console.log('Disconnected'));
ws.on('error', (error) => console.error('Error:', error));
```

## Server-Sent Events (SSE)

### Configuration
```typescript
const client = new CoralFuzzy({
  sse: {
    reconnect: true,
    retryTime: 3000
  }
});
```

### Usage
```typescript
// Connect to SSE endpoint
const source = await client.sse.connect('/api/events');

// Listen for specific events
source.on('update', (event) => {
  console.log('Update received:', event.data);
});

// Handle all events
source.onMessage((event) => {
  console.log('Event received:', event);
});

// Handle connection lifecycle
source.onOpen(() => console.log('SSE connected'));
source.onError((error) => console.error('SSE error:', error));
```

## GraphQL Integration

### Configuration
```typescript
const client = new CoralFuzzy({
  graphql: {
    endpoint: '/graphql',
    headers: {
      'Content-Type': 'application/json'
    }
  }
});
```

### Basic Queries
```typescript
const query = `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }
`;

const variables = { id: '123' };
const response = await client.graphql.query(query, variables);
```

### Mutations
```typescript
const mutation = `
  mutation UpdateUser($id: ID!, $name: String!) {
    updateUser(id: $id, name: $name) {
      id
      name
    }
  }
`;

const variables = { id: '123', name: 'John Doe' };
const response = await client.graphql.mutate(mutation, variables);
```

### Subscriptions
```typescript
const subscription = `
  subscription OnUserUpdate($id: ID!) {
    userUpdated(id: $id) {
      id
      name
      status
    }
  }
`;

const variables = { id: '123' };
const unsubscribe = await client.graphql.subscribe(
  subscription,
  variables,
  {
    next: (data) => console.log('Update:', data),
    error: (error) => console.error('Error:', error),
    complete: () => console.log('Subscription completed')
  }
);
```

## Error Handling

### WebSocket Errors
```typescript
ws.on('error', (error) => {
  if (error.code === 'RECONNECT_FAILED') {
    console.error('Failed to reconnect after maximum retries');
  }
});
```

### SSE Errors
```typescript
source.onError((error) => {
  if (error.type === 'TIMEOUT') {
    source.reconnect();
  }
});
```

### GraphQL Errors
```typescript
try {
  const response = await client.graphql.query(query);
} catch (error) {
  if (error.graphQLErrors) {
    console.error('GraphQL Errors:', error.graphQLErrors);
  }
  if (error.networkError) {
    console.error('Network Error:', error.networkError);
  }
}
```

## TypeScript Support

```typescript
import { 
  WebSocketMessage,
  SSEEvent,
  GraphQLResponse 
} from 'coral-fuzzy';

// WebSocket with types
ws.on('message', (data: WebSocketMessage) => {
  if (data.type === 'update') {
    const payload = data.payload as UpdatePayload;
  }
});

// SSE with types
source.on<UpdateEvent>('update', (event) => {
  const data = event.data;
});

// GraphQL with types
interface UserQuery {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const response = await client.graphql.query<UserQuery>(query);
const user = response.data.user;
``` 