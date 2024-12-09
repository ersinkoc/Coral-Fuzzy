import { CompressionHandler } from '../src/utils/compression';
import { RequestConfig, Response } from '../src/types';

describe('CompressionHandler', () => {
  let compressionHandler: CompressionHandler;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    compressionHandler = new CompressionHandler();
    mockConfig = {
      url: '/test',
      method: 'POST',
      data: 'test data',
      headers: {}
    };
    mockResponse = {
      data: new Uint8Array([1, 2, 3]),
      status: 200,
      statusText: 'OK',
      headers: {
        'content-encoding': 'gzip'
      },
      config: mockConfig,
      request: {}
    };

    // Mock CompressionStream and DecompressionStream
    global.CompressionStream = jest.fn().mockImplementation(() => ({
      readable: {
        getReader: () => ({
          read: jest.fn().mockResolvedValueOnce({
            done: false,
            value: new Uint8Array([1, 2, 3])
          }).mockResolvedValueOnce({
            done: true
          })
        })
      },
      writable: {
        getWriter: () => ({
          write: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined)
        })
      }
    }));

    global.DecompressionStream = jest.fn().mockImplementation(() => ({
      readable: {
        getReader: () => ({
          read: jest.fn().mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('decompressed data')
          }).mockResolvedValueOnce({
            done: true
          })
        })
      },
      writable: {
        getWriter: () => ({
          write: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined)
        })
      }
    }));
  });

  describe('processRequest', () => {
    it('should compress request data when enabled', async () => {
      const config = await compressionHandler.processRequest(mockConfig);

      expect(config.headers['Content-Encoding']).toBe('gzip');
      expect(config.data instanceof Uint8Array).toBe(true);
    });

    it('should not compress small data below threshold', async () => {
      compressionHandler = new CompressionHandler({ threshold: 1024 });
      const config = await compressionHandler.processRequest(mockConfig);

      expect(config.headers['Content-Encoding']).toBeUndefined();
      expect(config.data).toBe('test data');
    });

    it('should not compress when disabled', async () => {
      compressionHandler = new CompressionHandler({ enabled: false });
      const config = await compressionHandler.processRequest(mockConfig);

      expect(config.headers['Content-Encoding']).toBeUndefined();
      expect(config.data).toBe('test data');
    });

    it('should handle non-string data', async () => {
      const config = await compressionHandler.processRequest({
        ...mockConfig,
        data: { test: 'data' }
      });

      expect(config.data).toEqual({ test: 'data' });
    });
  });

  describe('processResponse', () => {
    it('should decompress gzipped response', async () => {
      const response = await compressionHandler.processResponse(mockResponse);

      expect(response.data).toBe('decompressed data');
      expect(response.headers['content-length']).toBe('16'); // length of 'decompressed data'
    });

    it('should decompress deflated response', async () => {
      const response = await compressionHandler.processResponse({
        ...mockResponse,
        headers: { 'content-encoding': 'deflate' }
      });

      expect(response.data).toBe('decompressed data');
    });

    it('should not decompress when no content-encoding', async () => {
      const response = await compressionHandler.processResponse({
        ...mockResponse,
        headers: {}
      });

      expect(response.data).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should handle decompression errors', async () => {
      global.DecompressionStream = jest.fn().mockImplementation(() => {
        throw new Error('Decompression failed');
      });

      const response = await compressionHandler.processResponse(mockResponse);

      expect(response).toEqual(mockResponse);
    });
  });

  describe('getStats', () => {
    it('should return compression configuration', () => {
      const stats = compressionHandler.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.algorithm).toBe('gzip');
      expect(stats.threshold).toBe(1024);
      expect(stats.compressionSupported).toBe(true);
    });
  });
}); 