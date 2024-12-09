import { SecurityHandler } from '../src/utils/security';
import { RequestConfig, Response } from '../src/types';

describe('SecurityHandler', () => {
  let securityHandler: SecurityHandler;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    securityHandler = new SecurityHandler();
    mockConfig = {
      url: 'https://api.example.com/test',
      method: 'POST',
      headers: {}
    };
    mockResponse = {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: mockConfig,
      request: {}
    };

    // Mock window and document
    global.window = {
      location: {
        origin: 'https://example.com'
      }
    } as any;

    global.document = {
      cookie: ''
    } as any;
  });

  afterEach(() => {
    securityHandler.clear();
    jest.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should add security headers to request', async () => {
      const config = await securityHandler.processRequest(mockConfig);

      expect(config.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(config.headers['X-Frame-Options']).toBe('SAMEORIGIN');
      expect(config.headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(config.headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    });

    it('should add XSRF token for state-changing methods', async () => {
      // Set XSRF token in cookie
      document.cookie = 'XSRF-TOKEN=test-token';

      const config = await securityHandler.processRequest({
        ...mockConfig,
        method: 'POST'
      });

      expect(config.headers['X-XSRF-TOKEN']).toBe('test-token');
    });

    it('should not add XSRF token for GET requests', async () => {
      document.cookie = 'XSRF-TOKEN=test-token';

      const config = await securityHandler.processRequest({
        ...mockConfig,
        method: 'GET'
      });

      expect(config.headers['X-XSRF-TOKEN']).toBeUndefined();
    });

    it('should add Origin header when validateOrigin is enabled', async () => {
      const config = await securityHandler.processRequest(mockConfig);

      expect(config.headers['Origin']).toBe('https://example.com');
    });

    it('should handle SSL configuration', async () => {
      securityHandler = new SecurityHandler({
        ssl: {
          verify: true,
          cert: 'test-cert',
          key: 'test-key'
        }
      });

      const config = await securityHandler.processRequest(mockConfig);

      expect(config.cert).toBe('test-cert');
      expect(config.key).toBe('test-key');
    });
  });

  describe('processResponse', () => {
    it('should update XSRF token from response headers', () => {
      const response = securityHandler.processResponse({
        ...mockResponse,
        headers: {
          'xsrf-token': 'new-token'
        }
      });

      // Make a new request to verify the token is updated
      securityHandler.processRequest(mockConfig).then(config => {
        expect(config.headers['X-XSRF-TOKEN']).toBe('new-token');
      });
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTPS URLs when SSL verify is enabled', () => {
      securityHandler = new SecurityHandler({
        ssl: { verify: true }
      });

      expect(securityHandler.validateUrl('https://api.example.com')).toBe(true);
      expect(securityHandler.validateUrl('http://api.example.com')).toBe(false);
    });

    it('should validate same origin when validateOrigin is enabled', () => {
      securityHandler = new SecurityHandler({
        validateOrigin: true
      });

      expect(securityHandler.validateUrl('https://example.com/api')).toBe(true);
      expect(securityHandler.validateUrl('https://other-domain.com/api')).toBe(false);
    });

    it('should handle invalid URLs', () => {
      expect(securityHandler.validateUrl('invalid-url')).toBe(false);
    });
  });

  describe('getSecurityHeaders', () => {
    it('should return configured security headers', () => {
      const headers = securityHandler.getSecurityHeaders();

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    });

    it('should include custom headers', () => {
      securityHandler = new SecurityHandler({
        headers: {
          'Custom-Security-Header': 'test-value'
        }
      });

      const headers = securityHandler.getSecurityHeaders();
      expect(headers['Custom-Security-Header']).toBe('test-value');
    });
  });

  describe('clear', () => {
    it('should clear XSRF token', async () => {
      document.cookie = 'XSRF-TOKEN=test-token';
      await securityHandler.processRequest(mockConfig);

      securityHandler.clear();

      const config = await securityHandler.processRequest(mockConfig);
      expect(config.headers['X-XSRF-TOKEN']).toBeUndefined();
    });
  });
}); 