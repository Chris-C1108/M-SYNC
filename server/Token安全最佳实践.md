# M-SYNC 统一Token安全最佳实践

## 1. 统一Token设计安全原则

### 1.1 最小权限原则
- **访问令牌**: 基于权限列表的细粒度控制
- **设备隔离**: 不同设备类型的Token权限可独立配置
- **权限验证**: 每个API调用都进行权限检查

### 1.2 时效性原则
- **统一有效期**: 默认30天，可配置
- **灵活过期**: 支持永不过期或自定义过期时间
- **自动失效**: 过期Token自动失效，无需手动撤销

### 1.3 唯一性原则
- **全局唯一**: 每个Token在系统中全局唯一
- **用户隔离**: 不同用户的Token完全独立
- **设备管理**: 支持多设备Token管理

## 2. 统一Token生成安全

### 2.1 访问令牌安全生成

```javascript
class AccessTokenSecurity {
  static generateSecureToken() {
    // 使用加密安全的随机数生成器
    const randomBytes = crypto.randomBytes(64);

    // 添加时间戳和随机盐防止碰撞
    const timestamp = Date.now().toString(36);
    const salt = crypto.randomBytes(8).toString('hex');

    // 组合所有熵源
    const combined = Buffer.concat([
      randomBytes,
      Buffer.from(timestamp + salt, 'utf8')
    ]);

    // 使用SHA-256哈希确保均匀分布
    return crypto.createHash('sha256')
      .update(combined)
      .digest('hex');
  }

  static validateTokenStrength(token) {
    // 检查Token长度
    if (token.length !== 128) {
      throw new Error('Access token must be 128 characters');
    }

    // 检查Token熵（简单检查）
    const uniqueChars = new Set(token).size;
    if (uniqueChars < 12) {
      throw new Error('Access token has insufficient entropy');
    }

    // 检查是否为有效的十六进制字符串
    if (!/^[0-9a-f]{128}$/i.test(token)) {
      throw new Error('Access token must be valid hexadecimal');
    }

    return true;
  }

  static hashToken(token) {
    // 使用SHA-256哈希Token用于数据库存储
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
```

## 3. Token 存储安全

### 3.1 服务端存储

```javascript
class SecureTokenStorage {
  // JWT密钥安全存储
  static getJWTSecret() {
    const secret = process.env.MSYNC_JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    // 验证密钥强度
    if (secret.length < 32) {
      throw new Error('JWT secret is too weak');
    }

    return secret;
  }

  // API Token数据库存储（考虑加密）
  static async storeApiToken(userId, apiToken) {
    // 选项1: 明文存储（当前实现，便于查询）
    await db.run(
      'UPDATE users SET api_token = ?, api_token_expiry = ? WHERE id = ?',
      [apiToken, this.calculateExpiry(), userId]
    );

    // 选项2: 哈希存储（更安全，但无法显示给用户）
    // const hashedToken = crypto.createHash('sha256').update(apiToken).digest('hex');
    // await db.run(
    //   'UPDATE users SET api_token_hash = ?, api_token_expiry = ? WHERE id = ?',
    //   [hashedToken, this.calculateExpiry(), userId]
    // );
  }
}
```

### 3.2 客户端存储

```javascript
// 桌面客户端安全存储
class ClientTokenStorage {
  constructor() {
    this.jwtToken = null; // 仅内存存储
    this.configPath = path.join(os.homedir(), '.msync', 'config.json');
  }

  // JWT Token - 仅内存存储
  setJWTToken(token) {
    this.jwtToken = token;
    // 不写入文件系统
  }

  getJWTToken() {
    return this.jwtToken;
  }

  clearJWTToken() {
    this.jwtToken = null;
  }

  // API Token - 安全文件存储
  async storeApiToken(apiToken) {
    const config = await this.loadConfig();
    config.apiToken = apiToken;
    
    // 设置严格的文件权限 (仅所有者可读写)
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), {
      mode: 0o600
    });
  }

  async loadConfig() {
    try {
      // 检查文件权限
      const stats = await fs.stat(this.configPath);
      if (stats.mode & 0o077) {
        console.warn('Config file has overly permissive permissions');
      }

      const data = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }
}
```

