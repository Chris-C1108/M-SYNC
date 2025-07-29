#!/usr/bin/env node

/**
 * 构建脚本 - 打包客户端为可执行文件
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

console.log('🚀 开始构建 M-SYNC 桌面客户端...');

// 确保dist目录存在
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 构建配置
const buildTargets = [
  {
    name: 'Windows x64',
    target: 'node18-win-x64',
    output: 'msync-client-win-x64.exe'
  },
  {
    name: 'macOS x64',
    target: 'node18-macos-x64',
    output: 'msync-client-macos-x64'
  },
  {
    name: 'macOS ARM64',
    target: 'node18-macos-arm64',
    output: 'msync-client-macos-arm64'
  },
  {
    name: 'Linux x64',
    target: 'node18-linux-x64',
    output: 'msync-client-linux-x64'
  }
];

// 检查pkg是否安装
try {
  execSync('npx pkg --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ pkg 未安装，正在安装...');
  execSync('npm install -g pkg', { stdio: 'inherit' });
}

// 创建临时的package.json用于打包
const buildPackageJson = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: pkg.main,
  bin: pkg.bin,
  dependencies: pkg.dependencies,
  pkg: {
    scripts: [
      'src/**/*.js'
    ],
    assets: [
      'config/**/*',
      'assets/**/*'
    ],
    outputPath: 'dist'
  }
};

const buildPackagePath = path.join(__dirname, '..', 'package-build.json');
fs.writeFileSync(buildPackagePath, JSON.stringify(buildPackageJson, null, 2));

try {
  // 构建所有目标平台
  for (const target of buildTargets) {
    console.log(`📦 构建 ${target.name}...`);
    
    const outputPath = path.join(distDir, target.output);
    const command = `npx pkg package-build.json --target ${target.target} --output "${outputPath}"`;
    
    try {
      execSync(command, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      
      console.log(`✅ ${target.name} 构建完成: ${target.output}`);
    } catch (error) {
      console.error(`❌ ${target.name} 构建失败:`, error.message);
    }
  }
  
  // 创建版本信息文件
  const versionInfo = {
    version: pkg.version,
    buildTime: new Date().toISOString(),
    targets: buildTargets.map(t => ({
      name: t.name,
      target: t.target,
      output: t.output,
      size: getFileSize(path.join(distDir, t.output))
    }))
  };
  
  fs.writeFileSync(
    path.join(distDir, 'build-info.json'),
    JSON.stringify(versionInfo, null, 2)
  );
  
  // 创建安装脚本
  createInstallScripts();
  
  console.log('\n🎉 构建完成！');
  console.log('\n📁 构建文件位置:');
  console.log(`   ${distDir}`);
  
  console.log('\n📋 构建信息:');
  versionInfo.targets.forEach(target => {
    if (target.size) {
      console.log(`   ${target.name}: ${target.output} (${target.size})`);
    }
  });
  
} finally {
  // 清理临时文件
  if (fs.existsSync(buildPackagePath)) {
    fs.unlinkSync(buildPackagePath);
  }
}

/**
 * 获取文件大小
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;
    
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * 创建安装脚本
 */
function createInstallScripts() {
  // Windows 安装脚本
  const windowsInstallScript = `@echo off
echo Installing M-SYNC Desktop Client...

REM 创建安装目录
set INSTALL_DIR=%PROGRAMFILES%\\M-SYNC
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

REM 复制可执行文件
copy "msync-client-win-x64.exe" "%INSTALL_DIR%\\msync-client.exe"

REM 添加到PATH (需要管理员权限)
setx PATH "%PATH%;%INSTALL_DIR%" /M

echo Installation completed!
echo You can now run 'msync-client' from anywhere in the command line.
pause
`;

  // macOS/Linux 安装脚本
  const unixInstallScript = `#!/bin/bash

echo "Installing M-SYNC Desktop Client..."

# 检测系统架构
ARCH=$(uname -m)
OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        BINARY="msync-client-macos-arm64"
    else
        BINARY="msync-client-macos-x64"
    fi
elif [ "$OS" = "Linux" ]; then
    BINARY="msync-client-linux-x64"
else
    echo "Unsupported operating system: $OS"
    exit 1
fi

# 检查二进制文件是否存在
if [ ! -f "$BINARY" ]; then
    echo "Binary file $BINARY not found!"
    exit 1
fi

# 安装到 /usr/local/bin
sudo cp "$BINARY" /usr/local/bin/msync-client
sudo chmod +x /usr/local/bin/msync-client

echo "Installation completed!"
echo "You can now run 'msync-client' from anywhere in the terminal."
`;

  fs.writeFileSync(path.join(distDir, 'install-windows.bat'), windowsInstallScript);
  fs.writeFileSync(path.join(distDir, 'install-unix.sh'), unixInstallScript);
  
  // 设置Unix脚本执行权限
  try {
    execSync('chmod +x ' + path.join(distDir, 'install-unix.sh'));
  } catch (error) {
    // 在Windows上可能会失败，忽略错误
  }
  
  console.log('📜 安装脚本已创建');
}
