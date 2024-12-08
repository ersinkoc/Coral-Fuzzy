// Mock global fetch if not available
if (!global.fetch) {
  global.fetch = jest.fn();
  global.Headers = jest.fn();
  global.Request = jest.fn();
  global.Response = jest.fn();
}

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  open = jest.fn();
  send = jest.fn();
  setRequestHeader = jest.fn();
  abort = jest.fn();
  upload = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

global.XMLHttpRequest = MockXMLHttpRequest;

// Mock FormData
if (!global.FormData) {
  global.FormData = jest.fn();
}

// Mock Blob
if (!global.Blob) {
  global.Blob = jest.fn();
}

// Mock URL
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn();
  global.URL.revokeObjectURL = jest.fn();
}

// Mock TextEncoder/TextDecoder
if (!global.TextEncoder) {
  global.TextEncoder = jest.fn(() => ({
    encode: jest.fn(text => new Uint8Array(text.length)),
  }));
}

if (!global.TextDecoder) {
  global.TextDecoder = jest.fn(() => ({
    decode: jest.fn(),
  }));
}

// Mock Compression/Decompression Streams
if (!global.CompressionStream) {
  global.CompressionStream = jest.fn(() => ({
    readable: {},
    writable: {},
  }));
}

if (!global.DecompressionStream) {
  global.DecompressionStream = jest.fn(() => ({
    readable: {},
    writable: {},
  }));
}

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