## 4. Token 传输安全

### 4.1 HTTPS/WSS 强制

```javascript
// 服务端强制HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// WebSocket强制WSS
const wsServer = new WebSocket.Server({
  server: httpsServer, // 使用HTTPS服务器
  verifyClient: (info) => {
    // 验证连接来源
    const origin = info.origin;
    const allowedOrigins = config.get('security.allowedOrigins');
    
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return true;
    }
    
    logger.warn('WebSocket connection rejected', { origin });
    return false;
  }
});
```

### 4.2 请求头安全

```javascript
// 安全的Token传输
class SecureTransport {
  // JWT在Authorization头中传输
  static extractJWTFromHeader(req) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    
    // 基本格式验证
    if (!token || token.split('.').length !== 3) {
      throw new Error('Invalid JWT format');
    }

    return token;
  }

  // API Token在请求体中传输（避免日志泄露）
  static extractApiTokenFromBody(req) {
    const { token } = req.body;
    
    if (!token) {
      throw new Error('API token is required');
    }

    // 验证Token格式
    if (typeof token !== 'string' || token.length !== 64) {
      throw new Error('Invalid API token format');
    }

    return token;
  }
}
```

## 5. Token 验证安全

### 5.1 JWT 验证增强

```javascript
class EnhancedJWTValidator {
  constructor() {
    this.blacklistedTokens = new Set(); // 在生产环境中使用Redis
  }

  async validateJWT(token) {
    try {
      // 1. 检查Token是否在黑名单中
      if (this.blacklistedTokens.has(token)) {
        throw new Error('Token has been revoked');
      }

      // 2. 验证Token签名和过期时间
      const decoded = jwt.verify(token, this.getJWTSecret(), {
        issuer: 'msync-broker-service',
        audience: 'msync-clients',
        algorithms: ['HS256']
      });

      // 3. 验证用户是否仍然存在且活跃
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // 4. 检查Token是否在用户最后密码更改之后签发
      if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt) {
        throw new Error('Token issued before password change');
      }

      return { decoded, user };

    } catch (error) {
      logger.warn('JWT validation failed', {
        error: error.message,
        token: token.substring(0, 20) + '...'
      });
      throw error;
    }
  }

  // 将Token加入黑名单
  revokeToken(token) {
    this.blacklistedTokens.add(token);
    
    // 在生产环境中，应该存储到Redis并设置过期时间
    // redis.setex(`blacklist:${token}`, 86400, '1'); // 24小时过期
  }
}
```

### 5.2 API Token 验证增强

```javascript
class EnhancedAPITokenValidator {
  async validateApiToken(token) {
    try {
      // 1. 基本格式验证
      if (!token || typeof token !== 'string' || token.length !== 64) {
        throw new Error('Invalid token format');
      }

      // 2. 数据库查询验证
      const user = await User.findByApiToken(token);
      if (!user) {
        throw new Error('Invalid API token');
      }

      // 3. 检查用户状态
      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      // 4. 检查Token过期时间
      if (user.apiTokenExpiry && new Date(user.apiTokenExpiry) < new Date()) {
        throw new Error('API token has expired');
      }

      // 5. 更新最后使用时间（可选）
      await this.updateTokenLastUsed(user.id);

      return user;

    } catch (error) {
      logger.warn('API token validation failed', {
        error: error.message,
        tokenPrefix: token.substring(0, 8) + '...'
      });
      throw error;
    }
  }

  async updateTokenLastUsed(userId) {
    try {
      await db.run(
        'UPDATE users SET api_token_last_used = ? WHERE id = ?',
        [new Date().toISOString(), userId]
      );
    } catch (error) {
      // 记录错误但不影响主流程
      logger.warn('Failed to update token last used time', error);
    }
  }
}
```

## 6. 安全监控和审计

