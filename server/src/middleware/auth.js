/**
 * 统一认证中间件
 * 处理统一访问令牌认证
 */

const AuthenticationService = require('../services/AuthenticationService');
const logger = require('../utils/logger').createLogger('AuthMiddleware');

/**
 * 统一Token认证中间件
 * 支持Authorization头和请求体中的token字段
 */
async function authenticateToken(req, res, next) {
  try {
    let token = null;

    // 1. 尝试从Authorization头获取token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. 如果头部没有，尝试从请求体获取
    if (!token && req.body && req.body.token) {
      token = req.body.token;
    }

    // 3. 如果都没有，返回错误
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Access token is required'
      });
    }

    // 4. 验证Token
    const authService = new AuthenticationService();
    const { user, accessToken } = await authService.verifyToken(token);

    // 5. 将用户和Token信息添加到请求对象
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    req.accessToken = {
      id: accessToken.id,
      deviceType: accessToken.deviceType,
      permissions: accessToken.permissions
    };

    logger.debug('Token authentication successful', {
      userId: user.id,
      tokenId: accessToken.id,
      deviceType: accessToken.deviceType
    });

    next();

  } catch (error) {
    logger.warn('Token authentication failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token has expired'
      });
    }

    if (error.message.includes('Invalid')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid access token'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
}

/**
 * 权限检查中间件
 * 检查Token是否具有特定权限
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!req.accessToken.permissions.includes(permission)) {
      logger.warn('Permission denied', {
        userId: req.user.id,
        tokenId: req.accessToken.id,
        requiredPermission: permission,
        userPermissions: req.accessToken.permissions
      });

      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Permission '${permission}' is required`
      });
    }

    next();
  };
}

/**
 * 可选认证中间件
 * 如果提供了认证信息则验证，否则继续执行
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const bodyToken = req.body && req.body.token;

  if (!authHeader && !bodyToken) {
    return next();
  }

  try {
    await authenticateToken(req, res, next);
  } catch (error) {
    // 认证失败但不阻止请求继续
    next();
  }
}

module.exports = {
  authenticateToken,
  requirePermission,
  optionalAuth
};
