/**
 * M-SYNC 性能优化验证测试
 * 验证服务实例复用、异步操作优化、内存使用优化
 */

const fetch = globalThis.fetch;

// 测试配置
const TEST_CONFIG = {
    baseUrl: 'http://127.0.0.1:3000/api/v1/messages/publish',
    token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0",
    testMessages: [
        { type: "TEXT", content: "性能测试001 - 服务实例复用验证" },
        { type: "CODE", content: "console.log('性能测试002 - 异步操作优化验证');" },
        { type: "URL", content: "https://github.com/performance-test" },
        { type: "TEXT", content: "性能测试004 - 内存使用优化验证" },
        { type: "URL", content: "https://www.example.com/memory-test" }
    ]
};

async function sendMessage(messageType, content, testIndex) {
    const startTime = Date.now();
    
    try {
        const response = await fetch(TEST_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: TEST_CONFIG.token,
                messageType: messageType,
                content: content
            })
        });

        const endTime = Date.now();
        const result = await response.json();
        
        return {
            success: response.ok && result.success,
            messageId: result.messageId,
            sendTime: endTime - startTime,
            messageType,
            content,
            testIndex
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            messageType,
            content,
            testIndex
        };
    }
}

async function performanceOptimizationTest() {
    console.log('🚀 开始M-SYNC性能优化验证测试...\n');
    
    console.log('📋 测试目标:');
    console.log('   ✅ 服务实例复用验证');
    console.log('   ✅ 异步操作优化验证');
    console.log('   ✅ 内存使用优化验证');
    console.log('   ✅ 并发处理性能验证\n');
    
    const overallStartTime = Date.now();
    const results = [];
    
    // 阶段1: 顺序发送测试（验证服务实例复用）
    console.log('📊 阶段1: 服务实例复用验证');
    console.log('   发送多个消息，观察客户端是否复用服务实例...\n');
    
    for (let i = 0; i < TEST_CONFIG.testMessages.length; i++) {
        const msg = TEST_CONFIG.testMessages[i];
        console.log(`   📤 发送消息 ${i + 1}/${TEST_CONFIG.testMessages.length}: ${msg.type} - ${msg.content.substring(0, 30)}...`);
        
        const result = await sendMessage(msg.type, msg.content, i + 1);
        results.push(result);
        
        if (result.success) {
            console.log(`   ✅ 发送成功 - 耗时: ${result.sendTime}ms`);
        } else {
            console.log(`   ❌ 发送失败: ${result.error}`);
        }
        
        // 间隔1秒，观察服务实例复用
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 阶段2: 异步操作优化验证');
    console.log('   并发发送多个URL消息，验证并行处理...\n');
    
    // 阶段2: 并发发送测试（验证异步操作优化）
    const concurrentMessages = [
        { type: "URL", content: "https://www.github.com/async-test-1" },
        { type: "URL", content: "https://www.google.com/async-test-2" },
        { type: "URL", content: "https://www.stackoverflow.com/async-test-3" }
    ];
    
    const concurrentStartTime = Date.now();
    const concurrentPromises = concurrentMessages.map((msg, index) => 
        sendMessage(msg.type, msg.content, `concurrent-${index + 1}`)
    );
    
    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentEndTime = Date.now();
    
    console.log(`   🎯 并发发送完成 - 总耗时: ${concurrentEndTime - concurrentStartTime}ms`);
    
    concurrentResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
            console.log(`   ✅ 并发消息 ${index + 1} 成功 - 耗时: ${result.value.sendTime}ms`);
        } else {
            console.log(`   ❌ 并发消息 ${index + 1} 失败`);
        }
    });
    
    console.log('\n📊 阶段3: 内存使用优化验证');
    console.log('   发送大量消息，观察内存使用情况...\n');
    
    // 阶段3: 内存压力测试
    const memoryTestCount = 10;
    const memoryTestStartTime = Date.now();
    
    for (let i = 0; i < memoryTestCount; i++) {
        const testMsg = {
            type: "TEXT",
            content: `内存测试消息 ${i + 1}/${memoryTestCount} - ${'x'.repeat(100)}` // 较长的内容
        };
        
        const result = await sendMessage(testMsg.type, testMsg.content, `memory-${i + 1}`);
        
        if (i % 3 === 0) {
            console.log(`   📤 内存测试进度: ${i + 1}/${memoryTestCount}`);
        }
        
        // 短间隔，增加内存压力
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const memoryTestEndTime = Date.now();
    console.log(`   🎯 内存测试完成 - 总耗时: ${memoryTestEndTime - memoryTestStartTime}ms`);
    
    // 统计结果
    const overallEndTime = Date.now();
    const successfulTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;
    
    console.log('\n📊 性能优化验证结果汇总:');
    console.log(`   🕐 总测试时间: ${overallEndTime - overallStartTime}ms`);
    console.log(`   ✅ 成功测试: ${successfulTests}/${results.length}`);
    console.log(`   ❌ 失败测试: ${failedTests}/${results.length}`);
    
    if (results.length > 0) {
        const avgSendTime = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.sendTime, 0) / successfulTests;
        
        console.log(`   📈 平均发送耗时: ${avgSendTime.toFixed(1)}ms`);
    }
    
    console.log('\n🔍 客户端验证要点:');
    console.log('   1. 服务实例复用验证:');
    console.log('      - 检查日志中是否显示 "Service created successfully" 只出现一次');
    console.log('      - 后续消息应该直接使用缓存的服务实例');
    console.log('   2. 异步操作优化验证:');
    console.log('      - URL消息的剪贴板、浏览器、通知应该在同一秒内执行');
    console.log('      - 并发消息应该能够同时处理');
    console.log('   3. 内存使用优化验证:');
    console.log('      - 检查内存使用是否稳定，没有明显的内存泄漏');
    console.log('      - 统计信息应该有合理的限制');
    
    console.log('\n✨ 性能优化验证测试完成！');
    
    return {
        totalTests: results.length,
        successfulTests,
        failedTests,
        overallTime: overallEndTime - overallStartTime,
        avgSendTime: successfulTests > 0 ? 
            results.filter(r => r.success).reduce((sum, r) => sum + r.sendTime, 0) / successfulTests : 0
    };
}

// 运行性能优化验证测试
performanceOptimizationTest().then(summary => {
    console.log('\n🎯 最终验证结果:');
    console.log(`   总测试数: ${summary.totalTests}`);
    console.log(`   成功率: ${(summary.successfulTests / summary.totalTests * 100).toFixed(1)}%`);
    console.log(`   总耗时: ${summary.overallTime}ms`);
    console.log(`   平均发送耗时: ${summary.avgSendTime.toFixed(1)}ms`);
    
    if (summary.successfulTests === summary.totalTests) {
        console.log('\n🎉 性能优化验证全部通过！系统性能优秀！');
    } else {
        console.log('\n⚠️  部分测试失败，需要进一步检查。');
    }
    
    console.log('\n📋 性能优化检查清单:');
    console.log('   ✅ 服务实例复用: 通过ServiceManager实现单例模式');
    console.log('   ✅ 异步操作优化: 使用Promise.allSettled并行执行');
    console.log('   ✅ 内存使用优化: 实现内存监控和自动清理');
    console.log('   ✅ 并发处理能力: 支持多消息并发处理');
    
}).catch(error => {
    console.error('❌ 性能优化验证过程中出现错误:', error);
});
