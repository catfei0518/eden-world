/**
 * 伊甸世界 - 主入口
 * 
 * 游戏启动入口
 */

import { GameMap } from './world/MapGenerator';
import { MapRenderer } from './renderer/MapRenderer';

/**
 * 游戏配置
 */
const CONFIG = {
    // 地图配置
    map: {
        width: 100,    // 100格
        height: 50,     // 50格
        seed: 12345,    // 固定seed便于调试
    },
    
    // 视口配置
    viewport: {
        width: 800,     // 800px宽
        height: 600,    // 600px高
    },
};

/**
 * 主函数
 */
async function main(): Promise<void> {
    console.log('🌍 伊甸世界 启动中...');
    
    // 1. 生成地图
    console.log('📍 生成地图...');
    const map = new GameMap(CONFIG.map.width, CONFIG.map.height, CONFIG.map.seed);
    map.generate();
    console.log(`✅ 地图生成完成: ${CONFIG.map.width}×${CONFIG.map.height}`);
    
    // 2. 创建渲染器
    console.log('🎨 初始化渲染器...');
    const renderer = new MapRenderer(
        map,
        CONFIG.viewport.width,
        CONFIG.viewport.height
    );
    
    await renderer.init();
    console.log('✅ 渲染器初始化完成');
    
    // 3. 添加到DOM
    const container = document.getElementById('game-container');
    if (container) {
        container.innerHTML = ''; // 清空加载提示
        container.appendChild(renderer.getView());
    } else {
        console.error('❌ 未找到 game-container 元素');
        return;
    }
    
    // 4. 启动游戏循环
    console.log('✅ 游戏循环启动');
    
    // 键盘移动循环
    setInterval(() => {
        renderer.update();
    }, 1000 / 60); // 60 FPS
    
    // 打印控制说明
    console.log(`
📖 控制说明:
- 方向键/WASD: 移动相机
- 鼠标拖拽: 移动相机
- 滚轮/1/2/3: 缩放地图
- 1: 远景 (1:4)
- 2: 标准 (1:1)
- 3: 近景 (4:1)
    `);
}

// 启动游戏
main().catch(console.error);

// 导出供调试用
(window as any).edenWorld = {
    version: '0.4.0-alpha',
};
