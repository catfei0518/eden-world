/**
 * 伊甸世界在线版入口
 */
import { GameApp } from './GameApp';

// 防止重复初始化
let initialized = false;

// 创建游戏实例
const game = new GameApp();

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    if (initialized) return;
    initialized = true;
    console.log('🚀 启动伊甸世界在线版...');
    await game.init();
});
