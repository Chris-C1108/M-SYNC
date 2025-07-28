# M-SYNC 统一Token认证API测试示例

## 1. 用户注册测试

### 1.1 成功注册

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "testuser",
      "email": "test@example.com",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "lastLoginAt": null
    },
    "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789012345678901234567890abcdef1234567890abcdef12345678901234567890abcdef",
    "tokenInfo": {
      "id": "token-uuid-v4",
      "tokenName": "web - 注册时创建",
      "deviceType": "web",
      "permissions": ["message:publish", "message:read"],
      "expiresAt": "2024-02-01T00:00:00Z",
      "isActive": true
    }
  }
}
```

### 1.2 注册失败 - 用户名已存在

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "another@example.com",
    "password": "SecurePass123!"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": "Conflict",
  "message": "Username 'testuser' already exists"
}
```

### 1.3 注册失败 - 密码强度不足

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "new@example.com",
    "password": "weak"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Request data validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character"
    }
  ]
}
```

## 2. 用户登录测试

### 2.1 成功登录

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePass123!"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "testuser",
      "email": "test@example.com",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "lastLoginAt": "2024-01-01T10:05:00.000Z"
    },
    "token": "a1b2c3d4e5f6789012345678901234567890abcdef...",
    "tokenInfo": {
      "id": "token-uuid-v4",
      "tokenName": "web - 登录创建",
      "deviceType": "web",
      "permissions": ["message:publish", "message:read"],
      "expiresAt": "2024-02-01T00:00:00Z",
      "isActive": true
    }
  }
}
```

### 2.2 登录失败 - 密码错误

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "wrongpassword"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

## 3. 访问令牌使用测试

### 3.1 获取用户信息

```bash
# 使用登录获得的访问令牌
ACCESS_TOKEN="a1b2c3d4e5f6789012345678901234567890abcdef..."

curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "testuser",
      "email": "test@example.com",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "lastLoginAt": "2024-01-01T10:05:00.000Z"
    }
  }
}
```

### 3.2 访问令牌过期测试

```bash
# 使用过期的访问令牌
EXPIRED_TOKEN="expired-token-128-chars"

curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $EXPIRED_TOKEN"
```

**预期响应**:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Token has expired"
}
```

## 4. Token管理测试

### 4.1 获取所有Token

```bash
# 使用有效的访问令牌获取Token列表
ACCESS_TOKEN="a1b2c3d4e5f6789012345678901234567890abcdef..."

curl -X GET http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**预期响应**:
```json
{
  "success": true,
  "data": {
    "tokens": [
      {
        "id": "token-uuid-1",
        "tokenName": "iPhone 主设备",
        "deviceType": "ios_shortcuts",
        "permissions": ["message:publish", "message:read"],
        "expiresAt": "2024-02-01T00:00:00Z",
        "lastUsedAt": "2024-01-15T10:30:00Z",
        "isActive": true,
        "isExpired": false
      }
    ],
    "total": 3,
    "active": 2
  }
}
```

### 4.2 创建新Token

```bash
curl -X POST http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenName": "新的iOS快捷指令",
    "deviceType": "ios_shortcuts",
    "expiryDays": 30
  }'
```

**预期响应**:
```json
{
  "success": true,
  "message": "Token created successfully",
  "data": {
    "token": "new-128-char-hex-token",
    "tokenInfo": {
      "id": "new-token-uuid",
      "tokenName": "新的iOS快捷指令",
      "deviceType": "ios_shortcuts",
      "permissions": ["message:publish", "message:read"],
      "expiresAt": "2024-02-15T00:00:00Z",
      "isActive": true
    }
  }
}
```

## 5. 消息发布测试

### 5.1 使用访问令牌发布消息（请求体方式）

```bash
# 使用访问令牌（模拟iOS快捷指令）
ACCESS_TOKEN="a1b2c3d4e5f6789012345678901234567890abcdef..."

curl -X POST http://localhost:3000/api/v1/messages/publish \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$ACCESS_TOKEN'",
    "messageType": "TEXT",
    "content": "Hello from iOS Shortcuts!",
    "timestamp": "2024-01-01T10:10:00.000Z"
  }'
```

**预期响应**:
```json
{
  "success": true,
  "messageId": "msg-550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2024-01-01T10:10:00.000Z",
  "deliveredTo": 2
}
```

### 5.2 使用访问令牌发布消息（Authorization头方式）

