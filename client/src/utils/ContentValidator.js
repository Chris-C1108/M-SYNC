/**
 * 内容验证工具
 * 统一各种内容验证逻辑
 */

const logger = require('./logger').createLogger('ContentValidator');

class ContentValidator {
  constructor(config) {
    this.config = config;
    this.validationRules = {
      text: {
        minLength: 0,
        maxLength: this.getConfigValue('security.maxMessageSize', 10000),
        allowEmpty: false,
        trimWhitespace: true
      },
      url: {
        protocols: ['http:', 'https:', 'ftp:', 'file:'],
        maxLength: 2048,
        allowLocalhost: true,
        allowPrivateIPs: false
      },
      code: {
        minLength: 0,
        maxLength: this.getConfigValue('security.maxCodeSize', 50000),
        allowEmpty: false,
        detectLanguage: false
      }
    };
  }

  /**
   * 安全地获取配置值
   */
  getConfigValue(path, defaultValue) {
    try {
      return this.config?.get(path) || defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * 验证文本内容
   */
  validateText(content, options = {}) {
    const rules = { ...this.validationRules.text, ...options };
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      processedContent: content
    };

    try {
      // 处理空值
      if (content === null || content === undefined) {
        result.isValid = false;
        result.errors.push('Content is null or undefined');
        return result;
      }

      // 转换为字符串
      if (typeof content !== 'string') {
        content = String(content);
        result.warnings.push('Content was converted to string');
      }

      // 处理空白字符
      if (rules.trimWhitespace) {
        result.processedContent = content.trim();
      }

      // 检查空内容
      if (!rules.allowEmpty && result.processedContent.length === 0) {
        result.isValid = false;
        result.errors.push('Content cannot be empty');
        return result;
      }

      // 检查长度
      if (result.processedContent.length < rules.minLength) {
        result.isValid = false;
        result.errors.push(`Content too short (min: ${rules.minLength})`);
      }

      if (result.processedContent.length > rules.maxLength) {
        result.isValid = false;
        result.errors.push(`Content too long (max: ${rules.maxLength})`);
      }

      // 检查危险字符
      if (this.containsDangerousChars(result.processedContent)) {
        result.warnings.push('Content contains potentially dangerous characters');
      }

    } catch (error) {
      logger.error('Error validating text content:', error);
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 验证URL格式
   */
  validateUrl(urlString, options = {}) {
    const rules = { ...this.validationRules.url, ...options };
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      parsedUrl: null,
      normalizedUrl: urlString
    };

    try {
      // 基本检查
      if (!urlString || typeof urlString !== 'string') {
        result.isValid = false;
        result.errors.push('URL must be a non-empty string');
        return result;
      }

      // 长度检查
      if (urlString.length > rules.maxLength) {
        result.isValid = false;
        result.errors.push(`URL too long (max: ${rules.maxLength})`);
        return result;
      }

      // URL解析
      try {
        result.parsedUrl = new URL(urlString);
        result.normalizedUrl = result.parsedUrl.href;
      } catch (urlError) {
        result.isValid = false;
        result.errors.push(`Invalid URL format: ${urlError.message}`);
        return result;
      }

      // 协议检查
      if (!rules.protocols.includes(result.parsedUrl.protocol)) {
        result.isValid = false;
        result.errors.push(`Unsupported protocol: ${result.parsedUrl.protocol}`);
      }

      // localhost检查
      if (!rules.allowLocalhost && this.isLocalhost(result.parsedUrl.hostname)) {
        result.isValid = false;
        result.errors.push('Localhost URLs are not allowed');
      }

      // 私有IP检查
      if (!rules.allowPrivateIPs && this.isPrivateIP(result.parsedUrl.hostname)) {
        result.warnings.push('URL points to private IP address');
      }

      // 安全检查
      if (this.containsSuspiciousPatterns(urlString)) {
        result.warnings.push('URL contains suspicious patterns');
      }

    } catch (error) {
      logger.error('Error validating URL:', error);
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 验证代码内容
   */
  validateCode(content, options = {}) {
    const rules = { ...this.validationRules.code, ...options };
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      processedContent: content,
      detectedLanguage: null
    };

    try {
      // 基本文本验证
      const textResult = this.validateText(content, {
        minLength: rules.minLength,
        maxLength: rules.maxLength,
        allowEmpty: rules.allowEmpty
      });

      result.isValid = textResult.isValid;
      result.errors = textResult.errors;
      result.warnings = textResult.warnings;
      result.processedContent = textResult.processedContent;

      if (!result.isValid) {
        return result;
      }

      // 代码特定检查
      if (this.containsMaliciousCode(result.processedContent)) {
        result.warnings.push('Code contains potentially malicious patterns');
      }

      // 语言检测
      if (rules.detectLanguage) {
        result.detectedLanguage = this.detectCodeLanguage(result.processedContent);
      }

    } catch (error) {
      logger.error('Error validating code content:', error);
      result.isValid = false;
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * 检查是否包含危险字符
   */
  containsDangerousChars(content) {
    const dangerousPatterns = [
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // 控制字符
      /<script[^>]*>.*?<\/script>/gi,        // Script标签
      /javascript:/gi,                       // JavaScript协议
      /data:.*base64/gi                      // Base64数据URI
    ];

    return dangerousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否为localhost
   */
  isLocalhost(hostname) {
    const localhostPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0'
    ];
    
    return localhostPatterns.includes(hostname.toLowerCase());
  }

  /**
   * 检查是否为私有IP
   */
  isPrivateIP(hostname) {
    const privateIPPatterns = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^169\.254\./,              // 169.254.0.0/16 (链路本地)
      /^fc00:/,                   // IPv6 私有地址
      /^fe80:/                    // IPv6 链路本地
    ];

    return privateIPPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * 检查URL是否包含可疑模式
   */
  containsSuspiciousPatterns(url) {
    const suspiciousPatterns = [
      /bit\.ly|tinyurl|t\.co/i,   // 短链接服务
      /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/, // 直接IP地址
      /%[0-9a-f]{2}/gi,           // URL编码
      /\.\./,                     // 路径遍历
      /[<>'"]/                    // HTML特殊字符
    ];

    return suspiciousPatterns.some(pattern => pattern.test(url));
  }

  /**
   * 检查代码是否包含恶意模式
   */
  containsMaliciousCode(code) {
    const maliciousPatterns = [
      /eval\s*\(/gi,              // eval函数
      /exec\s*\(/gi,              // exec函数
      /system\s*\(/gi,            // system调用
      /shell_exec/gi,             // shell执行
      /file_get_contents/gi,      // 文件读取
      /fopen\s*\(/gi,             // 文件操作
      /\$_GET|\$_POST|\$_REQUEST/gi, // PHP超全局变量
      /document\.cookie/gi,       // Cookie访问
      /localStorage|sessionStorage/gi // 存储访问
    ];

    return maliciousPatterns.some(pattern => pattern.test(code));
  }

  /**
   * 简单的代码语言检测
   */
  detectCodeLanguage(code) {
    const languagePatterns = {
      javascript: [/function\s+\w+\s*\(/, /var\s+\w+\s*=/, /console\.log/, /=>\s*{/],
      python: [/def\s+\w+\s*\(/, /import\s+\w+/, /print\s*\(/, /if\s+__name__\s*==/],
      java: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\.println/],
      php: [/<\?php/, /\$\w+\s*=/, /echo\s+/, /function\s+\w+\s*\(/],
      html: [/<html/, /<div/, /<script/, /<style/],
      css: [/\w+\s*{[^}]*}/, /@media/, /\.[\w-]+\s*{/],
      sql: [/SELECT\s+.*FROM/i, /INSERT\s+INTO/i, /UPDATE\s+.*SET/i, /DELETE\s+FROM/i]
    };

    for (const [language, patterns] of Object.entries(languagePatterns)) {
      if (patterns.some(pattern => pattern.test(code))) {
        return language;
      }
    }

    return 'unknown';
  }

  /**
   * 截断内容到指定长度
   */
  truncateContent(content, maxLength, suffix = '...') {
    if (!content || content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 更新验证规则
   */
  updateRules(type, newRules) {
    if (this.validationRules[type]) {
      this.validationRules[type] = { ...this.validationRules[type], ...newRules };
      logger.info(`Validation rules updated for type: ${type}`);
    } else {
      logger.warn(`Unknown validation type: ${type}`);
    }
  }

  /**
   * 获取当前验证规则
   */
  getRules(type) {
    return type ? this.validationRules[type] : this.validationRules;
  }
}

module.exports = ContentValidator;
