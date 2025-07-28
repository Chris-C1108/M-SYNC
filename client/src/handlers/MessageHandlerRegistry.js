/**
 * 消息处理器注册表
 * 管理不同类型消息的处理器
 */

const logger = require('../utils/logger').createLogger('MessageHandlerRegistry');

class MessageHandlerRegistry {
  constructor(config) {
    this.config = config;
    this.handlers = new Map();
    this.stats = {
      totalProcessed: 0,
      processingErrors: 0,
      handlerStats: {}
    };
  }

  async initialize() {
    try {
      logger.info('Initializing message handler registry');

      // 根据配置加载处理器
      const handlerConfig = this.config.get('messageHandlers');
      
      for (const [messageType, handlerType] of Object.entries(handlerConfig)) {
        await this.registerHandler(messageType, handlerType);
      }

      logger.info('Message handler registry initialized', {
        registeredHandlers: Array.from(this.handlers.keys())
      });

    } catch (error) {
      logger.error('Failed to initialize message handler registry:', error);
      throw error;
    }
  }

  async registerHandler(messageType, handlerType) {
    try {
      let HandlerClass;

      // 根据处理器类型加载相应的处理器类
      switch (handlerType) {
        case 'clipboard':
          if (messageType === 'TEXT' || messageType === 'CODE') {
            HandlerClass = require('./TextMessageHandler');
          }
          break;
        case 'browser':
          if (messageType === 'URL') {
            HandlerClass = require('./UrlMessageHandler');
          }
          break;
        default:
          throw new Error(`Unknown handler type: ${handlerType}`);
      }

      if (!HandlerClass) {
        throw new Error(`No handler class found for ${messageType}:${handlerType}`);
      }

      // 创建处理器实例
      const handler = new HandlerClass(this.config);
      await handler.initialize();

      // 注册处理器
      this.handlers.set(messageType, handler);
      this.stats.handlerStats[messageType] = {
        processed: 0,
        errors: 0,
        lastProcessed: null
      };

      logger.info('Handler registered', {
        messageType,
        handlerType,
        handlerClass: HandlerClass.name
      });

    } catch (error) {
      logger.error('Failed to register handler:', {
        messageType,
        handlerType,
        error: error.message
      });
      throw error;
    }
  }

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }

  async processMessage(message) {
    const handler = this.getHandler(message.messageType);
    
    if (!handler) {
      logger.warn('No handler found for message type:', message.messageType);
      return false;
    }

    try {
      await handler.process(message);
      
      // 更新统计信息
      this.stats.totalProcessed++;
      this.stats.handlerStats[message.messageType].processed++;
      this.stats.handlerStats[message.messageType].lastProcessed = new Date().toISOString();

      return true;

    } catch (error) {
      logger.error('Handler processing failed:', {
        messageType: message.messageType,
        messageId: message.messageId,
        error: error.message
      });

      // 更新错误统计
      this.stats.processingErrors++;
      this.stats.handlerStats[message.messageType].errors++;

      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      registeredHandlers: Array.from(this.handlers.keys())
    };
  }

  async cleanup() {
    try {
      logger.info('Cleaning up message handlers');

      for (const [messageType, handler] of this.handlers) {
        try {
          if (typeof handler.cleanup === 'function') {
            await handler.cleanup();
          }
        } catch (error) {
          logger.error('Error cleaning up handler:', {
            messageType,
            error: error.message
          });
        }
      }

      this.handlers.clear();
      logger.info('Message handlers cleaned up');

    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = MessageHandlerRegistry;
