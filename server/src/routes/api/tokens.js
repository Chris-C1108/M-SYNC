/**
 * Token管理API路由
 * 处理Token的创建、查看、撤销等请求
 */

const express = require('express');
const TokenController = require('../../controllers/TokenController');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const validationMiddleware = require('../../middleware/validation');
const { tokenCreateSchema, tokenUpdateSchema } = require('../../utils/validator');

const router = express.Router();
const tokenController = new TokenController();

// 所有Token管理接口都需要认证
router.use(authenticateToken);

/**
 * GET /api/v1/tokens
 * 获取用户的所有Token
 */
router.get('/',
  tokenController.getTokens.bind(tokenController)
);

/**
 * POST /api/v1/tokens
 * 创建新的Token
 */
router.post('/',
  validationMiddleware(tokenCreateSchema),
  tokenController.createToken.bind(tokenController)
);

/**
 * GET /api/v1/tokens/current
 * 获取当前Token信息
 */
router.get('/current',
  tokenController.getCurrentToken.bind(tokenController)
);

/**
 * PUT /api/v1/tokens/:tokenId
 * 更新Token信息
 */
router.put('/:tokenId',
  validationMiddleware(tokenUpdateSchema),
  tokenController.updateToken.bind(tokenController)
);

/**
 * DELETE /api/v1/tokens/:tokenId
 * 撤销指定Token
 */
router.delete('/:tokenId',
  tokenController.revokeToken.bind(tokenController)
);

/**
 * DELETE /api/v1/tokens
 * 撤销所有Token
 */
router.delete('/',
  tokenController.revokeAllTokens.bind(tokenController)
);

module.exports = router;
