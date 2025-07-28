/**
 * 全局错误处理中间件
 * 统一处理应用中的错误
 */

const logger = require('../utils/logger');

/**
 * 全局错误处理中间件
 */
function errorHandler(error, req, res, next) {
  // 记录错误日志
  logger.error('Unhandled error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // 如果响应已经发送，则交给默认错误处理器
  if (res.headersSent) {
    return next(error);
  }

  // 根据错误类型返回不同的响应
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // 数据库错误
  if (error.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = error.errors.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    message = 'Duplicate Entry';
    details = error.errors.map(err => ({
      field: err.path,
      message: `${err.path} already exists`
    }));
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid Reference';
  } else if (error.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    message = 'Database Error';
  }

  // JWT错误
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid Token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token Expired';
  }

  // 自定义业务错误
  else if (error.statusCode) {
    statusCode = error.statusCode;
    message = error.message;
  }

  // 语法错误
  else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON';
  }

  // 构建错误响应
  const errorResponse = {
    success: false,
    error: getErrorName(statusCode),
    message,
    timestamp: new Date().toISOString()
  };

  // 在开发环境中包含详细信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = details;
  } else if (details) {
    errorResponse.details = details;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 根据状态码获取错误名称
 */
function getErrorName(statusCode) {
  const errorNames = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  return errorNames[statusCode] || 'Unknown Error';
}

/**
 * 404错误处理中间件
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
