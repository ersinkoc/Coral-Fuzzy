import { CookieHandler } from '../src/utils/cookie';
import { RequestConfig, Response } from '../src/types';

describe('CookieHandler', () => {
  let cookieHandler: CookieHandler;
  
  beforeEach(() => {
    cookieHandler = new CookieHandler({
      enabled: true,
      jar: true,
      secure: true,
      sameSite: 'Lax',
      domain: 'test.com',
      path: '/'
    });
  });

  describe('Cookie Management', () => {
    test('should set and get cookie correctly', () => {
      cookieHandler.setCookie('test', 'value');
      expect(cookieHandler.getCookie('test')).toBe('value');
    });

    test('should delete cookie correctly', () => {
      cookieHandler.setCookie('test', 'value');
      cookieHandler.deleteCookie('test');
      expect(cookieHandler.getCookie('test')).toBeUndefined();
    });

    test('should clear all cookies', () => {
      cookieHandler.setCookie('test1', 'value1');
      cookieHandler.setCookie('test2', 'value2');
      cookieHandler.clearCookies();
      expect(cookieHandler.getCookie('test1')).toBeUndefined();
      expect(cookieHandler.getCookie('test2')).toBeUndefined();
    });

    test('should handle expired cookies', () => {
      const expiredDate = new Date(Date.now() - 1000);
      cookieHandler.setCookie('expired', 'value', { expires: expiredDate });
      expect(cookieHandler.getCookie('expired')).toBeUndefined();
    });
  });

  describe('Request/Response Handling', () => {
    const mockRequest = async (config: RequestConfig): Promise<Response<any>> => {
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {
          'set-cookie': ['session=abc123; Domain=test.com; Path=/; Secure; SameSite=Lax']
        },
        config
      };
    };

    test('should add cookies to request', async () => {
      cookieHandler.setCookie('auth', 'token123');
      const config: RequestConfig = { url: 'https://api.test.com' };
      
      await cookieHandler.execute(mockRequest, config);
      
      expect(config.headers).toBeDefined();
      expect(config.headers?.Cookie).toContain('auth=token123');
    });

    test('should save cookies from response', async () => {
      const config: RequestConfig = { url: 'https://api.test.com' };
      
      await cookieHandler.execute(mockRequest, config);
      
      expect(cookieHandler.getCookie('session')).toBe('abc123');
    });

    test('should respect cookie options', () => {
      cookieHandler.setCookie('test', 'value', {
        domain: 'sub.test.com',
        path: '/api',
        secure: true,
        sameSite: 'Strict'
      });

      const cookie = cookieHandler.getCookie('test');
      expect(cookie).toBe('value');
    });
  });

  describe('Security Features', () => {
    test('should handle secure cookies correctly', () => {
      cookieHandler.setCookie('secure-cookie', 'value', { secure: true });
      expect(cookieHandler.getCookie('secure-cookie')).toBe('value');
    });

    test('should handle SameSite attribute', () => {
      cookieHandler.setCookie('samesite-cookie', 'value', { sameSite: 'Strict' });
      expect(cookieHandler.getCookie('samesite-cookie')).toBe('value');
    });
  });

  describe('Configuration', () => {
    test('should respect disabled state', async () => {
      const disabledHandler = new CookieHandler({ enabled: false });
      const config: RequestConfig = { url: 'https://api.test.com' };
      
      await disabledHandler.execute(mockRequest, config);
      
      expect(config.headers?.Cookie).toBeUndefined();
    });

    test('should respect jar disabled state', () => {
      const noJarHandler = new CookieHandler({ jar: false });
      noJarHandler.setCookie('test', 'value');
      expect(noJarHandler.getCookie('test')).toBe('value');
    });
  });
}); 