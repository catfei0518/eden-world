/**
 * 伊甸世界 - 服务器入口
 */

import { GameServer } from './GameServer';

// 创建服务器实例
const server = new GameServer();

// 启动服务器
server.start();

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n📝 收到中断信号...');
    server.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n📝 收到终止信号...');
    server.stop();
    process.exit(0);
});

// 未捕获的异常
process.on('uncaughtException', (err) => {
    console.error('❌ 未捕获的异常:', err);
    server.stop();
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
});
