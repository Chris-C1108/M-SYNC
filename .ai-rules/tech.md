---
title: Technical Architecture
description: "Defines the M-SYNC project's technology stack, architecture patterns, and implementation guidelines."
inclusion: always
---

# M-SYNC 技术架构

## 技术栈概述

### 核心技术选型
- **后端服务**: Node.js + Express + WebSocket (ws库)
- **数据库**: SQLite (轻量化) / PostgreSQL (生产环境)
- **缓存**: Redis (可选，用于连接池管理)
- **桌面客户端**: Node.js CLI Application
- **移动端**: iOS Shortcuts (原生集成)

### 架构模式
- **消息模式**: 发布-订阅 (Pub/Sub) 模式
- **通信协议**: HTTP/1.1 + WebSocket
- **认证方式**: API Token + JWT
- **部署模式**: 单体应用 + 微服务就绪

## 系统架构

### 整体架构图
```
┌─────────────────┐    HTTP POST     ┌──────────────────────┐
│   iOS Shortcuts │ ──────────────► │ MessageIngressGateway │
│ (MessagePublisher)│                 │   (Express API)      │
└─────────────────┘                 └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │ MessageBrokerService │
                                    │   (Connection Pool)  │
                                    └──────────┬───────────┘
                                               │
                                               ▼
┌─────────────────┐    WebSocket     ┌──────────────────────┐
│  Desktop Agent  │ ◄──────────────  │RealtimeMessageDispatcher│
│(MessageSubscriber)│                 │   (WebSocket Server) │
└─────────────────┘                 └──────────────────────┘
```

### 核心组件

#### 1. 消息代理服务 (MessageBrokerService)
**技术实现**: Node.js + Express + ws
```javascript
// 主要依赖
{
  "express": "^4.18.0",
  "ws": "^8.13.0",
  "sqlite3": "^5.1.6",
  "jsonwebtoken": "^9.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0"
}
```

**核心模块**:
- `MessageIngressGateway`: HTTP API 接收端点
- `RealtimeMessageDispatcher`: WebSocket 消息分发
- `ConnectionPoolManager`: 连接池管理
- `AuthenticationService`: 认证服务
- `MessageValidator`: 消息验证器

#### 2. 桌面订阅端 (Desktop Agent)
**技术实现**: Node.js CLI + 系统集成库
```javascript
// 主要依赖
{
  "ws": "^8.13.0",
  "clipboardy": "^3.0.0",
  "open": "^9.1.0",
  "node-notifier": "^10.0.1",
  "winston": "^3.10.0"
}
```

**核心模块**:
- `MessageSubscriberClient`: WebSocket 客户端
- `MessageHandlerRegistry`: 消息处理器注册表
- `ClipboardManager`: 剪贴板管理
- `BrowserLauncher`: 浏览器启动器
- `ConnectionManager`: 连接管理和重连

## 数据模型

### 数据库设计 (SQLite/PostgreSQL)

```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  api_token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表 (可选，用于历史记录)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message_type VARCHAR(10) NOT NULL, -- TEXT, URL, CODE
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 连接会话表 (如果不使用Redis)
CREATE TABLE active_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  connection_id VARCHAR(255) NOT NULL,
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 消息协议

```typescript
// 消息发布请求
interface MessagePublishRequest {
  token: string;           // API认证令牌
  messageType: 'TEXT' | 'URL' | 'CODE';
  content: string;
  timestamp?: string;
}

// 消息分发事件
interface MessageDispatchEvent {
  messageId: string;
  messageType: 'TEXT' | 'URL' | 'CODE';
  content: string;
  timestamp: string;
  publisherId: string;
}

// WebSocket 消息格式
interface WebSocketMessage {
  type: 'message' | 'ping' | 'pong' | 'auth';
  data: MessageDispatchEvent | AuthData | null;
}
```

## API 接口规范

### HTTP API

#### 消息发布接口
```
POST /api/v1/messages/publish
Content-Type: application/json
Authorization: Bearer {api_token}

Request Body:
{
  "token": "user_api_token",
  "messageType": "TEXT|URL|CODE",
  "content": "message content",
  "timestamp": "2024-01-01T00:00:00Z"
}

Response:
{
  "success": true,
  "messageId": "msg_123456",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### 用户认证接口
```
POST /api/v1/auth/login
Content-Type: application/json

Request Body:
{
  "username": "user@example.com",
  "password": "password"
}

Response:
{
  "success": true,
  "token": "jwt_token",
  "apiToken": "api_token_for_shortcuts"
}
```

### WebSocket 协议

#### 连接建立
```
WebSocket URL: wss://api.m-sync.com/ws/subscribe
Headers:
  Authorization: Bearer {jwt_token}
```

#### 消息格式
```javascript
// 认证消息
{
  "type": "auth",
  "data": {
    "token": "jwt_token"
  }
}

// 心跳消息
{
  "type": "ping",
  "data": null
}

// 业务消息
{
  "type": "message",
  "data": {
    "messageId": "msg_123",
    "messageType": "TEXT",
    "content": "Hello World",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## 配置管理

### 环境变量规范
```bash
# 服务器配置
MSYNC_BROKER_PORT=3000
MSYNC_BROKER_HOST=0.0.0.0
MSYNC_NODE_ENV=production

# 数据库配置
MSYNC_DB_TYPE=sqlite  # sqlite | postgresql
MSYNC_DB_CONNECTION_STRING=sqlite:./data/msync.db
# MSYNC_DB_CONNECTION_STRING=postgresql://user:pass@localhost:5432/msync

# Redis配置 (可选)
MSYNC_REDIS_ENABLED=false
MSYNC_REDIS_URL=redis://localhost:6379

# 认证配置
MSYNC_JWT_SECRET=your-super-secret-jwt-key
MSYNC_API_TOKEN_EXPIRY=7d

# 安全配置
MSYNC_CORS_ORIGIN=*
MSYNC_RATE_LIMIT_WINDOW=60000  # 1分钟
MSYNC_RATE_LIMIT_MAX=100       # 每分钟最大请求数
```

### 配置文件结构
```json
// config/default.json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "database": {
    "type": "sqlite",
    "connectionString": "sqlite:./data/msync.db"
  },
  "redis": {
    "enabled": false,
    "url": "redis://localhost:6379"
  },
  "auth": {
    "jwtSecret": "your-jwt-secret",
    "apiTokenExpiry": "7d"
  },
  "websocket": {
    "heartbeatInterval": 30000,
    "connectionTimeout": 60000
  }
}
```

## 部署架构

### 开发环境
```bash
# 启动开发服务器
npm run dev

# 启动桌面客户端
npm run client:dev
```

### 生产环境

#### Docker 部署
```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  msync-broker:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MSYNC_DB_TYPE=postgresql
      - MSYNC_DB_CONNECTION_STRING=postgresql://postgres:password@db:5432/msync
      - MSYNC_REDIS_ENABLED=true
      - MSYNC_REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: msync
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 性能与扩展

### 性能指标
- **消息延迟**: < 100ms (端到端)
- **并发连接**: 支持 1000+ WebSocket 连接
- **消息吞吐**: 1000+ 消息/秒
- **内存占用**: < 100MB (基础配置)

### 扩展策略
- **水平扩展**: 通过 Redis 支持多实例部署
- **负载均衡**: Nginx + 多个 Node.js 实例
- **数据库优化**: 连接池 + 读写分离

这个技术架构确保 M-SYNC 系统具备高性能、高可用性和良好的扩展性。
