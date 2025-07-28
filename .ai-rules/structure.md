---
title: Project Structure
description: "Defines the M-SYNC project's file organization, naming conventions, and development workflow."
inclusion: always
---

# M-SYNC 项目结构

## 项目根目录结构

```
M-SYNC/
├── .ai-rules/                    # AI 代理指导文件
│   ├── product.md               # 产品愿景和功能定义
│   ├── tech.md                  # 技术架构和实现指南
│   └── structure.md             # 项目结构和开发规范
├── docs/                        # 项目文档
│   ├── api/                     # API 文档
│   ├── deployment/              # 部署指南
│   └── user-guide/              # 用户使用指南
├── server/                      # 消息代理服务 (MessageBrokerService)
│   ├── src/                     # 源代码
│   ├── config/                  # 配置文件
│   ├── tests/                   # 测试文件
│   ├── package.json
│   └── README.md
├── client/                      # 桌面订阅端 (Desktop Agent)
│   ├── src/                     # 源代码
│   ├── config/                  # 配置文件
│   ├── tests/                   # 测试文件
│   ├── package.json
│   └── README.md
├── ios-shortcuts/               # iOS 快捷指令配置
│   ├── shortcuts/               # 快捷指令文件
│   ├── templates/               # 配置模板
│   └── README.md
├── deployment/                  # 部署相关文件
│   ├── docker/                  # Docker 配置
│   └── scripts/                 # 部署脚本
├── tools/                       # 开发工具和脚本
│   ├── setup/                   # 环境设置脚本
│   └── migration/               # 数据迁移脚本
├── .gitignore
├── .env.example                 # 环境变量示例
├── docker-compose.yml           # Docker Compose 配置
├── package.json                 # 根项目配置
└── README.md                    # 项目说明
```

## 服务端结构 (server/)

### 目录组织
```
server/
├── src/
│   ├── controllers/             # 控制器层
│   │   ├── MessageController.js
│   │   └── AuthController.js
│   ├── services/                # 业务逻辑层
│   │   ├── MessageBrokerService.js
│   │   ├── AuthenticationService.js
│   │   └── ConnectionPoolManager.js
│   ├── middleware/              # 中间件
│   │   ├── auth.js
│   │   ├── validation.js
│   │   └── rateLimit.js
│   ├── models/                  # 数据模型
│   │   ├── User.js
│   │   └── Message.js
│   ├── routes/                  # 路由定义
│   │   ├── api/
│   │   │   ├── messages.js
│   │   │   └── auth.js
│   │   └── index.js
│   ├── websocket/               # WebSocket 处理
│   │   ├── RealtimeMessageDispatcher.js
│   │   ├── ConnectionManager.js
│   │   └── MessageHandler.js
│   ├── database/                # 数据库相关
│   │   ├── connection.js
│   │   ├── migrations/
│   │   └── seeds/
│   ├── utils/                   # 工具函数
│   │   ├── logger.js
│   │   ├── validator.js
│   │   └── crypto.js
│   ├── config/                  # 配置管理
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── app.js
│   └── app.js                   # 应用入口
├── tests/                       # 测试文件
│   ├── unit/                    # 单元测试
│   ├── integration/             # 集成测试
│   └── fixtures/                # 测试数据
├── config/                      # 配置文件
│   ├── default.json
│   ├── development.json
│   ├── production.json
│   └── test.json
├── logs/                        # 日志文件 (gitignore)
├── data/                        # 数据文件 (gitignore)
├── package.json
├── .env.example
└── README.md
```

### 核心文件命名规范

#### 控制器 (Controllers)
- `MessageController.js` - 消息相关API控制器
- `AuthController.js` - 认证相关API控制器
- `HealthController.js` - 健康检查控制器

#### 服务 (Services)
- `MessageBrokerService.js` - 消息代理核心服务
- `AuthenticationService.js` - 认证服务
- `ConnectionPoolManager.js` - 连接池管理服务
- `MessageValidator.js` - 消息验证服务

#### WebSocket 模块
- `RealtimeMessageDispatcher.js` - 实时消息分发器
- `ConnectionManager.js` - WebSocket连接管理
- `HeartbeatManager.js` - 心跳管理

## 客户端结构 (client/)

### 目录组织
```
client/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── MessageSubscriberClient.js
│   │   ├── WebSocketConnectionManager.js
│   │   └── ConfigManager.js
│   ├── handlers/                # 消息处理器
│   │   ├── MessageHandlerRegistry.js
│   │   ├── ClipboardHandler.js
│   │   ├── BrowserHandler.js
│   │   └── NotificationHandler.js
│   ├── utils/                   # 工具函数
│   │   ├── logger.js
│   │   ├── systemInfo.js
│   │   └── retry.js
│   ├── services/                # 系统服务集成
│   │   ├── ClipboardManager.js
│   │   ├── BrowserLauncher.js
│   │   └── SystemNotifier.js
│   └── index.js                 # 客户端入口
├── config/                      # 配置文件
│   ├── default.json
│   └── config.example.json
├── tests/                       # 测试文件
│   ├── unit/
│   └── integration/
├── logs/                        # 日志文件 (gitignore)
├── scripts/                     # 脚本文件
│   ├── install.js               # 安装脚本
│   ├── service-install.js       # 系统服务安装
│   └── uninstall.js            # 卸载脚本
├── package.json
├── .env.example
└── README.md
```

