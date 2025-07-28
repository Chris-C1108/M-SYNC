/**
 * 数据验证工具
 * 使用Joi进行请求数据验证
 */

const Joi = require('joi');

// 消息类型枚举
const MESSAGE_TYPES = ['TEXT', 'URL', 'CODE'];

// 消息发布请求验证模式
const messagePublishSchema = Joi.object({
  token: Joi.string().required().length(128).hex()
    .description('访问令牌'),

  messageType: Joi.string().valid(...MESSAGE_TYPES).required()
    .description('消息类型'),

  content: Joi.string().required().min(1).max(1048576) // 1MB
    .description('消息内容'),

  timestamp: Joi.string().isoDate().optional()
    .description('消息时间戳')
});

// 用户注册验证模式
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required()
    .description('用户名'),
  
  email: Joi.string().email().required()
    .description('邮箱地址'),
  
  password: Joi.string().min(8).max(128).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .description('密码（至少8位，包含大小写字母、数字和特殊字符）')
});

// 用户登录验证模式
const loginSchema = Joi.object({
  username: Joi.string().required()
    .description('用户名或邮箱'),
  
  password: Joi.string().required()
    .description('密码')
});

// 分页查询验证模式
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1)
    .description('页码'),

  limit: Joi.number().integer().min(1).max(100).default(20)
    .description('每页数量'),

  messageType: Joi.string().valid(...MESSAGE_TYPES).optional()
    .description('消息类型过滤')
});

// Token创建验证模式
const tokenCreateSchema = Joi.object({
  tokenName: Joi.string().required().min(1).max(100)
    .description('Token名称'),

  deviceType: Joi.string().valid('desktop', 'ios_shortcuts', 'web', 'mobile', 'api').required()
    .description('设备类型'),

  permissions: Joi.array().items(
    Joi.string().valid('message:publish', 'message:read')
  ).min(1).optional().default(['message:publish', 'message:read'])
    .description('Token权限'),

  deviceInfo: Joi.object().optional()
    .description('设备信息'),

  expiryDays: Joi.number().integer().min(0).max(365).optional()
    .description('过期天数，0表示永不过期')
});

// Token更新验证模式
const tokenUpdateSchema = Joi.object({
  tokenName: Joi.string().min(1).max(100).optional()
    .description('Token名称'),

  deviceInfo: Joi.object().optional()
    .description('设备信息')
});

module.exports = {
  messagePublishSchema,
  registerSchema,
  loginSchema,
  paginationSchema,
  tokenCreateSchema,
  tokenUpdateSchema,
  MESSAGE_TYPES
};