### 6.1 Token 使用监控

```javascript
class TokenSecurityMonitor {
  constructor() {
    this.suspiciousActivity = new Map();
  }

  // 监控异常Token使用
  async monitorTokenUsage(token, userId, clientInfo) {
    const key = `${userId}:${clientInfo.ip}`;
    const now = Date.now();

    // 检查频率限制
    const usage = this.suspiciousActivity.get(key) || { count: 0, firstSeen: now };
    usage.count++;
    usage.lastSeen = now;

    // 如果在短时间内有大量请求，标记为可疑
    if (usage.count > 100 && (now - usage.firstSeen) < 60000) { // 1分钟内超过100次
      logger.warn('Suspicious token usage detected', {
        userId,
        ip: clientInfo.ip,
        count: usage.count,
        timespan: now - usage.firstSeen
      });

      // 可以考虑临时封禁或要求重新认证
      await this.handleSuspiciousActivity(userId, clientInfo);
    }

    this.suspiciousActivity.set(key, usage);
  }

  async handleSuspiciousActivity(userId, clientInfo) {
    // 记录安全事件
    logger.error('Security incident: Suspicious token usage', {
      userId,
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      timestamp: new Date().toISOString()
    });

    // 可选：撤销用户的所有Token
    // await this.revokeAllUserTokens(userId);

    // 可选：发送安全警报邮件
    // await this.sendSecurityAlert(userId);
  }
}
```

### 6.2 安全审计日志

```javascript
class SecurityAuditLogger {
  static logAuthEvent(event, userId, details = {}) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      ip: details.ip,
      userAgent: details.userAgent,
      success: details.success,
      error: details.error,
      metadata: details.metadata
    };

    // 写入专门的安全审计日志
    logger.info('SECURITY_AUDIT', auditLog);

    // 在生产环境中，可以发送到专门的安全监控系统
    // await this.sendToSecurityMonitoring(auditLog);
  }

  static logTokenEvent(event, tokenType, userId, details = {}) {
    this.logAuthEvent(`TOKEN_${event}`, userId, {
      ...details,
      tokenType,
      tokenPrefix: details.token?.substring(0, 8) + '...'
    });
  }
}

// 使用示例
SecurityAuditLogger.logTokenEvent('GENERATED', 'JWT', userId, {
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  success: true
});

SecurityAuditLogger.logTokenEvent('VALIDATION_FAILED', 'API', null, {
  ip: req.ip,
  error: 'Invalid token format',
  success: false
});
```

## 7. 应急响应计划

### 7.1 Token 泄露响应

```javascript
class TokenIncidentResponse {
  // Token泄露时的应急处理
  async handleTokenCompromise(userId, tokenType) {
    logger.error('Token compromise detected', { userId, tokenType });

    try {
      // 1. 立即撤销所有相关Token
      await this.revokeAllUserTokens(userId);

      // 2. 强制用户重新登录
      await this.forceUserReauth(userId);

      // 3. 记录安全事件
      await this.logSecurityIncident(userId, 'TOKEN_COMPROMISE', {
        tokenType,
        timestamp: new Date().toISOString()
      });

      // 4. 通知用户（如果有邮箱）
      await this.notifyUserOfCompromise(userId);

      logger.info('Token compromise response completed', { userId });

    } catch (error) {
      logger.error('Failed to handle token compromise', { userId, error });
      throw error;
    }
  }

  async revokeAllUserTokens(userId) {
    // 刷新用户的API Token
    const user = await User.findById(userId);
    if (user) {
      await user.refreshApiToken();
    }

    // 将用户的JWT加入黑名单（需要Redis支持）
    // 在简化实现中，可以更新用户的密码更改时间戳
    await db.run(
      'UPDATE users SET password_changed_at = ? WHERE id = ?',
      [Math.floor(Date.now() / 1000), userId]
    );
  }
}
```

这些安全最佳实践确保了M-SYNC系统的Token机制具备企业级的安全性，能够有效防范各种安全威胁。
