import { WebSocketHandler } from '../src/utils/websocket';

describe('WebSocketHandler', () => {
  let wsHandler: WebSocketHandler;
  let mockWebSocket: any;

  beforeEach(() => {
    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: WebSocket.CONNECTING
    };

    global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket);

    wsHandler = new WebSocketHandler({
      url: 'ws://localhost:8080',
      protocols: ['v1'],
      reconnect: true,
      maxRetries: 3,
      retryDelay: 100
    });
  });

  afterEach(() => {
    wsHandler.close();
    jest.clearAllMocks();
  });

  describe('connection', () => {
    it('should establish connection', () => {
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080', ['v1']);
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocket.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle successful connection', () => {
      const onOpen = jest.fn();
      wsHandler.on('open', onOpen);

      // Simulate connection open
      mockWebSocket.readyState = WebSocket.OPEN;
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1];
      openCallback();

      expect(onOpen).toHaveBeenCalled();
    });

    it('should handle connection close', () => {
      const onClose = jest.fn();
      wsHandler.on('close', onClose);

      // Simulate connection close
      const closeCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1];
      closeCallback({ code: 1000, reason: 'Normal closure' });

      expect(onClose).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should handle connection error', () => {
      const onError = jest.fn();
      wsHandler.on('error', onError);

      // Simulate connection error
      const error = new Error('Connection failed');
      const errorCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'error')[1];
      errorCallback(error);

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('messaging', () => {
    beforeEach(() => {
      mockWebSocket.readyState = WebSocket.OPEN;
    });

    it('should send messages', () => {
      const message = { type: 'test', data: 'Hello' };
      wsHandler.send(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should receive messages', () => {
      const onMessage = jest.fn();
      wsHandler.on('message', onMessage);

      // Simulate message received
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test', data: 'Hello' }) });

      expect(onMessage).toHaveBeenCalledWith({ type: 'test', data: 'Hello' });
    });

    it('should handle invalid JSON messages', () => {
      const onError = jest.fn();
      wsHandler.on('error', onError);

      // Simulate invalid message received
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: 'invalid json' });

      expect(onError).toHaveBeenCalled();
    });

    it('should queue messages when not connected', () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;
      
      const message = { type: 'test', data: 'Hello' };
      wsHandler.send(message);

      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Simulate connection open
      mockWebSocket.readyState = WebSocket.OPEN;
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1];
      openCallback();

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('reconnection', () => {
    it('should attempt to reconnect on close', () => {
      jest.useFakeTimers();

      // Simulate unexpected close
      const closeCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1];
      closeCallback({ code: 1006, reason: 'Connection lost' });

      jest.advanceTimersByTime(100);

      expect(global.WebSocket).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should stop reconnecting after max retries', () => {
      jest.useFakeTimers();

      // Simulate multiple connection failures
      for (let i = 0; i < 4; i++) {
        const closeCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1];
        closeCallback({ code: 1006, reason: 'Connection lost' });
        jest.advanceTimersByTime(100);
      }

      expect(global.WebSocket).toHaveBeenCalledTimes(4); // initial + 3 retries

      jest.useRealTimers();
    });

    it('should not reconnect on normal closure', () => {
      // Simulate normal close
      const closeCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'close')[1];
      closeCallback({ code: 1000, reason: 'Normal closure' });

      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handling', () => {
    it('should support multiple event listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      wsHandler.on('message', listener1);
      wsHandler.on('message', listener2);

      // Simulate message received
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test' }) });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();

      wsHandler.on('message', listener);
      wsHandler.off('message', listener);

      // Simulate message received
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'message')[1];
      messageCallback({ data: JSON.stringify({ type: 'test' }) });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close connection', () => {
      wsHandler.close();

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should clear message queue on close', () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;
      wsHandler.send({ type: 'test' });

      wsHandler.close();

      // Simulate connection open after close
      mockWebSocket.readyState = WebSocket.OPEN;
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(call => call[0] === 'open')[1];
      openCallback();

      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });
}); 