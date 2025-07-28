/**
 * 系统托盘管理器
 * 管理系统托盘图标和右键菜单
 */

const SysTray = require('systray2').default;
const path = require('path');
const logger = require('../utils/logger');

class SystemTrayManager {
  constructor(messageClient) {
    this.messageClient = messageClient;
    this.systray = null;
    this.isInitialized = false;
  }

  /**
   * 初始化系统托盘
   */
  async initialize() {
    try {
      // 创建系统托盘配置
      const trayConfig = {
        menu: {
          // 图标 (使用内置图标或自定义图标路径)
          icon: this.getIconPath(),
          title: "M-SYNC",
          tooltip: "M-SYNC 消息同步客户端",
          items: [
            {
              title: "发送消息",
              tooltip: "发送新消息",
              checked: false,
              enabled: true,
              click: () => this.handleSendMessage()
            },
            {
              title: "获取最新消息", 
              tooltip: "获取最新消息",
              checked: false,
              enabled: true,
              click: () => this.handleGetLatestMessages()
            },
            {
              title: "Token管理",
              tooltip: "管理访问令牌",
              checked: false,
              enabled: true,
              click: () => this.handleTokenManagement()
            },
            SysTray.separator,
            {
              title: "连接状态",
              tooltip: "显示连接状态",
              checked: false,
              enabled: false,
              click: () => {}
            },
            SysTray.separator,
            {
              title: "退出",
              tooltip: "退出应用程序",
              checked: false,
              enabled: true,
              click: () => this.handleExit()
            }
          ]
        },
        debug: false,
        copyDir: true
      };

      // 创建系统托盘
      this.systray = new SysTray(trayConfig);

      // 监听托盘事件
      this.systray.onClick(action => {
        if (action.seq_id) {
          logger.info('Tray menu item clicked', { action: action.item.title });
        }
      });

      // 监听客户端连接状态变化
      this.setupConnectionStatusListener();

      this.isInitialized = true;
      logger.info('System tray initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize system tray:', error);
      throw error;
    }
  }

  /**
   * 获取图标路径
   */
  getIconPath() {
    // 根据平台返回不同的图标
    const platform = process.platform;
    
    if (platform === 'win32') {
      return path.join(__dirname, '../../assets/icons/icon.ico');
    } else if (platform === 'darwin') {
      return path.join(__dirname, '../../assets/icons/icon.png');
    } else {
      return path.join(__dirname, '../../assets/icons/icon.png');
    }
  }

  /**
   * 设置连接状态监听器
   */
  setupConnectionStatusListener() {
    if (!this.messageClient) return;

    this.messageClient.on('connected', () => {
      this.updateConnectionStatus('已连接', true);
    });

    this.messageClient.on('disconnected', () => {
      this.updateConnectionStatus('已断开', false);
    });

    this.messageClient.on('reconnecting', (attempt) => {
      this.updateConnectionStatus(`重连中 (${attempt})`, false);
    });
  }

  /**
   * 更新连接状态菜单项
   */
  updateConnectionStatus(status, isConnected) {
    if (!this.systray || !this.isInitialized) return;

    try {
      // 更新连接状态菜单项
      const statusItem = this.systray.menu.items.find(item => item.title === '连接状态');
      if (statusItem) {
        statusItem.title = `连接状态: ${status}`;
        statusItem.checked = isConnected;
      }

      // 更新托盘提示
      this.systray.sendAction({
        type: 'update-item',
        item: {
          tooltip: `M-SYNC - ${status}`
        }
      });

    } catch (error) {
      logger.error('Failed to update connection status:', error);
    }
  }

  /**
   * 处理发送消息
   */
  async handleSendMessage() {
    try {
      logger.info('Send message requested from tray');
      
      // 这里可以打开一个简单的输入对话框或使用剪贴板内容
      const clipboardy = require('clipboardy');
      const clipboardContent = await clipboardy.read();
      
      if (clipboardContent && clipboardContent.trim()) {
        const confirmed = await this.showConfirmDialog(
          '发送消息',
          `是否发送剪贴板内容作为消息？\n\n内容预览: ${clipboardContent.substring(0, 100)}${clipboardContent.length > 100 ? '...' : ''}`
        );
        
        if (confirmed && this.messageClient) {
          await this.messageClient.sendMessage({
            messageType: 'TEXT',
            content: clipboardContent
          });
          
          this.showNotification('消息发送成功', '剪贴板内容已发送');
        }
      } else {
        this.showNotification('发送消息', '剪贴板为空，请先复制要发送的内容');
      }
      
    } catch (error) {
      logger.error('Failed to send message:', error);
      this.showNotification('发送失败', error.message);
    }
  }

  /**
   * 处理获取最新消息
   */
  async handleGetLatestMessages() {
    try {
      logger.info('Get latest messages requested from tray');
      
      if (!this.messageClient) {
        this.showNotification('获取消息', '客户端未连接');
        return;
      }

      const messages = await this.messageClient.getLatestMessages(5);
      
      if (messages && messages.length > 0) {
        const messageList = messages.map((msg, index) => 
          `${index + 1}. [${msg.messageType}] ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`
        ).join('\n');
        
        this.showNotification('最新消息', `获取到 ${messages.length} 条消息:\n${messageList}`);
      } else {
        this.showNotification('最新消息', '暂无新消息');
      }
      
    } catch (error) {
      logger.error('Failed to get latest messages:', error);
      this.showNotification('获取失败', error.message);
    }
  }

  /**
   * 处理Token管理
   */
  async handleTokenManagement() {
    try {
      logger.info('Token management requested from tray');
      
      if (!this.messageClient) {
        this.showNotification('Token管理', '客户端未连接');
        return;
      }

      const tokenInfo = await this.messageClient.getCurrentTokenInfo();
      
      if (tokenInfo) {
        const info = `Token名称: ${tokenInfo.tokenName}\n设备类型: ${tokenInfo.deviceType}\n创建时间: ${new Date(tokenInfo.createdAt).toLocaleString()}\n最后使用: ${tokenInfo.lastUsedAt ? new Date(tokenInfo.lastUsedAt).toLocaleString() : '未使用'}`;
        this.showNotification('Token信息', info);
      } else {
        this.showNotification('Token管理', '无法获取Token信息');
      }
      
    } catch (error) {
      logger.error('Failed to manage token:', error);
      this.showNotification('Token管理失败', error.message);
    }
  }

  /**
   * 处理退出
   */
  async handleExit() {
    try {
      logger.info('Exit requested from tray');
      
      const confirmed = await this.showConfirmDialog(
        '退出确认',
        '确定要退出 M-SYNC 客户端吗？'
      );
      
      if (confirmed) {
        await this.cleanup();
        process.exit(0);
      }
      
    } catch (error) {
      logger.error('Failed to exit:', error);
      process.exit(1);
    }
  }

  /**
   * 显示通知
   */
  showNotification(title, message) {
    try {
      const notifier = require('node-notifier');
      notifier.notify({
        title: title,
        message: message,
        icon: this.getIconPath(),
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to show notification:', error);
      console.log(`[通知] ${title}: ${message}`);
    }
  }

  /**
   * 显示确认对话框 (简化版本，实际可能需要更复杂的实现)
   */
  async showConfirmDialog(title, message) {
    // 简化实现：总是返回true，实际应用中可能需要更复杂的用户交互
    console.log(`[确认] ${title}: ${message}`);
    return true;
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      if (this.systray) {
        this.systray.kill();
        this.systray = null;
      }
      this.isInitialized = false;
      logger.info('System tray cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup system tray:', error);
    }
  }
}

module.exports = SystemTrayManager;
