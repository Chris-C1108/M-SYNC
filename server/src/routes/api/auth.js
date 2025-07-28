/**
 * 认证相关API路由
 * 处理用户认证、注册、令牌管理等请求
 */

const express = require('express');
const AuthController = require('../../controllers/AuthController');
const { authenticateToken } = require('../../middleware/auth');
const validationMiddleware = require('../../middleware/validation');
const { loginSchema, registerSchema } = require('../../utils/validator');

const router = express.Router();
const authController = new AuthController();

/**
 * POST /api/v1/auth/register
 * 用户注册
 */
router.post('/register',
  validationMiddleware(registerSchema),
  authController.register.bind(authController)
);

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login',
  validationMiddleware(loginSchema),
  authController.login.bind(authController)
);

/**
 * GET /api/v1/auth/profile
 * 获取用户信息
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile.bind(authController)
);

/**
 * POST /api/v1/auth/logout
 * 用户登出
 */
router.post('/logout',
  authenticateToken,
  authController.logout.bind(authController)
);

module.exports = router;
