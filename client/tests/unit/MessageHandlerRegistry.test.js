/**
 * MessageHandlerRegistry 单元测试
 */

const MessageHandlerRegistry = require('../../src/handlers/MessageHandlerRegistry');

// Mock handlers
class MockTextHandler {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
  }
  
  async process(message) {
    return { success: true, action: 'text-processed', content: message.content };
  }
}

class MockUrlHandler {
  constructor() {
    this.initialized = false;
  }
  
  async initialize() {
    this.initialized = true;
  }
  
  async process(message) {
    return { success: true, action: 'url-opened', url: message.content };
  }
}

describe('MessageHandlerRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new MessageHandlerRegistry();
  });

  describe('registerHandler()', () => {
    test('should register handler successfully', () => {
      const handler = new MockTextHandler();
      
      expect(() => {
        registry.registerHandler('TEXT', 'clipboard', handler);
      }).not.toThrow();
    });

    test('should throw error for duplicate handler', () => {
      const handler1 = new MockTextHandler();
      const handler2 = new MockTextHandler();
      
      registry.registerHandler('TEXT', 'clipboard', handler1);
      
      expect(() => {
        registry.registerHandler('TEXT', 'clipboard', handler2);
      }).toThrow('Handler already registered');
    });

    test('should throw error for invalid parameters', () => {
      expect(() => {
        registry.registerHandler('', 'clipboard', new MockTextHandler());
      }).toThrow();
      
      expect(() => {
        registry.registerHandler('TEXT', '', new MockTextHandler());
      }).toThrow();
      
      expect(() => {
        registry.registerHandler('TEXT', 'clipboard', null);
      }).toThrow();
    });
  });

  describe('initialize()', () => {
    test('should initialize all registered handlers', async () => {
      const textHandler = new MockTextHandler();
      const urlHandler = new MockUrlHandler();
      
      registry.registerHandler('TEXT', 'clipboard', textHandler);
      registry.registerHandler('URL', 'browser', urlHandler);
      
      await registry.initialize();
      
      expect(textHandler.initialized).toBe(true);
      expect(urlHandler.initialized).toBe(true);
    });

    test('should handle handler initialization errors', async () => {
      const faultyHandler = {
        initialize: jest.fn().mockRejectedValue(new Error('Init failed'))
      };
      
      registry.registerHandler('TEXT', 'clipboard', faultyHandler);
      
      // Should not throw, but log error
      await expect(registry.initialize()).resolves.not.toThrow();
    });
  });

  describe('processMessage()', () => {
    beforeEach(async () => {
      const textHandler = new MockTextHandler();
      const urlHandler = new MockUrlHandler();
      
      registry.registerHandler('TEXT', 'clipboard', textHandler);
      registry.registerHandler('URL', 'browser', urlHandler);
      
      await registry.initialize();
    });

    test('should process TEXT message successfully', async () => {
      const message = {
        messageType: 'TEXT',
        content: 'Hello World'
      };
      
      const result = await registry.processMessage(message);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.action).toBe('text-processed');
      expect(result.content).toBe('Hello World');
    });

    test('should process URL message successfully', async () => {
      const message = {
        messageType: 'URL',
        content: 'https://example.com'
      };
      
      const result = await registry.processMessage(message);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.action).toBe('url-opened');
      expect(result.url).toBe('https://example.com');
    });

    test('should handle unsupported message type', async () => {
      const message = {
        messageType: 'UNSUPPORTED',
        content: 'test'
      };
      
      const result = await registry.processMessage(message);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler found');
    });

    test('should handle handler processing errors', async () => {
      const faultyHandler = {
        initialize: jest.fn().mockResolvedValue(),
        process: jest.fn().mockRejectedValue(new Error('Processing failed'))
      };
      
      registry.registerHandler('FAULTY', 'test', faultyHandler);
      await registry.initialize();
      
      const message = {
        messageType: 'FAULTY',
        content: 'test'
      };
      
      const result = await registry.processMessage(message);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed');
    });
  });

  describe('getRegisteredHandlers()', () => {
    test('should return list of registered handlers', () => {
      const textHandler = new MockTextHandler();
      const urlHandler = new MockUrlHandler();
      
      registry.registerHandler('TEXT', 'clipboard', textHandler);
      registry.registerHandler('URL', 'browser', urlHandler);
      
      const handlers = registry.getRegisteredHandlers();
      
      expect(handlers).toHaveLength(2);
      expect(handlers).toContain('TEXT');
      expect(handlers).toContain('URL');
    });

    test('should return empty array when no handlers registered', () => {
      const handlers = registry.getRegisteredHandlers();
      expect(handlers).toHaveLength(0);
    });
  });

  describe('hasHandler()', () => {
    test('should return true for registered handler', () => {
      const textHandler = new MockTextHandler();
      registry.registerHandler('TEXT', 'clipboard', textHandler);
      
      expect(registry.hasHandler('TEXT')).toBe(true);
    });

    test('should return false for unregistered handler', () => {
      expect(registry.hasHandler('UNKNOWN')).toBe(false);
    });
  });
});
