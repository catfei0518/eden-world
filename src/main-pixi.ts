/**
 * 伊甸世界 - PixiJS版本
 */

import { GameApp } from './renderer/pixi/GameApp';
import { GameMap } from './world/MapGenerator';

const CONFIG = {
    map: { width: 100, height: 50, seed: 12345 },
    viewport: {
        width: Math.floor(window.innerWidth),
        height: Math.floor(window.innerHeight * 0.95),
    },
};

let game: GameApp;

async function main() {
    console.log('🌍 伊甸世界 启动中...');
    
    // 生成地图
    const map = new GameMap(CONFIG.map.width, CONFIG.map.height, CONFIG.map.seed);
    map.generate();
    console.log('✅ 地图生成完成');
    
    // 创建游戏应用
    try {
        game = new GameApp(map, CONFIG.viewport.width, CONFIG.viewport.height);
        await game.init();
        console.log('✅ PixiJS初始化完成');
        
        // 添加到DOM
        const container = document.getElementById('game-container');
        const view = game.getView();
        console.log('Canvas元素:', view);
        console.log('Canvas尺寸:', view?.width, view?.height);
        if (container && view) {
            container.innerHTML = '';
            container.appendChild(view);
            console.log('✅ Canvas已添加到DOM');
        } else {
            console.error('❌ Canvas获取失败');
        }
        
        // 隐藏加载提示
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    } catch (e) {
        console.error('初始化错误:', e);
        return;
    }
    
    // 相机控制
    const camera = game.getCamera();
    let isDragging = false;
    let lastX = 0, lastY = 0;
    
    const canvas = game.getView();
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        camera.pan(dx, dy);
        lastX = e.clientX;
        lastY = e.clientY;
    });
    
    canvas.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('mouseleave', () => isDragging = false);
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // 获取鼠标在世界坐标系中的位置
        const rect = canvas.getBoundingClientRect();
        const viewX = e.clientX - rect.left;
        const viewY = e.clientY - rect.top;
        
        // 计算鼠标下的世界坐标
        const worldPos = screenToWorld(viewX, viewY, camera);
        
        // 根据滚动方向切换缩放级别
        if (e.deltaY < 0) {
            camera.zoomIn(worldPos.x, worldPos.y, viewX, viewY);
        } else {
            camera.zoomOut(worldPos.x, worldPos.y, viewX, viewY);
        }
    });
    
    // 屏幕坐标转世界坐标
    function screenToWorld(screenX: number, screenY: number, cam: any): { x: number; y: number } {
        const pos = cam.getPosition();
        const zoom = cam.getZoom();
        return {
            x: (screenX - pos.x) / zoom,
            y: (screenY - pos.y) / zoom
        };
    }
    
    // 键盘控制
    const MOVE_SPEED = 20;
    window.addEventListener('keydown', (e) => {
        // 缩放
        if (e.key === '1') camera.setZoom('FAR');
        if (e.key === '2') camera.setZoom('NORMAL');
        if (e.key === '3') camera.setZoom('CLOSE');
        
        // WASD / 方向键移动
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            camera.pan(0, MOVE_SPEED);
        }
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
            camera.pan(0, -MOVE_SPEED);
        }
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
            camera.pan(MOVE_SPEED, 0);
        }
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
            camera.pan(-MOVE_SPEED, 0);
        }
    });
    
    // 启动游戏循环
    game.startTick();
    console.log('✅ 游戏启动完成');
}

main().catch(console.error);

(window as any).edenWorld = { version: '0.7.0-alpha-pixi' };
