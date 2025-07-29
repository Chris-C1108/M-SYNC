/**
 * 并发测试3种类型的M-SYNC消息发送
 */

const fetch = globalThis.fetch;

// 测试消息数据
const testMessages = [
    {
        token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0",
        messageType: "TEXT",
        content: "并发测试001 - 文本消息"
    },
    {
        token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0", 
        messageType: "CODE",
        content: "console.log('并发测试002 - 代码消息');"
    },
    {
        token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0",
        messageType: "URL", 
        content: "https://github.com/microsoft/vscode"
    }
];

async function sendMessage(messageData, index) {
    try {
        console.log(`📤 发送消息 ${index + 1} (${messageData.messageType})...`);
        
        const response = await fetch('http://127.0.0.1:3000/api/v1/messages/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });

        console.log(`📊 消息 ${index + 1} 响应状态: ${response.status} ${response.statusText}`);
        
        const result = await response.json();
        console.log(`📋 消息 ${index + 1} 响应内容:`, JSON.stringify(result, null, 2));
        
        if (response.ok && result.success) {
            console.log(`✅ 消息 ${index + 1} (${messageData.messageType}) 发送成功！deliveredTo: ${result.deliveredTo}`);
        } else {
            console.log(`❌ 消息 ${index + 1} (${messageData.messageType}) 发送失败！`);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ 发送消息 ${index + 1} 时出错:`, error.message);
        return null;
    }
}

async function sendConcurrentMessages() {
    console.log('🚀 开始并发发送3种类型的测试消息...\n');
    
    // 并发发送所有消息
    const promises = testMessages.map((message, index) => sendMessage(message, index));
    const results = await Promise.all(promises);
    
    console.log('\n📊 并发发送结果汇总:');
    results.forEach((result, index) => {
        if (result && result.success) {
            console.log(`   ✅ 消息 ${index + 1} (${testMessages[index].messageType}): 成功 - deliveredTo: ${result.deliveredTo}`);
        } else {
            console.log(`   ❌ 消息 ${index + 1} (${testMessages[index].messageType}): 失败`);
        }
    });
    
    console.log('\n🔍 请检查：');
    console.log('   1. 服务器终端日志是否显示3条消息的发布和广播');
    console.log('   2. 客户端终端是否显示3条消息的接收和处理');
    console.log('   3. TEXT和CODE消息是否复制到剪贴板');
    console.log('   4. URL消息是否在浏览器中打开');
    console.log('   5. 系统通知是否正常显示');
}

sendConcurrentMessages();
