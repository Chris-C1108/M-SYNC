/**
 * 模拟curl命令测试M-SYNC消息发送
 */

const fetch = globalThis.fetch;

async function testMessageSend() {
  try {
    console.log('📤 发送测试消息...');
    
    const response = await fetch('http://127.0.0.1:3000/api/v1/messages/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: "edaff31702ca36826432e62c82ac59689f0c0417ae07a83a79446dab557057f4acfd43349483a7e701aa6e8f453c68b8d7af830c427deb9f8105f1e925633fa0",
        messageType: "URL",
        content: "https://www.github.com"
      })
    });

    console.log(`📊 响应状态: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    console.log('📋 响应内容:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ 消息发送成功！');
      console.log('🔍 请检查：');
      console.log('   1. 服务器终端日志是否显示消息发布和广播');
      console.log('   2. 客户端终端是否显示消息接收');
      console.log('   3. 剪贴板是否包含测试消息内容');
    } else {
      console.log('❌ 消息发送失败');
    }
    
  } catch (error) {
    console.error('💥 请求失败:', error.message);
  }
}

testMessageSend();
