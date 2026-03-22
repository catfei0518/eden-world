/**
 * 伊甸世界 - 主入口
 */

import { GameMap, TileType } from './world/MapGenerator';
import { CharacterManager, CHARACTER_SIZE } from './renderer/CharacterRenderer';
import { ItemManager } from './renderer/ItemRenderer';

const TILE_SIZE = 64;
const SCALE = 1.35;

const CONFIG = {
    map: { width: 100, height: 50, seed: 12345 },
    viewport: {
        width: Math.floor(window.innerWidth),
        height: Math.floor(window.innerHeight * 0.95),
    },
    game: { tickRate: 1000 / 30 },
};

const TERRAIN_TEXTURES: Record<string, string> = {
    [TileType.PLAIN]: 'img/64x64像素草平原.png',
    [TileType.GRASS]: 'img/64x64像素草地春.png',
    [TileType.DESERT]: 'img/64x64像素沙漠.png',
    [TileType.FOREST]: 'img/64x64像素森林春夏.png',
    [TileType.OCEAN]: 'img/海洋.png',
    [TileType.LAKE]: 'img/湖泊春夏秋.png',
    [TileType.RIVER]: 'img/河流.png',
    [TileType.SWAMP]: 'img/沼泽.png',
    [TileType.MOUNTAIN]: 'img/山地.png',
    [TileType.HILL]: 'img/山丘.png',
    [TileType.CAVE]: 'img/石头.png',
    [TileType.BEACH]: 'img/沙滩.png',
};

const textureCache = new Map<string, HTMLImageElement>();

async function loadTextures() {
    const promises: Promise<void>[] = [];
    for (const [type, path] of Object.entries(TERRAIN_TEXTURES)) {
        promises.push(loadTexture(type, path));
    }
    promises.push(loadTexture('adam', 'img/亚当.png'));
    promises.push(loadTexture('eve', 'img/夏娃.png'));
    await Promise.all(promises);
}

function loadTexture(type: string, path: string): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { textureCache.set(type, img); resolve(); };
        img.onerror = () => { console.warn(`Failed: ${path}`); resolve(); };
        img.src = path;
    });
}

