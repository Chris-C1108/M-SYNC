# iOS 快捷指令示例集合

**M-SYNC 快捷指令实用示例**

## 📱 快捷指令示例

### 1. 验证码自动发送

#### 功能描述
自动识别短信中的验证码并发送到桌面端

#### 配置步骤
```
1. 触发器: 收到消息 (包含"验证码"关键词)
2. 获取最新消息内容
3. 使用正则表达式提取数字验证码
4. 发送到M-SYNC服务器
5. 显示成功通知
```

#### 快捷指令代码结构
```
获取最新消息
↓
从文本中获取数字 (正则: \d{4,8})
↓
文本操作: 构建JSON
{
  "token": "YOUR_TOKEN",
  "messageType": "TEXT", 
  "content": "验证码: [提取的数字]"
}
↓
获取URL内容 (POST到API)
↓
显示通知: "验证码已发送到桌面"
```

### 2. 网页链接分享

#### 功能描述
从Safari或其他应用分享链接到桌面端浏览器

#### 配置步骤
```
1. 触发器: 共享表单 (接受URL)
2. 获取共享的URL
3. 验证URL格式
4. 发送到M-SYNC服务器
5. 显示成功通知
```

#### 快捷指令代码结构
```
获取共享输入 (URL类型)
↓
文本操作: 构建JSON
{
  "token": "YOUR_TOKEN",
  "messageType": "URL",
  "content": "[共享的URL]"
}
↓
获取URL内容 (POST到API)
↓
显示通知: "链接已发送到桌面"
```

### 3. 剪贴板同步

#### 功能描述
将iPhone剪贴板内容同步到桌面端

#### 配置步骤
```
1. 触发器: Siri语音或小组件
2. 获取剪贴板内容
3. 判断内容类型 (文本/URL)
4. 发送到M-SYNC服务器
5. 显示成功通知
```

#### 快捷指令代码结构
```
获取剪贴板
↓
如果 (包含"http")
  ├─ 是: messageType = "URL"
  └─ 否: messageType = "TEXT"
↓
文本操作: 构建JSON
{
  "token": "YOUR_TOKEN",
  "messageType": "[判断结果]",
  "content": "[剪贴板内容]"
}
↓
获取URL内容 (POST到API)
↓
显示通知: "剪贴板已同步到桌面"
```

### 4. 智能文本发送

#### 功能描述
手动输入文本并智能判断类型发送

#### 配置步骤
```
1. 触发器: 手动运行或Siri
2. 要求用户输入文本
3. 智能判断内容类型
4. 发送到M-SYNC服务器
5. 显示详细结果
```

#### 快捷指令代码结构
```
要求输入 (文本类型)
↓
如果 (匹配URL模式)
  ├─ 是: messageType = "URL"
  ├─ 否则如果 (包含代码特征)
  │   └─ 是: messageType = "CODE"
  └─ 否: messageType = "TEXT"
↓
文本操作: 构建JSON
↓
获取URL内容 (POST到API)
↓
显示通知: "内容已发送 ([类型])"
```

### 5. 二维码内容发送

#### 功能描述
扫描二维码并将内容发送到桌面端

#### 配置步骤
```
1. 触发器: 手动运行
2. 扫描二维码
3. 获取二维码内容
4. 判断内容类型
5. 发送到M-SYNC服务器
```

#### 快捷指令代码结构
```
扫描二维码
↓
获取二维码文本
↓
如果 (是URL)
  ├─ 是: messageType = "URL"
  └─ 否: messageType = "TEXT"
↓
文本操作: 构建JSON
↓
获取URL内容 (POST到API)
↓
显示通知: "二维码内容已发送"
```

## 🔧 高级自动化示例

### 1. 智能验证码自动化

#### 触发条件
- 收到包含"验证码"、"动态密码"、"校验码"的短信
- 发送方为银行、支付平台、网站服务

#### 自动化流程
```yaml
触发器:
  - 类型: 消息
  - 条件: 包含关键词
  - 发送者: 特定联系人/号码

操作:
  1. 获取消息内容
  2. 正则匹配: (\d{4,8})
  3. 如果匹配成功:
     - 构建请求数据
     - 发送到M-SYNC
     - 显示通知
  4. 如果匹配失败:
     - 记录日志
     - 不执行操作
```

### 2. 工作时间链接同步

#### 触发条件
- 工作时间 (9:00-18:00)
- 在Safari中浏览网页
- 手动触发分享

