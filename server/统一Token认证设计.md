# M-SYNC 统一Token认证系统设计

## 🎯 **设计概述**

经过重新设计，M-SYNC 系统采用**统一Token认证机制**，将原来的 JWT Token 和 API Token 合并为单一的访问令牌系统，提供更简洁、安全、易管理的认证方案。

## 🔄 **设计变更对比**

### **原设计 (双Token系统)**
```
JWT Token (24小时) ←→ 桌面客户端
API Token (7天)   ←→ iOS快捷指令
```

### **新设计 (统一Token系统)**
```
Access Token (30天) ←→ 所有客户端类型
- 桌面客户端
- iOS快捷指令  
- Web界面
- 移动应用
```

## 📊 **数据模型设计**

### **用户表 (users)**
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_login_at DATETIME
);
```

### **访问令牌表 (access_tokens)**
```sql
CREATE TABLE access_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_name VARCHAR(100),
    device_type VARCHAR(20) NOT NULL,
    device_info JSON,
    client_info JSON,
    permissions JSON DEFAULT '["message:publish", "message:read"]',
    expires_at DATETIME,
    last_used_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 🔐 **Token设计特性**

### **Token格式**
- **长度**: 128个十六进制字符
- **生成**: `crypto.randomBytes(64).toString('hex')`
- **存储**: SHA-256哈希存储在数据库中
- **传输**: 完整Token仅在创建时返回给用户

### **Token属性**
```javascript
{
  id: "uuid-v4",                    // Token唯一标识
  tokenName: "iOS快捷指令 - 主设备",   // 用户自定义名称
  deviceType: "ios_shortcuts",      // 设备类型
  deviceInfo: {                     // 设备信息
    platform: "iOS 17.2",
    deviceModel: "iPhone 15 Pro"
  },
  permissions: [                    // 权限列表
    "message:publish",
    "message:read"
  ],
  expiresAt: "2024-02-01T00:00:00Z", // 过期时间
  lastUsedAt: "2024-01-15T10:30:00Z" // 最后使用时间
}
```

## 🛠️ **API接口设计**

### **1. Token管理接口**

#### **获取所有Token**
```http
GET /api/v1/tokens
Authorization: Bearer <access-token>

Response:
{
  "success": true,
  "data": {
    "tokens": [...],
    "total": 5,
    "active": 3
  }
}
```

#### **创建新Token**
```http
POST /api/v1/tokens
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "tokenName": "新的iOS快捷指令",
  "deviceType": "ios_shortcuts",
  "deviceInfo": {
    "platform": "iOS 17.2",
    "deviceModel": "iPhone 15 Pro"
  },
  "expiryDays": 30
}

Response:
{
  "success": true,
  "data": {
    "token": "128-char-hex-string", // 完整Token，仅此时返回
    "tokenInfo": { ... }
  }
}
```

#### **撤销Token**
```http
DELETE /api/v1/tokens/:tokenId
Authorization: Bearer <access-token>

Response:
{
  "success": true,
  "message": "Token revoked successfully"
}
```

#### **撤销所有Token**
```http
DELETE /api/v1/tokens?excludeCurrent=true
Authorization: Bearer <access-token>

Response:
{
  "success": true,
  "data": {
    "revokedCount": 4,
    "excludedCurrentToken": true
  }
}
```

### **2. 统一认证接口**

#### **用户注册**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "128-char-hex-string",
    "tokenInfo": { ... }
  }
}
```

#### **用户登录**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "128-char-hex-string",
    "tokenInfo": { ... }
  }
}
```

### **3. 消息发布接口**

#### **发布消息 (统一接口)**
```http
POST /api/v1/messages/publish
Content-Type: application/json

{
  "token": "128-char-hex-string",
  "messageType": "TEXT",
  "content": "Hello World"
}

# 或使用Authorization头
POST /api/v1/messages/publish
Authorization: Bearer 128-char-hex-string
Content-Type: application/json

{
  "messageType": "TEXT", 
  "content": "Hello World"
}
```