async function main() {
    console.log('🌍 伊甸世界 启动中...');
    
    const map = new GameMap(CONFIG.map.width, CONFIG.map.height, CONFIG.map.seed);
    map.generate();
    console.log('✅ 地图生成完成');
    
    await loadTextures();
    console.log('✅ 纹理加载完成');
    
    // 初始化角色
    const characterManager = new CharacterManager(map);
    characterManager.init();
    console.log('✅ 角色初始化完成');
    
    // 初始化物品
    const itemManager = new ItemManager(map);
    itemManager.generate();
    console.log('✅ 物品初始化完成');
    
    // 创建画布
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.viewport.width;
    canvas.height = CONFIG.viewport.height;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d')!;
    
    const container = document.getElementById('game-container');
    if (container) { container.innerHTML = ''; container.appendChild(canvas); }
    
    // 相机状态
    let cameraX = 0, cameraY = 0, zoom = 1.0;
    let zoomLevel = 'NORMAL';
    const ZOOM_LEVELS: Record<string, number> = { FAR: 0.25, NORMAL: 1.0, CLOSE: 4.0 };
    
    // 居中相机
    cameraX = (CONFIG.map.width * TILE_SIZE - CONFIG.viewport.width) / 2;
    cameraY = (CONFIG.map.height * TILE_SIZE - CONFIG.viewport.height) / 2;
    
    // 输入状态
    const keys = new Set<string>();
    let isDragging = false, lastX = 0, lastY = 0;
    
    // 键盘事件
    window.addEventListener('keydown', (e) => {
        keys.add(e.key);
        if (e.key === '1') { zoomLevel = 'FAR'; zoom = ZOOM_LEVELS.FAR; }
        if (e.key === '2') { zoomLevel = 'NORMAL'; zoom = ZOOM_LEVELS.NORMAL; }
        if (e.key === '3') { zoomLevel = 'CLOSE'; zoom = ZOOM_LEVELS.CLOSE; }
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key));
    
    // 鼠标事件
    canvas.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        cameraX -= (e.clientX - lastX) / zoom;
        cameraY -= (e.clientY - lastY) / zoom;
        lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('mouseup', () => isDragging = false);
    canvas.addEventListener('mouseleave', () => isDragging = false);
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const mouseMapX = cameraX + e.offsetX / zoom;
        const mouseMapY = cameraY + e.offsetY / zoom;
        
        if (e.deltaY < 0) {
            if (zoomLevel === 'FAR') { zoomLevel = 'NORMAL'; zoom = ZOOM_LEVELS.NORMAL; }
            else if (zoomLevel === 'NORMAL') { zoomLevel = 'CLOSE'; zoom = ZOOM_LEVELS.CLOSE; }
        } else {
            if (zoomLevel === 'CLOSE') { zoomLevel = 'NORMAL'; zoom = ZOOM_LEVELS.NORMAL; }
            else if (zoomLevel === 'NORMAL') { zoomLevel = 'FAR'; zoom = ZOOM_LEVELS.FAR; }
        }
        
        cameraX = mouseMapX - e.offsetX / zoom;
        cameraY = mouseMapY - e.offsetY / zoom;
    });
    
    function render() {
        const mapSize = map.getSize();
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, CONFIG.viewport.width, CONFIG.viewport.height);
        
        const startTileX = Math.floor(cameraX / TILE_SIZE);
        const startTileY = Math.floor(cameraY / TILE_SIZE);
        const tilesX = Math.ceil(CONFIG.viewport.width / (TILE_SIZE * zoom)) + 2;
        const tilesY = Math.ceil(CONFIG.viewport.height / (TILE_SIZE * zoom)) + 2;
        
        ctx.save();
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX, -cameraY);
        
        const SCALED_SIZE = TILE_SIZE * SCALE;
        const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;
        
        // 渲染地形
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tileX = startTileX + x;
                const tileY = startTileY + y;
                if (tileX < 0 || tileX >= mapSize.width || tileY < 0 || tileY >= mapSize.height) continue;
                
                const tile = map.getTile(tileX, tileY);
                if (!tile) continue;
                
                const texture = textureCache.get(tile.type);
                if (!texture) continue;
                
                ctx.drawImage(texture, tileX * TILE_SIZE - OFFSET, tileY * TILE_SIZE - OFFSET, SCALED_SIZE, SCALED_SIZE);
            }
        }
        
        // 渲染物品 - ground层
        const items = itemManager.getItems();
        for (const item of items) {
            if (item.layer !== 'ground') continue;
            const tex = itemManager.getTexture(item.type);
            if (!tex) continue;
            const size = itemManager.getSize(item.layer);
            ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
        }
        
        // 渲染物品 - low层
        for (const item of items) {
            if (item.layer !== 'low') continue;
            const tex = itemManager.getTexture(item.type);
            if (!tex) continue;
            const size = itemManager.getSize(item.layer);
            ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
        }
        
        // 渲染物品 - high层
        for (const item of items) {
            if (item.layer !== 'high') continue;
            const tex = itemManager.getTexture(item.type);
            if (!tex) continue;
            const size = itemManager.getSize(item.layer);
            ctx.drawImage(tex, item.pixelX - size / 2, item.pixelY - size / 2, size, size);
        }
        
        // 渲染角色
        const characters = characterManager.getCharacters();
        for (const char of characters) {
            const charTex = textureCache.get(char.type);
            if (!charTex) continue;
            ctx.drawImage(charTex, char.pixelX - CHARACTER_SIZE / 2, char.pixelY - CHARACTER_SIZE / 2, CHARACTER_SIZE, CHARACTER_SIZE);
        }
        
        ctx.restore();
    }
    
    // 游戏循环
    setInterval(() => {
        characterManager.update();
        
        const speed = 10;
        if (keys.has('ArrowLeft') || keys.has('a')) cameraX -= speed / zoom;
        if (keys.has('ArrowRight') || keys.has('d')) cameraX += speed / zoom;
        if (keys.has('ArrowUp') || keys.has('w')) cameraY -= speed / zoom;
        if (keys.has('ArrowDown') || keys.has('s')) cameraY += speed / zoom;
        
        const maxX = CONFIG.map.width * TILE_SIZE - CONFIG.viewport.width / zoom;
        const maxY = CONFIG.map.height * TILE_SIZE - CONFIG.viewport.height / zoom;
        cameraX = Math.max(0, Math.min(maxX, cameraX));
        cameraY = Math.max(0, Math.min(maxY, cameraY));
        
        render();
    }, CONFIG.game.tickRate);
    
    render();
    console.log('✅ 游戏启动完成');
}

main().catch(console.error);
(window as any).edenWorld = { version: '0.6.0-alpha' };
