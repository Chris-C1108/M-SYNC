/**
 * 消息相关API路由
 * 处理消息发布和管理相关的HTTP请求
 */

const express = require('express');
const MessageController = require('../../controllers/MessageController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const validationMiddleware = require('../../middleware/validation');
const { messagePublishSchema } = require('../../utils/validator');

const router = express.Router();
const messageController = new MessageController();

/**
 * POST /api/v1/messages/publish
 * 发布消息接口 - 供所有客户端调用
 */
router.post('/publish',
  validationMiddleware(messagePublishSchema),
  authenticateToken,
  requirePermission('message:publish'),
  messageController.publishMessage.bind(messageController)
);

/**
 * GET /api/v1/messages/history
 * 获取消息历史记录
 */
router.get('/history',
  authenticateToken,
  requirePermission('message:read'),
  messageController.getMessageHistory.bind(messageController)
);

/**
 * GET /api/v1/messages/stats
 * 获取消息统计信息
 */
router.get('/stats',
  authenticateToken,
  requirePermission('message:read'),
  messageController.getMessageStats.bind(messageController)
);

module.exports = router;