```bash
# 使用Authorization头（模拟桌面客户端）
ACCESS_TOKEN="a1b2c3d4e5f6789012345678901234567890abcdef..."

curl -X POST http://localhost:3000/api/v1/messages/publish \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messageType": "TEXT",
    "content": "Hello from Desktop Client!"
  }'
```

### 5.3 访问令牌无效测试

```bash
curl -X POST http://localhost:3000/api/v1/messages/publish \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token-128-chars",
    "messageType": "TEXT",
    "content": "This should fail"
  }'
```

**预期响应**:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid access token"
}
```

## 6. WebSocket 连接测试

### 6.1 使用访问令牌建立WebSocket连接

```javascript
// JavaScript WebSocket客户端测试
const WebSocket = require('ws');

const accessToken = 'a1b2c3d4e5f6789012345678901234567890abcdef...';
const ws = new WebSocket('ws://localhost:3000/ws/subscribe', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

ws.on('open', () => {
  console.log('WebSocket connected');

  // 发送认证消息
  ws.send(JSON.stringify({
    type: 'auth',
    data: { token: accessToken }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

### 6.2 WebSocket 心跳测试

```javascript
// 心跳机制测试
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'ping',
      data: null
    }));
  }
}, 30000); // 每30秒发送心跳

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'pong') {
    console.log('Heartbeat response received');
  } else if (message.type === 'message') {
    console.log('Business message:', message.data);
  }
});
```

## 7. 完整的端到端测试流程

```bash
#!/bin/bash

# 1. 用户注册
echo "=== 用户注册 ==="
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "e2etest",
    "email": "e2e@example.com",
    "password": "E2ETest123!"
  }')

echo $REGISTER_RESPONSE | jq .

# 提取访问令牌
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
TOKEN_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.tokenInfo.id')

echo "Access Token: $ACCESS_TOKEN"
echo "Token ID: $TOKEN_ID"

# 2. 使用访问令牌获取用户信息
echo -e "\n=== 获取用户信息 ==="
curl -s -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# 3. 使用访问令牌发布消息
echo -e "\n=== 发布消息 ==="
curl -s -X POST http://localhost:3000/api/v1/messages/publish \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$ACCESS_TOKEN'",
    "messageType": "TEXT",
    "content": "End-to-end test message"
  }' | jq .

# 4. 获取Token列表
echo -e "\n=== 获取Token列表 ==="
curl -s -X GET http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# 5. 创建新Token
echo -e "\n=== 创建新Token ==="
NEW_TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/tokens \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenName": "测试Token",
    "deviceType": "ios_shortcuts",
    "expiryDays": 7
  }')

echo $NEW_TOKEN_RESPONSE | jq .

NEW_ACCESS_TOKEN=$(echo $NEW_TOKEN_RESPONSE | jq -r '.data.token')
echo "New Access Token: $NEW_ACCESS_TOKEN"

# 6. 使用新Token发布消息
echo -e "\n=== 使用新Token发布消息 ==="
curl -s -X POST http://localhost:3000/api/v1/messages/publish \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'$NEW_ACCESS_TOKEN'",
    "messageType": "TEXT",
    "content": "Message with new token"
  }' | jq .

echo -e "\n=== 测试完成 ==="
```

## 8. 性能测试

### 8.1 并发注册测试

```bash
#!/bin/bash

# 并发注册测试
for i in {1..10}; do
  (
    curl -s -X POST http://localhost:3000/api/v1/auth/register \
      -H "Content-Type: application/json" \
      -d '{
        "username": "user'$i'",
        "email": "user'$i'@example.com",
        "password": "Password123!"
      }' &
  )
done

wait
echo "并发注册测试完成"
```

### 8.2 Token验证性能测试

```bash
#!/bin/bash

# 获取有效的访问令牌
ACCESS_TOKEN="your-access-token-here"

# 并发访问令牌验证测试
for i in {1..100}; do
  (
    curl -s -X POST http://localhost:3000/api/v1/messages/publish \
      -H "Content-Type: application/json" \
      -d '{
        "token": "'$ACCESS_TOKEN'",
        "messageType": "TEXT",
        "content": "Performance test message '$i'"
      }' > /dev/null &
  )
done

wait
echo "Token验证性能测试完成"
```

这些测试示例涵盖了M-SYNC统一Token认证系统的所有关键场景，包括用户注册、Token管理、消息发布等功能，可以用于验证系统的正确性和性能。
