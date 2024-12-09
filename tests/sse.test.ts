import { SSEHandler } from '../src/utils/sse';

describe('SSEHandler', () => {
  let sseHandler: SSEHandler;
  let mockEventSource: any;

  beforeEach(() => {
    // Mock EventSource
    mockEventSource = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn(),
      readyState: EventSource.CONNECTING
    };

    global.EventSource = jest.fn().mockImplementation(() => mockEventSource);

    sseHandler = new SSEHandler({
      url: 'http://localhost:8080/events',
      withCredentials: true,
      reconnect: true,
      maxRetries: 3,
      retryDelay: 100
    });
  });

  afterEach(() => {
    sseHandler.close();
    jest.clearAllMocks();
  });

  describe('connection', () => {
    it('should establish connection', () => {
      expect(global.EventSource).toHaveBeenCalledWith('http://localhost:8080/events', {
        withCredentials: true
      });
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle successful connection', () => {
      const onOpen = jest.fn();
      sseHandler.on('open', onOpen);

      // Simulate connection open
      mockEventSource.readyState = EventSource.OPEN;
      const openCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'open')[1];
      openCallback();

      expect(onOpen).toHaveBeenCalled();
    });

    it('should handle connection error', () => {
      const onError = jest.fn();
      sseHandler.on('error', onError);

      // Simulate connection error
      const error = new Error('Connection failed');
      const errorCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(error);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      mockEventSource.readyState = EventSource.OPEN;
    });

    it('should handle default message events', () => {
      const onMessage = jest.fn();
      sseHandler.on('message', onMessage);

      // Simulate message received
      const messageCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test', data: 'Hello' }) });

      expect(onMessage).toHaveBeenCalledWith({ type: 'test', data: 'Hello' });
    });

    it('should handle custom events', () => {
      const onCustomEvent = jest.fn();
      sseHandler.on('custom-event', onCustomEvent);

      // Simulate custom event received
      const customCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'custom-event')[1];
      customCallback({ data: JSON.stringify({ type: 'custom', data: 'Hello' }) });

      expect(onCustomEvent).toHaveBeenCalledWith({ type: 'custom', data: 'Hello' });
    });

    it('should handle invalid JSON data', () => {
      const onError = jest.fn();
      sseHandler.on('error', onError);

      // Simulate invalid message received
      const messageCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: 'invalid json' });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    it('should attempt to reconnect on error', () => {
      jest.useFakeTimers();

      // Simulate error
      const errorCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(new Error('Connection lost'));

      jest.advanceTimersByTime(100);

      expect(global.EventSource).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should stop reconnecting after max retries', () => {
      jest.useFakeTimers();

      // Simulate multiple connection failures
      for (let i = 0; i < 4; i++) {
        const errorCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'error')[1];
        errorCallback(new Error('Connection lost'));
        jest.advanceTimersByTime(100);
      }

      expect(global.EventSource).toHaveBeenCalledTimes(4); // initial + 3 retries

      jest.useRealTimers();
    });

    it('should reset retry count after successful connection', () => {
      jest.useFakeTimers();

      // Simulate error and reconnect
      const errorCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(new Error('Connection lost'));
      jest.advanceTimersByTime(100);

      // Simulate successful connection
      const openCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'open')[1];
      openCallback();

      // Simulate another error
      errorCallback(new Error('Connection lost again'));
      jest.advanceTimersByTime(100);

      expect(global.EventSource).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('event listeners', () => {
    it('should support multiple event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      sseHandler.on('message', listener1);
      sseHandler.on('message', listener2);

      // Simulate message received
      const messageCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test' }) });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();

      sseHandler.on('message', listener);
      sseHandler.off('message', listener);

      // Simulate message received
      const messageCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test' }) });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close connection', () => {
      sseHandler.close();

      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('should remove all event listeners', () => {
      const listener = jest.fn();
      sseHandler.on('message', listener);

      sseHandler.close();

      // Simulate message received after close
      const messageCallback = mockEventSource.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test' }) });

      expect(listener).not.toHaveBeenCalled();
    });
  });
}); 