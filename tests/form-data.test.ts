import { FormDataHandler } from '../src/utils/form-data';
import { RequestConfig, Response } from '../src/types';

describe('FormDataHandler', () => {
  let formDataHandler: FormDataHandler;
  let mockRequest: jest.Mock;
  let mockConfig: RequestConfig;
  let mockResponse: Response;

  beforeEach(() => {
    formDataHandler = new FormDataHandler({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    });

    mockConfig = {
      url: '/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    };

    mockResponse = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: mockConfig,
      request: {}
    };

    mockRequest = jest.fn().mockResolvedValue(mockResponse);

    // Mock FormData
    global.FormData = jest.fn().mockImplementation(() => ({
      append: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn(),
      has: jest.fn(),
      set: jest.fn(),
      forEach: jest.fn()
    }));
  });

  describe('file validation', () => {
    it('should validate file size', async () => {
      const file = new File(['test'.repeat(1024 * 1024 * 6)], 'test.jpg', { type: 'image/jpeg' });

      await expect(formDataHandler.validateFile(file))
        .rejects.toThrow('File size exceeds maximum limit of 5MB');
    });

    it('should validate file type', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      await expect(formDataHandler.validateFile(file))
        .rejects.toThrow('File type text/plain is not allowed');
    });

    it('should validate number of files', async () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['test3'], 'test3.jpg', { type: 'image/jpeg' }),
        new File(['test4'], 'test4.jpg', { type: 'image/jpeg' })
      ];

      await expect(formDataHandler.validateFiles(files))
        .rejects.toThrow('Maximum number of files exceeded');
    });

    it('should pass validation for valid files', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(formDataHandler.validateFile(file)).resolves.toBeUndefined();
    });
  });

  describe('form data processing', () => {
    it('should process single file upload', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const data = { file, description: 'Test file' };

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data
      });

      expect(FormData).toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'multipart/form-data'
        })
      }));
    });

    it('should process multiple file upload', async () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      ];
      const data = { files, description: 'Test files' };

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data
      });

      expect(FormData).toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'multipart/form-data'
        })
      }));
    });

    it('should handle non-file form data', async () => {
      const data = {
        name: 'Test',
        description: 'Test description',
        tags: ['tag1', 'tag2']
      };

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data
      });

      expect(FormData).toHaveBeenCalled();
      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'multipart/form-data'
        })
      }));
    });
  });

  describe('progress tracking', () => {
    it('should track upload progress', async () => {
      const onProgress = jest.fn();
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { file },
        onUploadProgress: onProgress
      });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        onUploadProgress: expect.any(Function)
      }));
    });

    it('should calculate total progress for multiple files', async () => {
      const onProgress = jest.fn();
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      ];

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { files },
        onUploadProgress: onProgress
      });

      expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
        onUploadProgress: expect.any(Function)
      }));
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockRequest = jest.fn().mockRejectedValue(new Error('Network error'));

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { file }
      })).rejects.toThrow('Network error');
    });

    it('should handle server errors', async () => {
      const errorResponse = {
        ...mockResponse,
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'Upload failed' }
      };

      mockRequest = jest.fn().mockResolvedValue(errorResponse);

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const response = await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { file }
      });

      expect(response.status).toBe(500);
      expect(response.data.error).toBe('Upload failed');
    });

    it('should handle validation errors', async () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      await expect(formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { file: invalidFile }
      })).rejects.toThrow('File type text/plain is not allowed');
    });
  });

  describe('cleanup', () => {
    it('should clean up temporary data', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await formDataHandler.processRequest(mockRequest, {
        ...mockConfig,
        data: { file }
      });

      formDataHandler.cleanup();

      // Verify that temporary data is cleaned up
      // This is implementation specific and might need to be adjusted
      expect(formDataHandler.getStats().pendingUploads).toBe(0);
    });
  });
}); 