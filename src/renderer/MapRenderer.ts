/**
 * 地图渲染器 - 简化版
 * 
 * 使用Canvas 2D渲染地图
 */

import { GameMap, TileType } from '../world/MapGenerator';

// Tile像素大小
const TILE_SIZE = 64;

// 地形类型到素材文件的映射
const TERRAIN_ASSETS: Record<string, string> = {
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
};

/**
 * 缩放级别
 */
export type ZoomLevel = 'FAR' | 'NORMAL' | 'CLOSE';

/**
 * 缩放比例
 */
export const ZOOM_LEVELS: Record<ZoomLevel, number> = {
    FAR: 0.25,
    NORMAL: 1.0,
    CLOSE: 4.0,
};

/**
 * 地图渲染器
 */
export class MapRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private map: GameMap;
    
    // 纹理缓存
    private textureCache: Map<string, HTMLImageElement> = new Map();
    
    // 相机状态
    private cameraX = 0;
    private cameraY = 0;
    private zoomLevel: ZoomLevel = 'NORMAL';
    private zoom = 1.0;
    
    // 视口大小
    private viewportWidth: number;
    private viewportHeight: number;
    
    // 键盘状态
    private keys: Set<string> = new Set();
    
    constructor(map: GameMap, width: number, height: number) {
        this.map = map;
        this.viewportWidth = width;
        this.viewportHeight = height;
        
        // 创建Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.imageRendering = 'pixelated';
        
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Cannot get 2D context');
        this.ctx = ctx;
        
        // 初始相机位置
        const mapSize = this.map.getSize();
        const worldWidth = mapSize.width * TILE_SIZE;
        const worldHeight = mapSize.height * TILE_SIZE;
        
        this.cameraX = Math.max(0, (worldWidth - this.viewportWidth) / 2);
        this.cameraY = Math.max(0, (worldHeight - this.viewportHeight) / 2);
    }
    
    /**
     * 初始化渲染器
     */
    async init(): Promise<void> {
        // 加载纹理
        await this.loadTextures();
        
        // 设置键盘事件
        this.setupKeyboard();
        
        // 设置鼠标事件
        this.setupMouse();
        
        // 初始渲染
        this.render();
    }
    
    /**
     * 加载所有纹理
     */
    private async loadTextures(): Promise<void> {
        const promises: Promise<void>[] = [];
        
        for (const [type, path] of Object.entries(TERRAIN_ASSETS)) {
            promises.push(this.loadTexture(type, path));
        }
        
        await Promise.all(promises);
    }
    
    /**
     * 加载单个纹理
     */
    private loadTexture(type: string, path: string): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.textureCache.set(type, img);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load texture: ${path}`);
                resolve();
            };
            img.src = path;
        });
    }
    
    /**
     * 设置键盘事件
     */
    private setupKeyboard(): void {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key);
            
            if (e.key === '1') this.setZoom('FAR');
            if (e.key === '2') this.setZoom('NORMAL');
            if (e.key === '3') this.setZoom('CLOSE');
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key);
        });
    }
    
    /**
     * 设置鼠标事件
     */
    private setupMouse(): void {
        const canvas = this.canvas;
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            canvas.style.cursor = 'grabbing';
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            
            this.pan(deltaX, deltaY);
            
            lastX = e.clientX;
            lastY = e.clientY;
        });
        
        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });
        
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });
        
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (e.deltaY < 0) {
                if (this.zoomLevel === 'FAR') this.setZoom('NORMAL');
                else if (this.zoomLevel === 'NORMAL') this.setZoom('CLOSE');
            } else {
                if (this.zoomLevel === 'CLOSE') this.setZoom('NORMAL');
                else if (this.zoomLevel === 'NORMAL') this.setZoom('FAR');
            }
        });
        
        canvas.style.cursor = 'grab';
    }
    
    /**
     * 渲染地图
     */
    render(): void {
        const ctx = this.ctx;
        const mapSize = this.map.getSize();
        
        // 清空画布
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
        
        // 计算可见范围
        const startTileX = Math.floor(this.cameraX / TILE_SIZE);
        const startTileY = Math.floor(this.cameraY / TILE_SIZE);
        const tilesX = Math.ceil(this.viewportWidth / (TILE_SIZE * this.zoom)) + 2;
        const tilesY = Math.ceil(this.viewportHeight / (TILE_SIZE * this.zoom)) + 2;
        
        ctx.save();
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.cameraX, -this.cameraY);
        
        // 渲染地形 - Tile放大35%以覆盖缝隙
        const SCALE = 1.35;
        const SCALED_SIZE = TILE_SIZE * SCALE;
        const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;
        
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tileX = startTileX + x;
                const tileY = startTileY + y;
                
                if (tileX < 0 || tileX >= mapSize.width || tileY < 0 || tileY >= mapSize.height) {
                    continue;
                }
                
                const tile = this.map.getTile(tileX, tileY);
                if (!tile) continue;
                
                const texture = this.textureCache.get(tile.type);
                if (!texture) continue;
                
                ctx.drawImage(
                    texture,
                    tileX * TILE_SIZE - OFFSET,
                    tileY * TILE_SIZE - OFFSET,
                    SCALED_SIZE,
                    SCALED_SIZE
                );
            }
        }
        
        ctx.restore();
    }
    
    /**
     * 移动相机
     */
    pan(deltaX: number, deltaY: number): void {
        const mapSize = this.map.getSize();
        const maxX = mapSize.width * TILE_SIZE - this.viewportWidth / this.zoom;
        const maxY = mapSize.height * TILE_SIZE - this.viewportHeight / this.zoom;
        
        // 向右拖 = 地图向左移动 = cameraX减少
        this.cameraX = Math.max(0, Math.min(maxX, this.cameraX - deltaX / this.zoom));
        // 向上拖 = 地图向下移动 = cameraY减少
        this.cameraY = Math.max(0, Math.min(maxY, this.cameraY - deltaY / this.zoom));
        
        this.render();
    }
    
    /**
     * 设置缩放级别
     */
    setZoom(level: ZoomLevel): void {
        this.zoomLevel = level;
        this.zoom = ZOOM_LEVELS[level];
        
        // 重新居中相机
        const mapSize = this.map.getSize();
        const worldWidth = mapSize.width * TILE_SIZE;
        const worldHeight = mapSize.height * TILE_SIZE;
        
        const viewWidth = this.viewportWidth / this.zoom;
        const viewHeight = this.viewportHeight / this.zoom;
        
        this.cameraX = Math.max(0, (worldWidth - viewWidth) / 2);
        this.cameraY = Math.max(0, (worldHeight - viewHeight) / 2);
        
        this.render();
    }
    
    /**
     * 获取画布
     */
    getView(): HTMLCanvasElement {
        return this.canvas;
    }
    
    /**
     * 更新循环
     */
    update(): void {
        const speed = 10;
        if (this.keys.has('ArrowLeft') || this.keys.has('a')) {
            this.pan(-speed, 0);
        }
        if (this.keys.has('ArrowRight') || this.keys.has('d')) {
            this.pan(speed, 0);
        }
        if (this.keys.has('ArrowUp') || this.keys.has('w')) {
            this.pan(0, -speed);
        }
        if (this.keys.has('ArrowDown') || this.keys.has('s')) {
            this.pan(0, speed);
        }
    }
    
    /**
     * 获取相机位置
     */
    getCameraX(): number { return this.cameraX; }
    getCameraY(): number { return this.cameraY; }
    getZoom(): number { return this.zoom; }
}