## 🔒 **认证中间件设计**

### **统一认证中间件**
```javascript
async function authenticateToken(req, res, next) {
  let token = null;

  // 1. 尝试从Authorization头获取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. 尝试从请求体获取
  if (!token && req.body && req.body.token) {
    token = req.body.token;
  }

  // 3. 验证Token
  const { user, accessToken } = await authService.verifyToken(token);
  
  req.user = user;
  req.accessToken = accessToken;
  next();
}
```

### **权限检查中间件**
```javascript
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.accessToken.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${permission}' is required`
      });
    }
    next();
  };
}
```

## 📱 **客户端适配**

### **iOS快捷指令**
```javascript
// 快捷指令中的HTTP请求
const response = await fetch('https://api.m-sync.com/api/v1/messages/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: 'user-access-token-128-chars',
    messageType: 'TEXT',
    content: shortcutInput
  })
});
```

### **桌面客户端**
```javascript
// WebSocket连接
const ws = new WebSocket('wss://api.m-sync.com/ws/subscribe', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// HTTP API调用
fetch('/api/v1/tokens', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

## 🎛️ **Token管理界面设计**

### **Web管理界面功能**
1. **Token列表显示**
   - Token名称和设备类型
   - 创建时间和最后使用时间
   - 过期状态和剩余天数
   - 权限列表

2. **Token操作**
   - 创建新Token (指定名称、设备类型、过期时间)
   - 编辑Token名称和设备信息
   - 撤销单个Token
   - 批量撤销Token

3. **安全功能**
   - 撤销所有Token (紧急情况)
   - Token使用统计和异常检测
   - 登录设备管理

### **CLI管理工具**
```bash
# 桌面客户端内置Token管理
msync-client token list
msync-client token create --name "新设备" --type desktop
msync-client token revoke --id token-uuid
msync-client token revoke-all --exclude-current
```

## 🔄 **迁移策略**

### **从双Token系统迁移**
1. **数据库迁移**
   - 运行新的数据库迁移脚本
   - 为现有用户创建默认访问令牌
   - 保留用户基础信息

2. **客户端更新**
   - 桌面客户端: 更新认证逻辑，移除JWT处理
   - iOS快捷指令: 更新API调用，使用新Token格式

3. **向后兼容**
   - 暂时保留旧API端点，返回迁移提示
   - 提供迁移工具和文档

## 📈 **系统优势**

### **1. 简化架构**
- **单一认证流程**: 所有客户端使用相同的认证机制
- **统一权限管理**: 基于权限的访问控制
- **减少复杂性**: 移除JWT相关的复杂逻辑

### **2. 增强安全性**
- **Token哈希存储**: 数据库中仅存储Token哈希
- **细粒度权限**: 支持不同权限组合
- **使用追踪**: 详细的Token使用记录

### **3. 改善用户体验**
- **统一管理**: 一个界面管理所有设备Token
- **灵活命名**: 用户可自定义Token名称
- **即时撤销**: 快速响应安全事件

### **4. 运维友好**
- **清晰监控**: Token使用情况一目了然
- **简化部署**: 减少配置项和依赖
- **易于扩展**: 支持新的客户端类型和权限

## 🚀 **实施计划**

### **Phase 1: 核心系统 (1-2周)**
- 实现AccessToken模型和数据库迁移
- 更新AuthenticationService
- 实现统一认证中间件

### **Phase 2: API接口 (1周)**
- 实现TokenController和相关路由
- 更新现有API接口
- 完善权限检查机制

### **Phase 3: 客户端适配 (1-2周)**
- 更新桌面客户端认证逻辑
- 更新iOS快捷指令模板
- 实现Token管理界面

### **Phase 4: 测试和部署 (1周)**
- 完整的端到端测试
- 性能测试和安全审计
- 生产环境部署和监控

这个统一Token认证系统为M-SYNC提供了更加现代、安全、易用的认证解决方案！
