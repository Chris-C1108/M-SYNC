/**
 * 主路由配置文件
 * 统一管理所有API路由
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('config');

const messagesRouter = require('./api/messages');
const authRouter = require('./api/auth');
const tokensRouter = require('./api/tokens');
const clientRouter = require('./api/client');
const logger = require('../utils/logger');

const router = express.Router();

// 全局限流中间件
const globalRateLimit = rateLimit({
  windowMs: config.get('security.rateLimit.windowMs'),
  max: config.get('security.rateLimit.max'),
  message: {
    error: 'Too Many Requests',
    message: config.get('security.rateLimit.message')
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too Many Requests',
      message: config.get('security.rateLimit.message')
    });
  }
});

// 应用全局限流
router.use(globalRateLimit);

// 调试中间件
router.use((req, res, next) => {
  console.log('Routes index.js - Request received:', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    contentType: req.get('Content-Type'),
    body: req.body,
    bodyKeys: req.body ? Object.keys(req.body) : 'no body',
    rawBody: req.rawBody || 'no rawBody'
  });
  next();
});

// 健康检查路由
router.get('/v1/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        websocket: 'running'
      }
    }
  });
});

// API版本路由
router.use('/v1/messages', messagesRouter);
router.use('/v1/auth', authRouter);
router.use('/v1/tokens', tokensRouter);
router.use('/v1/client', clientRouter);

// API根路径信息
router.get('/', (req, res) => {
  res.json({
    name: 'M-SYNC Message Broker API',
    version: 'v1',
    endpoints: {
      messages: '/api/v1/messages',
      auth: '/api/v1/auth',
      tokens: '/api/v1/tokens'
    },
    documentation: 'https://docs.m-sync.com/api'
  });
});

// API版本信息
router.get('/v1', (req, res) => {
  res.json({
    version: 'v1',
    status: 'active',
    endpoints: [
      'POST /api/v1/messages/publish',
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/register',
      'GET /api/v1/auth/profile',
      'GET /api/v1/tokens',
      'POST /api/v1/tokens',
      'DELETE /api/v1/tokens/:tokenId'
    ]
  });
});

module.exports = router;
