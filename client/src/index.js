#!/usr/bin/env node

/**
 * M-SYNC Desktop Message Subscriber
 * 桌面消息订阅客户端主入口
 */

require('dotenv').config();
const path = require('path');
const config = require('config');

const MessageSubscriberClient = require('./core/MessageSubscriberClient');
const ConfigManager = require('./core/ConfigManager');
const SystemTrayManager = require('./core/SystemTrayManager');
const logger = require('./utils/logger');
const { getSystemInfo } = require('./utils/systemInfo');

class DesktopSubscriberApp {
  constructor() {
    this.client = null;
    this.configManager = new ConfigManager();
    this.systemTray = null;
    this.isShuttingDown = false;
    this.isTrayMode = process.argv.includes('--tray') || process.env.MSYNC_TRAY_MODE === 'true';
  }

  async initialize() {
    try {
      // 显示启动信息
      this.showStartupInfo();

      // 验证配置
      await this.validateConfiguration();

      // 初始化消息订阅客户端
      this.client = new MessageSubscriberClient(config);

      // 设置事件监听
      this.setupEventHandlers();

      // 如果是托盘模式，初始化系统托盘
      if (this.isTrayMode) {
        this.systemTray = new SystemTrayManager(this.client);
        await this.systemTray.initialize();
        logger.info('System tray mode enabled');
      }

      logger.info('Desktop subscriber initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize desktop subscriber:', error);
      throw error;
    }
  }

  showStartupInfo() {
    const appName = config.get('application.name');
    const appVersion = config.get('application.version');
    const wsEndpoint = config.get('brokerService.wsEndpoint');

    if (!this.isTrayMode) {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     ${appName}                      ║
║                        Version ${appVersion}                         ║
╠══════════════════════════════════════════════════════════════╣
║ WebSocket Endpoint: ${wsEndpoint.padEnd(30)} ║
║ Log Level: ${config.get('logging.level').toUpperCase().padEnd(43)} ║
║ Auto Start: ${config.get('application.autoStart') ? 'Enabled' : 'Disabled'.padEnd(42)} ║
║ Mode: ${(this.isTrayMode ? 'System Tray' : 'Console').padEnd(48)} ║
╚══════════════════════════════════════════════════════════════╝
      `);
    }

    logger.info('Starting M-SYNC Desktop Subscriber', {
      version: appVersion,
      endpoint: wsEndpoint,
      nodeVersion: process.version,
      platform: process.platform,
      trayMode: this.isTrayMode
    });
  }

  async validateConfiguration() {
    const authToken = config.get('brokerService.authToken');
    const wsEndpoint = config.get('brokerService.wsEndpoint');

    if (!authToken) {
      throw new Error('Authentication token is required. Please configure MSYNC_SUBSCRIBER_AUTH_TOKEN or update config file.');
    }

    if (!wsEndpoint) {
      throw new Error('WebSocket endpoint is required. Please configure MSYNC_SUBSCRIBER_WS_ENDPOINT or update config file.');
    }

    // 验证系统兼容性
    const systemInfo = await getSystemInfo();
    logger.info('System information', systemInfo);

    // 检查必要的系统功能
    if (config.get('systemIntegration.clipboard.enabled')) {
      try {
        const clipboardy = require('clipboardy');
        await clipboardy.read();
        logger.info('Clipboard access verified');
      } catch (error) {
        logger.warn('Clipboard access failed, disabling clipboard integration', error);
        config.systemIntegration.clipboard.enabled = false;
      }
    }

    if (config.get('systemIntegration.browser.enabled')) {
      try {
        const open = require('open');
        logger.info('Browser launcher verified');
      } catch (error) {
        logger.warn('Browser launcher failed, disabling browser integration', error);
        config.systemIntegration.browser.enabled = false;
      }
    }
  }

  setupEventHandlers() {
    // 客户端事件监听
    this.client.on('connected', () => {
      logger.info('Connected to message broker service');
      if (!this.isTrayMode) {
        console.log('✅ Connected to M-SYNC service');
      }
    });

    this.client.on('disconnected', () => {
      logger.warn('Disconnected from message broker service');
      if (!this.isTrayMode) {
        console.log('❌ Disconnected from M-SYNC service');
      }
    });

    this.client.on('reconnecting', (attempt) => {
      logger.info(`Reconnecting to message broker service (attempt ${attempt})`);
      if (!this.isTrayMode) {
        console.log(`🔄 Reconnecting... (attempt ${attempt})`);
      }
    });

    this.client.on('message', (message) => {
      logger.info('Message received', {
        messageId: message.messageId,
        messageType: message.messageType,
        contentLength: message.content.length
      });
      if (!this.isTrayMode) {
        console.log(`📨 Message received: ${message.messageType}`);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Client error occurred', error);
      if (!this.isTrayMode) {
        console.error('❌ Error:', error.message);
      }
    });

    // 进程信号处理
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGHUP', () => this.gracefulShutdown('SIGHUP'));

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });
  }

  async start() {
    try {
      await this.client.start();
      logger.info('Desktop subscriber started successfully');

      if (this.isTrayMode) {
        console.log('🚀 M-SYNC Desktop Subscriber is running in system tray...');
        console.log('Right-click the tray icon to access features');
      } else {
        console.log('🚀 M-SYNC Desktop Subscriber is running...');
        console.log('Press Ctrl+C to stop');
      }
    } catch (error) {
      logger.error('Failed to start desktop subscriber:', error);
      throw error;
    }
  }

  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    if (!this.isTrayMode) {
      console.log(`\n🛑 Shutting down M-SYNC Desktop Subscriber...`);
    }

    try {
      if (this.systemTray) {
        await this.systemTray.cleanup();
      }

      if (this.client) {
        await this.client.stop();
      }

      logger.info('Desktop subscriber stopped successfully');
      if (!this.isTrayMode) {
        console.log('✅ M-SYNC Desktop Subscriber stopped');
      }
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      if (!this.isTrayMode) {
        console.error('❌ Error during shutdown:', error.message);
      }
      process.exit(1);
    }
  }
}

// 主函数
async function main() {
  const app = new DesktopSubscriberApp();

  try {
    await app.initialize();
    await app.start();
  } catch (error) {
    logger.error('Failed to start application:', error);
    console.error('❌ Failed to start M-SYNC Desktop Subscriber:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动应用
if (require.main === module) {
  main();
}

module.exports = DesktopSubscriberApp;
