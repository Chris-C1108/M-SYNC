/**
 * Jest 配置文件
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 覆盖率收集
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // 测试设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock ES modules that cause issues in Jest
    'clipboardy': '<rootDir>/tests/__mocks__/clipboardy.js',
    'open': '<rootDir>/tests/__mocks__/open.js',
    'node-notifier': '<rootDir>/tests/__mocks__/node-notifier.js'
  },
  
  // 测试超时时间
  testTimeout: 30000,
  
  // 详细输出
  verbose: true,
  
  // 清除模拟
  clearMocks: true,
  
  // 恢复模拟
  restoreMocks: true,
  
  // 错误时停止
  bail: false,
  
  // 最大并发数
  maxConcurrency: 5,
  
  // 测试结果处理器
  testResultsProcessor: undefined,
  
  // 全局变量
  globals: {
    'NODE_ENV': 'test'
  },
  
  // 忽略的文件模式
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // 转换忽略模式
  transformIgnorePatterns: [
    '/node_modules/(?!(ws)/)'
  ]
};
