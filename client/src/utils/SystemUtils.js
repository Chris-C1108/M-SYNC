/**
 * 系统工具类
 * 统一系统相关操作
 */

const { spawn } = require('child_process');
const logger = require('./logger').createLogger('SystemUtils');

class SystemUtils {
  constructor() {
    this.platform = process.platform;
    this.browserCommands = this.getBrowserCommands();
  }

  /**
   * 获取不同平台的浏览器启动命令
   */
  getBrowserCommands() {
    return {
      win32: {
        command: 'cmd',
        args: ['/c', 'start']
      },
      darwin: {
        command: 'open',
        args: []
      },
      linux: {
        command: 'xdg-open',
        args: []
      }
    };
  }

  /**
   * 在默认浏览器中打开URL
   */
  async openInBrowser(url) {
    try {
      const startTime = Date.now();
      logger.info('Opening URL in browser:', url);

      // 在控制台显示
      console.log(`\n🌐 Opening URL in browser: ${url}`);

      // 获取平台特定的命令
      const browserCommand = this.browserCommands[this.platform] || this.browserCommands.linux;
      const command = browserCommand.command;
      const args = [...browserCommand.args, url];

      // 启动浏览器进程
      const childProcess = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
      });
      
      childProcess.unref();

      const endTime = Date.now();
      logger.debug(`Browser launch completed in ${endTime - startTime}ms`);

      return true;
    } catch (error) {
      logger.error('Failed to open URL in browser:', error);
      throw error;
    }
  }

  /**
   * 执行系统命令
   */
  async executeCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      try {
        logger.debug('Executing command:', { command, args, options });

        const defaultOptions = {
          detached: false,
          stdio: 'pipe'
        };

        const mergedOptions = { ...defaultOptions, ...options };
        const childProcess = spawn(command, args, mergedOptions);

        let stdout = '';
        let stderr = '';

        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data) => {
            stdout += data.toString();
          });
        }

        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        }

        childProcess.on('close', (code) => {
          if (code === 0) {
            resolve({
              success: true,
              code,
              stdout: stdout.trim(),
              stderr: stderr.trim()
            });
          } else {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          }
        });

        childProcess.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 检查命令是否可用
   */
  async isCommandAvailable(command) {
    try {
      const testCommand = this.platform === 'win32' ? 'where' : 'which';
      await this.executeCommand(testCommand, [command]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PATH: process.env.PATH
      }
    };
  }

  /**
   * 检查是否为Windows平台
   */
  isWindows() {
    return this.platform === 'win32';
  }

  /**
   * 检查是否为macOS平台
   */
  isMacOS() {
    return this.platform === 'darwin';
  }

  /**
   * 检查是否为Linux平台
   */
  isLinux() {
    return this.platform === 'linux';
  }

  /**
   * 获取临时目录路径
   */
  getTempDir() {
    return require('os').tmpdir();
  }

  /**
   * 获取用户主目录路径
   */
  getHomeDir() {
    return require('os').homedir();
  }

  /**
   * 格式化文件路径（处理平台差异）
   */
  formatPath(path) {
    if (this.isWindows()) {
      return path.replace(/\//g, '\\');
    } else {
      return path.replace(/\\/g, '/');
    }
  }

  /**
   * 检查端口是否可用
   */
  async isPortAvailable(port, host = 'localhost') {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();

      server.listen(port, host, () => {
        server.once('close', () => {
          resolve(true);
        });
        server.close();
      });

      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * 获取可用端口
   */
  async getAvailablePort(startPort = 3000, maxAttempts = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available port found starting from ${startPort}`);
  }

  /**
   * 创建目录（如果不存在）
   */
  async ensureDirectory(dirPath) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        logger.debug(`Directory created: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * 安全地删除文件
   */
  async safeDeleteFile(filePath) {
    const fs = require('fs').promises;

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      logger.debug(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug(`File not found: ${filePath}`);
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath) {
    const fs = require('fs').promises;

    try {
      const stats = await fs.stat(filePath);
      return {
        exists: true,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false };
      }
      throw error;
    }
  }

  /**
   * 生成唯一的临时文件名
   */
  generateTempFileName(prefix = 'msync', extension = '.tmp') {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${random}${extension}`;
  }
}

module.exports = SystemUtils;
