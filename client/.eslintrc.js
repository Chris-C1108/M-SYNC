/**
 * ESLint 配置文件
 */

module.exports = {
  env: {
    browser: false,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    // 代码风格
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'never'],
    
    // 变量命名
    'camelcase': ['error', { properties: 'never' }],
    'no-underscore-dangle': 'off',
    
    // 函数
    'max-len': ['warn', { code: 120, ignoreComments: true }],
    'max-params': ['warn', 5],
    'max-depth': ['warn', 4],
    'complexity': ['warn', 10],
    
    // 错误处理
    'no-console': 'off', // 允许console，因为这是CLI应用
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-empty-catch': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // 异步代码
    'no-async-promise-executor': 'error',
    'require-await': 'warn',
    'no-return-await': 'error',
    
    // 安全
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Node.js特定
    'no-process-exit': 'warn',
    'no-sync': 'off', // 允许同步方法，某些场景需要
    
    // 测试相关
    'jest/no-disabled-tests': 'warn',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/prefer-to-have-length': 'warn',
    'jest/valid-expect': 'error'
  },
  plugins: [
    'jest'
  ],
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      env: {
        jest: true
      },
      rules: {
        // 测试文件中允许更宽松的规则
        'max-len': 'off',
        'no-magic-numbers': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      rules: {
        // 脚本文件中允许console和process.exit
        'no-console': 'off',
        'no-process-exit': 'off'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    '*.min.js'
  ]
};
