# Security Features

Coral Fuzzy provides comprehensive security features to protect your applications from common web vulnerabilities and attacks.

## Basic Configuration

```typescript
const client = new CoralFuzzy({
  security: {
    xsrf: {
      enabled: true,              // Enable XSRF protection
      cookieName: 'XSRF-TOKEN',   // XSRF cookie name
      headerName: 'X-XSRF-TOKEN'  // XSRF header name
    },
    ssl: {
      verify: true,               // Enable SSL certificate verification
      cert: 'your-cert',          // Optional custom certificate
      key: 'your-key'            // Optional custom key
    }
  }
});
```

## XSRF Protection

Cross-Site Request Forgery (XSRF) protection is enabled by default for all state-changing requests:

```typescript
// XSRF token will be automatically added to POST/PUT/DELETE/PATCH requests
const response = await client.post('/api/data', {
  // request data
});
```

## SSL/TLS Security

SSL certificate verification is enabled by default for HTTPS requests:

```typescript
// SSL verification will be performed automatically
const response = await client.get('https://api.example.com/data');

// Custom SSL configuration
const client = new CoralFuzzy({
  security: {
    ssl: {
      verify: true,
      cert: fs.readFileSync('cert.pem'),
      key: fs.readFileSync('key.pem')
    }
  }
});
```

## Security Headers

Coral Fuzzy automatically adds recommended security headers to all requests:

```typescript
const response = await client.get('/api/data');

// Added headers:
// X-Content-Type-Options: nosniff
// X-Frame-Options: SAMEORIGIN
// X-XSS-Protection: 1; mode=block
// Strict-Transport-Security: max-age=31536000; includeSubDomains
// Referrer-Policy: strict-origin-when-cross-origin
```

## Response Validation

Automatic validation of response data to detect potential security issues:

```typescript
const client = new CoralFuzzy({
  security: {
    validateResponses: true  // Enable response validation
  }
});

// Will warn if sensitive data is detected
const response = await client.get('/api/user');

// Will warn if potentially dangerous content is detected
const response = await client.get('/api/content');
```

## Sensitive Data Detection

Built-in detection of sensitive data in responses:

```typescript
// These patterns are automatically detected:
- Passwords
- Authentication tokens
- API keys
- Credit card numbers
- Social security numbers
- Other sensitive information
```

## Content Security

Protection against potentially dangerous content:

```typescript
// These patterns are automatically detected:
- Cross-site scripting (XSS) attempts
- Malicious JavaScript
- Dangerous protocols
- Event handlers
- Other suspicious content
```

## Best Practices

1. **Always Use HTTPS**
```typescript
const client = new CoralFuzzy({
  baseURL: 'https://api.example.com',
  security: {
    ssl: {
      verify: true  // Never disable in production
    }
  }
});
```

2. **Proper Token Management**
```typescript
// Store tokens securely
localStorage.setItem('auth_token', token);

// Use tokens properly
const client = new CoralFuzzy({
  security: {
    xsrf: {
      enabled: true,
      cookieName: 'XSRF-TOKEN'
    }
  }
});
```

3. **Response Validation**
```typescript
// Always validate sensitive responses
client.use({
  name: 'security-validator',
  post: async (response) => {
    if (response.config.url?.includes('/auth')) {
      // Additional validation for auth responses
    }
    return response;
  }
});
```

## Security Guidelines

1. Keep security features enabled in production
2. Regularly update dependencies
3. Use HTTPS for all requests
4. Implement proper authentication
5. Validate all responses
6. Handle errors securely
7. Follow security best practices

## Advanced Configuration

```typescript
const client = new CoralFuzzy({
  security: {
    xsrf: {
      enabled: true,
      cookieName: 'XSRF-TOKEN',
      headerName: 'X-XSRF-TOKEN'
    },
    ssl: {
      verify: true,
      cert: customCert,
      key: customKey
    },
    headers: {
      // Custom security headers
      'Content-Security-Policy': 'default-src \'self\'',
      'Feature-Policy': 'camera \'none\'; microphone \'none\''
    },
    validateResponses: true,
    sensitivePatterns: [
      // Custom patterns for sensitive data
      /api[-_]key/i,
      /private[-_]key/i
    ]
  }
});
```

## Next Steps

- Check out [Performance Optimization](./performance-optimization.md)
- Learn about [Error Handling](./error-handling.md)
- Explore [API Reference](./api-reference.md) 