### 核心文件命名规范

#### 核心模块 (Core)
- `MessageSubscriberClient.js` - 消息订阅客户端主类
- `WebSocketConnectionManager.js` - WebSocket连接管理
- `ConfigManager.js` - 配置管理器
- `ReconnectionManager.js` - 重连管理器

#### 消息处理器 (Handlers)
- `MessageHandlerRegistry.js` - 消息处理器注册表
- `TextMessageHandler.js` - 文本消息处理器
- `UrlMessageHandler.js` - URL消息处理器
- `CodeMessageHandler.js` - 代码消息处理器

#### 系统服务 (Services)
- `ClipboardManager.js` - 剪贴板管理器
- `BrowserLauncher.js` - 浏览器启动器
- `SystemNotifier.js` - 系统通知器

## iOS 快捷指令结构 (ios-shortcuts/)

### 目录组织
```
ios-shortcuts/
├── shortcuts/                   # 快捷指令文件
│   ├── MSyncTextSync.shortcut   # 文本同步快捷指令
│   ├── MSyncUrlSync.shortcut    # URL同步快捷指令
│   └── MSyncCodeSync.shortcut   # 代码同步快捷指令
├── templates/                   # 配置模板
│   ├── config-template.json     # 配置模板
│   └── setup-guide.md          # 设置指南
├── assets/                      # 资源文件
│   ├── icons/                   # 图标文件
│   └── screenshots/             # 截图文件
└── README.md                    # 使用说明
```

## 部署结构 (deployment/)

### 目录组织
```
deployment/
├── docker/                      # Docker 相关
│   ├── Dockerfile.server        # 服务端 Dockerfile
│   ├── Dockerfile.client        # 客户端 Dockerfile
│   └── docker-compose.yml       # Docker Compose 配置
├── scripts/                     # 部署脚本
│   ├── deploy.sh               # 部署脚本
│   ├── backup.sh               # 备份脚本
│   └── rollback.sh             # 回滚脚本
└── nginx/                       # Nginx 配置
    ├── nginx.conf
    └── ssl/
```

## 开发规范

### 文件命名约定

#### JavaScript 文件
- **类文件**: PascalCase (如 `MessageBrokerService.js`)
- **工具函数**: camelCase (如 `logger.js`, `validator.js`)
- **配置文件**: kebab-case (如 `database-config.js`)
- **测试文件**: `*.test.js` 或 `*.spec.js`

#### 配置文件
- **环境配置**: `{environment}.json` (如 `development.json`)
- **Docker配置**: `Dockerfile.{service}` (如 `Dockerfile.server`)
- **脚本文件**: kebab-case (如 `deploy-script.sh`)

### 目录命名约定
- **源代码目录**: `src/`
- **测试目录**: `tests/` 或 `__tests__/`
- **配置目录**: `config/`
- **文档目录**: `docs/`
- **脚本目录**: `scripts/`

### 代码组织原则

#### 分层架构
1. **Controller Layer**: 处理HTTP请求和响应
2. **Service Layer**: 业务逻辑处理
3. **Model Layer**: 数据模型和数据库操作
4. **Utility Layer**: 通用工具函数

#### 模块化原则
- 每个模块职责单一
- 模块间低耦合，高内聚
- 使用依赖注入模式
- 统一的错误处理机制

### 测试结构

#### 测试文件组织
```
tests/
├── unit/                        # 单元测试
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/                 # 集成测试
│   ├── api/
│   └── websocket/
├── e2e/                        # 端到端测试
├── fixtures/                   # 测试数据
└── helpers/                    # 测试辅助函数
```

#### 测试命名规范
- 单元测试: `{ModuleName}.test.js`
- 集成测试: `{FeatureName}.integration.test.js`
- 端到端测试: `{Scenario}.e2e.test.js`

### 日志和监控

#### 日志文件结构
```
logs/
├── app.log                     # 应用日志
├── error.log                   # 错误日志
├── access.log                  # 访问日志
└── websocket.log               # WebSocket 日志
```

#### 日志命名规范
- 按日期轮转: `app-2024-01-01.log`
- 按大小轮转: `app.1.log`, `app.2.log`
- 错误日志单独存储: `error-2024-01-01.log`

## Git 工作流

### 分支命名规范
- **主分支**: `main`
- **开发分支**: `develop`
- **功能分支**: `feature/{feature-name}`
- **修复分支**: `fix/{bug-description}`
- **发布分支**: `release/{version}`

### 提交信息规范
```
type(scope): description

feat(server): add message validation middleware
fix(client): resolve websocket reconnection issue
docs(api): update authentication documentation
test(integration): add websocket connection tests
```

这个项目结构确保了 M-SYNC 系统的代码组织清晰、易于维护和扩展。
