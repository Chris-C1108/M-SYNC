# M-SYNC 桌面消息订阅端

M-SYNC 系统的桌面客户端，负责接收来自移动端的实时消息并执行相应的系统操作。

## 功能特性

- **实时消息接收**: 通过 WebSocket 长连接接收消息
- **智能消息处理**: 根据消息类型自动执行相应操作
  - TEXT/CODE: 自动复制到剪贴板
  - URL: 在默认浏览器中打开
- **跨平台支持**: Windows、macOS、Linux 全平台兼容
- **后台运行**: 静默运行，无界面干扰
- **自动重连**: 网络断开时自动重连
- **系统集成**: 系统通知、开机自启等功能

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装

#### 方式一：从源码安装

```bash
# 克隆项目
git clone https://github.com/m-sync/desktop-subscriber.git
cd desktop-subscriber

# 安装依赖
npm install

# 配置环境
cp .env.example .env
nano .env
```

#### 方式二：下载可执行文件

从 [Releases](https://github.com/m-sync/desktop-subscriber/releases) 页面下载对应平台的可执行文件。

### 配置

编辑配置文件 `config/default.json` 或设置环境变量：

```bash
# 必需配置
export MSYNC_SUBSCRIBER_WS_ENDPOINT="wss://your-server.com/ws/subscribe"
export MSYNC_SUBSCRIBER_AUTH_TOKEN="your-jwt-token"
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 或直接运行可执行文件
./msync-client
```

## 项目结构

```
client/
├── src/
│   ├── core/              # 核心模块
│   │   ├── MessageSubscriberClient.js
│   │   ├── WebSocketConnectionManager.js
│   │   └── ConfigManager.js
│   ├── handlers/          # 消息处理器
│   │   ├── MessageHandlerRegistry.js
│   │   ├── TextMessageHandler.js
│   │   └── UrlMessageHandler.js
│   ├── services/          # 系统服务
│   │   ├── ClipboardManager.js
│   │   ├── BrowserLauncher.js
│   │   └── SystemNotifier.js
│   ├── utils/             # 工具函数
│   └── index.js           # 应用入口
├── config/                # 配置文件
├── scripts/               # 脚本文件
└── logs/                  # 日志文件
```

## 使用指南

### 基本使用

1. **获取认证令牌**
   - 在服务端注册账户并登录
   - 获取 JWT Token 用于客户端认证

2. **配置客户端**
   - 设置服务器地址和认证令牌
   - 根据需要调整消息处理选项

3. **启动客户端**
   - 运行客户端程序
   - 确认连接状态正常

4. **测试消息同步**
   - 在 iOS 设备上使用快捷指令发送消息
   - 验证桌面端是否正确处理消息

### 消息类型处理

#### 文本消息 (TEXT)
- 自动复制到系统剪贴板
- 显示系统通知确认

#### 代码消息 (CODE)
- 自动复制到系统剪贴板
- 保持原始格式

#### 链接消息 (URL)
- 在默认浏览器中打开
- 支持 HTTP/HTTPS 链接

### 系统服务安装

#### Windows

```bash
# 安装为 Windows 服务
npm run install-service

# 卸载服务
npm run uninstall-service
```

#### macOS

```bash
# 安装为 LaunchAgent
sudo npm run install-service

# 卸载
sudo npm run uninstall-service
```

#### Linux

```bash
# 安装为 systemd 服务
sudo npm run install-service

# 启动服务
sudo systemctl start msync-desktop-subscriber

# 设置开机自启
sudo systemctl enable msync-desktop-subscriber
```

## 配置选项

### 连接配置

```json
{
  "brokerService": {
    "wsEndpoint": "wss://api.m-sync.com/ws/subscribe",
    "authToken": "your-jwt-token",
    "reconnectInterval": 5000,
    "heartbeatInterval": 30000,
    "maxReconnectAttempts": 10
  }
}
```

### 消息处理配置

```json
{
  "messageHandlers": {
    "TEXT": "clipboard",
    "CODE": "clipboard",
    "URL": "browser"
  }
}
```

### 系统集成配置

```json
{
  "systemIntegration": {
    "clipboard": {
      "enabled": true,
      "timeout": 1000
    },
    "browser": {
      "enabled": true,
      "timeout": 3000
    },
    "notifications": {
      "enabled": true,
      "timeout": 5000,
      "sound": true
    }
  }
}
```

## 故障排除

### 常见问题

1. **连接失败**
   ```bash
   # 检查网络连接
   ping your-server.com
   
   # 验证 WebSocket 端点
   curl -I https://your-server.com/health
   ```

2. **认证失败**
   - 检查 JWT Token 是否有效
   - 确认服务器地址正确

3. **剪贴板操作失败**
   ```bash
   # Linux: 安装必要工具
   sudo apt-get install xclip  # Ubuntu/Debian
   sudo yum install xclip      # CentOS/RHEL
   ```

4. **系统通知不显示**
   - 检查系统通知权限设置
   - 确认通知服务正在运行

### 调试模式

```bash
# 启用详细日志
export MSYNC_SUBSCRIBER_LOG_LEVEL=debug
npm start

# 查看日志文件
tail -f logs/subscriber.log
```

### 系统诊断

```bash
# 运行系统诊断
node -e "
const { generateDiagnosticReport } = require('./src/utils/systemInfo');
generateDiagnosticReport().then(console.log);
"
```

## 开发指南

### 开发环境设置

```bash
# 安装开发依赖
npm install

# 启动开发模式
npm run dev

# 运行测试
npm test
```

### 构建可执行文件

```bash
# 构建所有平台
npm run build

# 构建特定平台
npx pkg . --targets node18-win-x64 --out-path dist/
```

### 添加新的消息处理器

1. 在 `src/handlers/` 目录创建新的处理器类
2. 实现 `initialize()` 和 `process()` 方法
3. 在 `MessageHandlerRegistry.js` 中注册处理器

## 性能优化

### 内存使用

- 客户端空闲时内存占用 < 50MB
- 支持长时间运行不重启

### CPU 占用

- 空闲时 CPU 占用 < 1%
- 消息处理延迟 < 50ms

### 网络优化

- 自动重连机制
- 心跳检测防止连接假死
- 智能退避重连策略

## 安全考虑

- 所有网络通信使用 HTTPS/WSS 加密
- JWT Token 安全存储
- 消息内容验证和过滤
- 系统权限最小化原则

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 支持

如有问题或建议，请：

- 创建 [Issue](https://github.com/m-sync/desktop-subscriber/issues)
- 发送邮件至 support@m-sync.com
- 查看 [文档](https://docs.m-sync.com)
