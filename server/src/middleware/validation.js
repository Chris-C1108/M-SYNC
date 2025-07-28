/**
 * 请求验证中间件
 * 使用Joi进行请求数据验证
 */

const logger = require('../utils/logger');

/**
 * 创建验证中间件
 * @param {Object} schema - Joi验证模式
 * @param {string} property - 要验证的请求属性 ('body', 'query', 'params')
 */
function validationMiddleware(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // 返回所有验证错误
      stripUnknown: true // 移除未知字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Request data validation failed',
        details: errors
      });
    }

    // 使用验证后的值替换原始值
    req[property] = value;
    next();
  };
}

/**
 * 查询参数验证中间件
 */
function validateQuery(schema) {
  return validationMiddleware(schema, 'query');
}

/**
 * 路径参数验证中间件
 */
function validateParams(schema) {
  return validationMiddleware(schema, 'params');
}

/**
 * 请求体验证中间件
 */
function validateBody(schema) {
  return validationMiddleware(schema, 'body');
}

module.exports = validationMiddleware;
module.exports.validateQuery = validateQuery;
module.exports.validateParams = validateParams;
module.exports.validateBody = validateBody;
