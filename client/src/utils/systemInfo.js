/**
 * 系统信息工具模块
 * 获取系统相关信息用于诊断和兼容性检查
 */

const os = require('os');
const si = require('systeminformation');
const logger = require('./logger').createLogger('SystemInfo');

/**
 * 获取基础系统信息
 */
async function getSystemInfo() {
  try {
    const [cpu, mem, osInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo()
    ]);

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      os: {
        type: os.type(),
        release: os.release(),
        version: osInfo.distro || os.version(),
        hostname: os.hostname()
      },
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed
      },
      memory: {
        total: Math.round(mem.total / 1024 / 1024 / 1024), // GB
        available: Math.round(mem.available / 1024 / 1024 / 1024), // GB
        used: Math.round(mem.used / 1024 / 1024 / 1024) // GB
      }
    };
  } catch (error) {
    logger.error('Failed to get system info:', error);
    
    // 返回基础信息作为后备
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      os: {
        type: os.type(),
        release: os.release(),
        hostname: os.hostname()
      },
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024 / 1024)
      }
    };
  }
}

/**
 * 检查系统兼容性
 */
async function checkCompatibility() {
  const compatibility = {
    clipboard: false,
    browser: false,
    notifications: false,
    issues: []
  };

  try {
    // 检查剪贴板支持
    try {
      const clipboardy = require('clipboardy');
      await clipboardy.read();
      compatibility.clipboard = true;
    } catch (error) {
      compatibility.issues.push('Clipboard access not available');
      logger.warn('Clipboard compatibility check failed:', error.message);
    }

    // 检查浏览器启动支持
    try {
      const open = require('open');
      compatibility.browser = true;
    } catch (error) {
      compatibility.issues.push('Browser launcher not available');
      logger.warn('Browser compatibility check failed:', error.message);
    }

    // 检查系统通知支持
    try {
      const notifier = require('node-notifier');
      compatibility.notifications = true;
    } catch (error) {
      compatibility.issues.push('System notifications not available');
      logger.warn('Notification compatibility check failed:', error.message);
    }

    // 平台特定检查
    if (process.platform === 'linux') {
      // Linux特定检查
      try {
        const { execSync } = require('child_process');
        
        // 检查显示服务器
        if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
          compatibility.issues.push('No display server detected (X11/Wayland)');
        }

        // 检查必要的系统工具
        try {
          execSync('which xclip', { stdio: 'ignore' });
        } catch {
          try {
            execSync('which xsel', { stdio: 'ignore' });
          } catch {
            compatibility.issues.push('Neither xclip nor xsel found (required for clipboard)');
            compatibility.clipboard = false;
          }
        }
      } catch (error) {
        logger.warn('Linux compatibility check failed:', error.message);
      }
    }

  } catch (error) {
    logger.error('Compatibility check failed:', error);
    compatibility.issues.push('System compatibility check failed');
  }

  return compatibility;
}

/**
 * 获取网络信息
 */
async function getNetworkInfo() {
  try {
    const networkInterfaces = os.networkInterfaces();
    const activeInterfaces = [];

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
      for (const iface of interfaces) {
        if (!iface.internal && iface.family === 'IPv4') {
          activeInterfaces.push({
            name,
            address: iface.address,
            netmask: iface.netmask,
            mac: iface.mac
          });
        }
      }
    }

    return {
      hostname: os.hostname(),
      interfaces: activeInterfaces
    };
  } catch (error) {
    logger.error('Failed to get network info:', error);
    return {
      hostname: os.hostname(),
      interfaces: []
    };
  }
}

/**
 * 获取进程信息
 */
function getProcessInfo() {
  const memUsage = process.memoryUsage();
  
  return {
    pid: process.pid,
    ppid: process.ppid,
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    },
    cpu: process.cpuUsage()
  };
}

/**
 * 生成系统诊断报告
 */
async function generateDiagnosticReport() {
  try {
    const [systemInfo, compatibility, networkInfo] = await Promise.all([
      getSystemInfo(),
      checkCompatibility(),
      getNetworkInfo()
    ]);

    const processInfo = getProcessInfo();

    return {
      timestamp: new Date().toISOString(),
      system: systemInfo,
      compatibility,
      network: networkInfo,
      process: processInfo
    };
  } catch (error) {
    logger.error('Failed to generate diagnostic report:', error);
    throw error;
  }
}

module.exports = {
  getSystemInfo,
  checkCompatibility,
  getNetworkInfo,
  getProcessInfo,
  generateDiagnosticReport
};
