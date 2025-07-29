/**
 * M-SYNC URL消息处理性能测试工具
 * 用于分析URL消息处理的各个步骤耗时
 */

const fetch = globalThis.fetch;

// 测试URL消息
const testMessage = {
    token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0",
    messageType: "URL",
    content: "https://www.github.com"
};

async function performanceTest() {
    console.log('🚀 开始URL消息处理性能测试...\n');
    
    const startTime = Date.now();
    console.log(`⏰ 测试开始时间: ${new Date(startTime).toLocaleTimeString()}.${startTime % 1000}`);
    
    try {
        // 发送消息
        console.log('📤 发送URL消息...');
        const sendStartTime = Date.now();
        
        const response = await fetch('http://127.0.0.1:3000/api/v1/messages/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testMessage)
        });

        const sendEndTime = Date.now();
        const result = await response.json();
        
        console.log(`✅ 消息发送完成 - 耗时: ${sendEndTime - sendStartTime}ms`);
        console.log(`📊 响应状态: ${response.status} ${response.statusText}`);
        console.log(`📋 响应内容:`, JSON.stringify(result, null, 2));
        
        if (response.ok && result.success) {
            console.log(`\n🎯 性能测试结果:`);
            console.log(`   📤 消息发送耗时: ${sendEndTime - sendStartTime}ms`);
            console.log(`   📨 消息ID: ${result.messageId}`);
            console.log(`   👥 投递到客户端数量: ${result.deliveredTo}`);
            
            console.log(`\n⏱️  预期客户端处理时序:`);
            console.log(`   1. 消息接收和解析: ~10-50ms`);
            console.log(`   2. 剪贴板写入: ~10-30ms`);
            console.log(`   3. 系统通知发送: ~100-500ms (可能的瓶颈)`);
            console.log(`   4. 浏览器启动: ~50-200ms`);
            console.log(`   总预期耗时: ~170-780ms`);
            
            console.log(`\n🔍 请观察客户端日志中的实际时序:`);
            console.log(`   - 查看各步骤的时间戳差异`);
            console.log(`   - 特别关注系统通知和浏览器启动的间隔`);
            console.log(`   - 如果间隔>2秒，则存在性能问题`);
            
        } else {
            console.log('❌ 消息发送失败！');
        }
        
    } catch (error) {
        console.error('❌ 性能测试失败:', error.message);
    }
    
    const endTime = Date.now();
    console.log(`\n⏰ 测试结束时间: ${new Date(endTime).toLocaleTimeString()}.${endTime % 1000}`);
    console.log(`🕐 总测试耗时: ${endTime - startTime}ms`);
}

// 连续性能测试
async function continuousPerformanceTest(count = 3, interval = 5000) {
    console.log(`🔄 开始连续性能测试 - ${count}次测试，间隔${interval}ms\n`);
    
    for (let i = 1; i <= count; i++) {
        console.log(`\n=== 第 ${i}/${count} 次测试 ===`);
        await performanceTest();
        
        if (i < count) {
            console.log(`\n⏳ 等待 ${interval}ms 后进行下一次测试...`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    
    console.log(`\n🎉 连续性能测试完成！`);
    console.log(`📊 请分析客户端日志中的性能数据，识别瓶颈所在。`);
}

// 根据命令行参数决定运行模式
const args = process.argv.slice(2);
if (args.includes('--continuous')) {
    const count = parseInt(args.find(arg => arg.startsWith('--count='))?.split('=')[1]) || 3;
    const interval = parseInt(args.find(arg => arg.startsWith('--interval='))?.split('=')[1]) || 5000;
    continuousPerformanceTest(count, interval);
} else {
    performanceTest();
}