#### 自动化流程
```yaml
触发器:
  - 类型: 共享表单
  - 时间限制: 工作时间
  - 应用限制: Safari, Chrome

操作:
  1. 获取当前时间
  2. 判断是否为工作时间
  3. 如果是工作时间:
     - 发送链接到桌面
     - 添加时间戳标记
  4. 如果非工作时间:
     - 询问是否仍要发送
     - 根据用户选择执行
```

### 3. 位置相关内容发送

#### 触发条件
- 在特定位置 (办公室、家)
- 复制内容到剪贴板

#### 自动化流程
```yaml
触发器:
  - 类型: 剪贴板变化
  - 位置: 办公室/家庭

操作:
  1. 获取当前位置
  2. 判断是否在指定位置
  3. 获取剪贴板内容
  4. 如果内容有意义:
     - 自动发送到桌面
     - 静默通知
  5. 如果内容无意义:
     - 忽略操作
```

## 📋 快捷指令模板库

### 模板 1: 基础HTTP请求模板

```json
{
  "name": "M-SYNC基础发送",
  "description": "发送文本到桌面端",
  "actions": [
    {
      "type": "ask_for_input",
      "input_type": "text",
      "prompt": "请输入要发送的内容"
    },
    {
      "type": "text",
      "value": "http://your-server.com:3000/api/v1/messages/publish"
    },
    {
      "type": "text", 
      "value": "YOUR_ACCESS_TOKEN"
    },
    {
      "type": "text",
      "value": "{\"token\":\"[token]\",\"messageType\":\"TEXT\",\"content\":\"[input]\"}"
    },
    {
      "type": "get_url_contents",
      "method": "POST",
      "headers": {"Content-Type": "application/json"},
      "body": "[json_data]"
    },
    {
      "type": "show_notification",
      "title": "M-SYNC",
      "body": "消息发送成功"
    }
  ]
}
```

### 模板 2: 智能类型判断模板

```json
{
  "name": "M-SYNC智能发送",
  "description": "智能判断内容类型并发送",
  "actions": [
    {
      "type": "ask_for_input",
      "input_type": "text",
      "prompt": "请输入内容"
    },
    {
      "type": "if",
      "condition": "contains_url",
      "then": [
        {"type": "set_variable", "name": "messageType", "value": "URL"}
      ],
      "else": [
        {
          "type": "if",
          "condition": "contains_code_pattern",
          "then": [
            {"type": "set_variable", "name": "messageType", "value": "CODE"}
          ],
          "else": [
            {"type": "set_variable", "name": "messageType", "value": "TEXT"}
          ]
        }
      ]
    },
    {
      "type": "text",
      "value": "{\"token\":\"YOUR_TOKEN\",\"messageType\":\"[messageType]\",\"content\":\"[input]\"}"
    },
    {
      "type": "get_url_contents",
      "url": "http://your-server.com:3000/api/v1/messages/publish",
      "method": "POST",
      "headers": {"Content-Type": "application/json"},
      "body": "[json_data]"
    }
  ]
}
```

### 模板 3: 错误处理模板

```json
{
  "name": "M-SYNC安全发送",
  "description": "带错误处理的发送模板",
  "actions": [
    {
      "type": "try",
      "actions": [
        {
          "type": "get_url_contents",
          "url": "http://your-server.com:3000/api/v1/messages/publish",
          "method": "POST",
          "headers": {"Content-Type": "application/json"},
          "body": "[json_data]"
        },
        {
          "type": "show_notification",
          "title": "成功",
          "body": "消息已发送到桌面"
        }
      ],
      "catch": [
        {
          "type": "show_notification",
          "title": "发送失败",
          "body": "请检查网络连接和服务器状态"
        },
        {
          "type": "save_to_notes",
          "title": "M-SYNC发送失败",
          "content": "内容: [input]\n时间: [current_time]\n错误: [error]"
        }
      ]
    }
  ]
}
```

## 🎯 使用技巧

### 1. 性能优化
- 使用变量缓存常用数据
- 避免重复的网络请求
- 合理设置超时时间

### 2. 用户体验
- 提供清晰的操作反馈
- 使用有意义的通知消息
- 支持撤销操作

### 3. 安全考虑
- 不在快捷指令中硬编码敏感信息
- 使用系统钥匙串存储令牌
- 定期更新访问凭据

### 4. 调试方法
- 添加中间步骤的通知显示
- 使用"显示结果"操作查看数据
- 保存调试信息到备忘录

---

**这些示例可以根据您的具体需求进行调整和组合使用！**
