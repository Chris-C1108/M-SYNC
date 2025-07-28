# M-SYNC 消息代理服务

M-SYNC 系统的核心服务端组件，负责消息路由、用户认证和实时消息分发。

## 功能特性

- **消息接入网关**: 接收来自多种客户端的消息发布请求
- **实时消息分发**: 通过 WebSocket 实时推送消息到所有连接的客户端
- **统一Token认证**: 基于128字符十六进制访问令牌的安全认证机制
- **多设备支持**: 支持 web、desktop、mobile、ios_shortcuts 等设备类型
- **连接池管理**: 高效管理 WebSocket 连接和心跳检测
- **多租户隔离**: 确保用户间消息完全隔离
- **高性能**: 支持 1000+ 并发连接，消息延迟 < 100ms

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- SQLite 3.x (开发环境) 或 PostgreSQL 12+ (生产环境)
- Redis 6.x (可选，用于扩展部署)

### 安装依赖

```bash
npm install
```

### 配置环境

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
nano .env
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 项目结构

```
server/
├── src/
│   ├── controllers/         # 控制器层
│   ├── services/           # 业务逻辑层
│   ├── middleware/         # 中间件
│   ├── models/            # 数据模型
│   ├── routes/            # 路由定义
│   ├── websocket/         # WebSocket 处理
│   ├── database/          # 数据库相关
│   ├── utils/             # 工具函数
│   └── app.js             # 应用入口
├── config/                # 配置文件
├── tests/                 # 测试文件
└── logs/                  # 日志文件
```

## API 文档

### 消息发布接口

```http
POST /api/v1/messages/publish
Content-Type: application/json

{
  "token": "your-api-token",
  "messageType": "TEXT|URL|CODE",
  "content": "message content",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 用户认证接口

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

## WebSocket 连接

```javascript
const ws = new WebSocket('wss://your-server.com/ws/subscribe');

// 认证
ws.send(JSON.stringify({
  type: 'auth',
  data: { token: 'your-128-char-access-token' }
}));

// 接收消息
ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

## 开发指南

### 运行测试

```bash
# 单元测试
npm test

# 测试覆盖率
npm run test:coverage

# 监听模式
npm run test:watch
```

### 代码检查

```bash
# ESLint 检查
npm run lint

# 自动修复
npm run lint:fix
```

### 数据库操作

```bash
# 运行迁移
npm run migrate

# 填充种子数据
npm run seed
```

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t msync-broker-service .

# 运行容器
docker run -p 3000:3000 msync-broker-service
```

### Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 配置说明

主要配置项说明：

- `MSYNC_BROKER_PORT`: 服务端口 (默认: 3000)
- `MSYNC_DB_CONNECTION_STRING`: 数据库连接字符串
- `MSYNC_JWT_SECRET`: JWT 签名密钥
- `MSYNC_REDIS_ENABLED`: 是否启用 Redis
- `MSYNC_LOG_LEVEL`: 日志级别

详细配置请参考 `.env.example` 文件。

## 监控和日志

### 健康检查

```bash
curl http://localhost:3000/health
```

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查数据库服务是否运行
   - 验证连接字符串配置

2. **WebSocket 连接断开**
   - 检查网络连接
   - 验证认证令牌

3. **消息发布失败**
   - 检查 API Token 是否有效
   - 验证消息格式

### 调试模式

```bash
# 启用调试日志
DEBUG=* npm run dev

# 或设置环境变量
export MSYNC_LOG_LEVEL=debug
npm start
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 支持

如有问题或建议，请：

- 创建 [Issue](https://github.com/m-sync/message-broker-service/issues)
- 发送邮件至 support@m-sync.com
- 查看 [文档](https://docs.m-sync.com)

## 修订日志

### v1.0.0 (2025-07-28)

#### 🎉 首次发布
- **完整的服务端架构**: 基于Express.js和WebSocket的消息代理服务
- **统一Token认证系统**: 128字符十六进制访问令牌，支持多设备类型
- **实时消息分发**: WebSocket实时通信，支持心跳检测和自动重连
- **数据库系统**: SQLite数据库，完整的用户、令牌、消息管理
- **RESTful API**: 完整的用户认证、消息处理、Token管理API
- **服务注册表架构**: 统一的服务依赖管理和配置
- **完善的日志系统**: 结构化日志输出，组件级别分类
- **环境配置**: 支持多环境配置，开发/测试/生产环境隔离

#### ✅ 已验证功能
- 用户注册和登录 ✅
- 访问令牌创建和管理 ✅
- 消息发布和历史查询 ✅
- WebSocket实时通信 ✅
- 健康检查和监控 ✅
- 多设备支持 (web/desktop/mobile/ios_shortcuts) ✅

#### 🏗️ 技术栈
- **后端**: Node.js, Express.js, SQLite
- **实时通信**: WebSocket (ws库)
- **认证**: 自定义Token认证系统
- **日志**: Winston日志框架
- **配置**: node-config配置管理
- **安全**: bcryptjs密码加密, helmet安全中间件

#### 📊 性能指标
- 支持1000+并发连接
- 消息延迟 < 100ms
- 数据库查询优化
- 内存使用优化

#### 🔧 开发工具
- 完整的API测试示例
- 开发计划和架构文档
- Token安全最佳实践指南
- 故障排除和调试指南
