/**
 * 客户端日志工具模块
 * 提供统一的日志记录功能
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('config');

// 确保日志目录存在
const logFile = config.get('logging.file');
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, component, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    
    if (component) {
      log += ` [${component}]`;
    }
    
    log += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: config.get('logging.level'),
  format: logFormat,
  transports: [
    // 文件日志
    new winston.transports.File({
      filename: logFile,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: config.get('logging.maxFiles'),
      tailable: true
    }),
    
    // 错误日志单独文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 3,
      tailable: true
    })
  ]
});

// 控制台输出（如果启用）
if (config.get('logging.console')) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
        let log = `${timestamp} [${level}]`;
        
        if (component) {
          log += ` [${component}]`;
        }
        
        log += `: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        
        return log;
      })
    )
  }));
}

// 创建特定组件的logger
function createLogger(component) {
  return {
    debug: (message, meta = {}) => logger.debug(message, { component, ...meta }),
    info: (message, meta = {}) => logger.info(message, { component, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
    error: (message, meta = {}) => logger.error(message, { component, ...meta })
  };
}

// 导出默认logger和工厂函数
module.exports = logger;
module.exports.createLogger = createLogger;

// 预定义的组件logger
module.exports.components = {
  client: createLogger('MessageSubscriberClient'),
  connection: createLogger('WebSocketConnectionManager'),
  handlers: createLogger('MessageHandlerRegistry'),
  clipboard: createLogger('ClipboardManager'),
  browser: createLogger('BrowserLauncher'),
  notifier: createLogger('SystemNotifier'),
  config: createLogger('ConfigManager')
};
