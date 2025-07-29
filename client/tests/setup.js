/**
 * Jest 测试设置文件
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.MSYNC_SUBSCRIBER_LOG_LEVEL = 'error'; // 减少测试时的日志输出

// 全局测试超时
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // 保留 error 和 warn，但静默 info 和 debug
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: originalConsole.warn,
    error: originalConsole.error
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Mock fetch for Node.js environment
global.fetch = require('node-fetch');

// 清理定时器
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// 全局测试工具函数
global.testUtils = {
  // 等待指定时间
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 等待条件满足
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  // 创建模拟配置
  createMockConfig: (overrides = {}) => ({
    brokerService: {
      wsEndpoint: 'ws://localhost:8080',
      reconnectInterval: 1000,
      heartbeatInterval: 5000,
      maxReconnectAttempts: 3,
      ...overrides.brokerService
    },
    tokenManager: {
      serverUrl: 'http://localhost:3000',
      username: 'testuser',
      password: 'testpass',
      ...overrides.tokenManager
    },
    messageHandlers: {
      enableClipboard: false, // 测试时禁用剪贴板
      enableBrowser: false,   // 测试时禁用浏览器
      enableNotifications: false, // 测试时禁用通知
      ...overrides.messageHandlers
    },
    ...overrides
  })
};
