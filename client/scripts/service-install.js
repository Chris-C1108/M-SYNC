#!/usr/bin/env node

/**
 * 系统服务安装脚本
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const serviceName = 'msync-desktop-subscriber';
const serviceDisplayName = 'M-SYNC Desktop Subscriber';
const serviceDescription = 'M-SYNC cross-device message synchronization client';

console.log(`🔧 安装 ${serviceDisplayName} 系统服务...`);
console.log(`📋 平台: ${platform}`);

try {
  switch (platform) {
    case 'win32':
      installWindowsService();
      break;
    case 'darwin':
      installMacOSService();
      break;
    case 'linux':
      installLinuxService();
      break;
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
  
  console.log('✅ 服务安装完成！');
  console.log('\n📋 服务管理命令:');
  printServiceCommands();
  
} catch (error) {
  console.error('❌ 服务安装失败:', error.message);
  process.exit(1);
}

/**
 * 安装Windows服务
 */
function installWindowsService() {
  const nodePath = process.execPath;
  const scriptPath = path.resolve(__dirname, '..', 'src', 'index.js');
  
  // 创建服务配置
  const serviceConfig = `
[Unit]
Description=${serviceDescription}
After=network.target

[Service]
Type=simple
User=LocalSystem
ExecStart="${nodePath}" "${scriptPath}"
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
`;

  // 使用 node-windows 或 nssm 安装服务
  try {
    // 尝试使用 nssm
    execSync(`nssm install "${serviceName}" "${nodePath}" "${scriptPath}"`, { stdio: 'inherit' });
    execSync(`nssm set "${serviceName}" DisplayName "${serviceDisplayName}"`, { stdio: 'inherit' });
    execSync(`nssm set "${serviceName}" Description "${serviceDescription}"`, { stdio: 'inherit' });
    execSync(`nssm set "${serviceName}" Start SERVICE_AUTO_START`, { stdio: 'inherit' });
    
    console.log('✅ Windows服务安装完成 (使用 nssm)');
  } catch (error) {
    console.log('⚠️  nssm 不可用，尝试使用 node-windows...');
    
    // 尝试使用 node-windows
    try {
      const Service = require('node-windows').Service;
      
      const svc = new Service({
        name: serviceName,
        description: serviceDescription,
        script: scriptPath,
        nodeOptions: [
          '--harmony',
          '--max_old_space_size=4096'
        ]
      });
      
      svc.on('install', () => {
        console.log('✅ Windows服务安装完成 (使用 node-windows)');
        svc.start();
      });
      
      svc.install();
    } catch (nodeWindowsError) {
      throw new Error(`Windows服务安装失败: ${nodeWindowsError.message}`);
    }
  }
}

/**
 * 安装macOS服务 (LaunchAgent)
 */
function installMacOSService() {
  const nodePath = process.execPath;
  const scriptPath = path.resolve(__dirname, '..', 'src', 'index.js');
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.msync.${serviceName}.plist`);
  
  // 创建LaunchAgent plist文件
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.msync.${serviceName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${scriptPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(os.homedir(), 'Library', 'Logs', serviceName + '.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(os.homedir(), 'Library', 'Logs', serviceName + '-error.log')}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>`;

  // 确保目录存在
  const launchAgentsDir = path.dirname(plistPath);
  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
  }
  
  const logsDir = path.join(os.homedir(), 'Library', 'Logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // 写入plist文件
  fs.writeFileSync(plistPath, plistContent);
  
  // 加载服务
  execSync(`launchctl load "${plistPath}"`, { stdio: 'inherit' });
  
  console.log(`✅ macOS LaunchAgent 安装完成`);
  console.log(`📁 配置文件: ${plistPath}`);
}

/**
 * 安装Linux服务 (systemd)
 */
function installLinuxService() {
  const nodePath = process.execPath;
  const scriptPath = path.resolve(__dirname, '..', 'src', 'index.js');
  const servicePath = `/etc/systemd/system/${serviceName}.service`;
  
  // 创建systemd服务文件
  const serviceContent = `[Unit]
Description=${serviceDescription}
After=network.target
Wants=network.target

[Service]
Type=simple
User=${os.userInfo().username}
Group=${os.userInfo().username}
ExecStart=${nodePath} ${scriptPath}
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HOME=${os.homedir()}

# 日志配置
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${serviceName}

# 安全配置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${os.homedir()}/.config ${os.homedir()}/.local

[Install]
WantedBy=multi-user.target
`;

  // 写入服务文件 (需要sudo权限)
  try {
    execSync(`echo '${serviceContent}' | sudo tee ${servicePath}`, { stdio: 'inherit' });
    
    // 重新加载systemd配置
    execSync('sudo systemctl daemon-reload', { stdio: 'inherit' });
    
    // 启用服务
    execSync(`sudo systemctl enable ${serviceName}`, { stdio: 'inherit' });
    
    console.log(`✅ Linux systemd 服务安装完成`);
    console.log(`📁 服务文件: ${servicePath}`);
  } catch (error) {
    throw new Error(`需要sudo权限来安装systemd服务: ${error.message}`);
  }
}

/**
 * 打印服务管理命令
 */
function printServiceCommands() {
  switch (platform) {
    case 'win32':
      console.log(`启动服务: net start "${serviceName}"`);
      console.log(`停止服务: net stop "${serviceName}"`);
      console.log(`卸载服务: nssm remove "${serviceName}" confirm`);
      break;
      
    case 'darwin':
      console.log(`启动服务: launchctl start com.msync.${serviceName}`);
      console.log(`停止服务: launchctl stop com.msync.${serviceName}`);
      console.log(`卸载服务: launchctl unload ~/Library/LaunchAgents/com.msync.${serviceName}.plist`);
      break;
      
    case 'linux':
      console.log(`启动服务: sudo systemctl start ${serviceName}`);
      console.log(`停止服务: sudo systemctl stop ${serviceName}`);
      console.log(`查看状态: sudo systemctl status ${serviceName}`);
      console.log(`查看日志: sudo journalctl -u ${serviceName} -f`);
      console.log(`卸载服务: sudo systemctl disable ${serviceName} && sudo rm /etc/systemd/system/${serviceName}.service`);
      break;
  }
}
