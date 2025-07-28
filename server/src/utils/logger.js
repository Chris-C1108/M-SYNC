/**
 * 日志工具模块
 * 提供统一的日志记录功能
 */

const winston = require('winston');
const path = require('path');
const config = require('config');

// 确保日志目录存在
const fs = require('fs');
const logDir = path.dirname(config.get('logging.file'));
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
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
      filename: config.get('logging.file'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 错误日志单独文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
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
  broker: createLogger('MessageBrokerService'),
  gateway: createLogger('MessageIngressGateway'),
  dispatcher: createLogger('RealtimeMessageDispatcher'),
  auth: createLogger('AuthenticationService'),
  database: createLogger('Database'),
  websocket: createLogger('WebSocket')
};
