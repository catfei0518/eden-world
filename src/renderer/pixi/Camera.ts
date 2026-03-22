/**
 * 相机控制器
 */

import * as PIXI from 'pixi.js';

export class Camera {
    private container: PIXI.Container;
    private zoomLevel: 'FAR' | 'NORMAL' | 'CLOSE' = 'NORMAL';
    
    private readonly ZOOM_LEVELS: Record<string, number> = {
        'FAR': 0.25,
        'NORMAL': 1.0,
        'CLOSE': 4.0
    };
    
    private worldWidth: number = 0;
    private worldHeight: number = 0;
    private viewWidth: number = 0;
    private viewHeight: number = 0;
    
    constructor(container: PIXI.Container) {
        this.container = container;
    }
    
    setWorldSize(worldWidth: number, worldHeight: number): void {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }
    
    setViewSize(viewWidth: number, viewHeight: number): void {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
    }
    
    setZoom(level: 'FAR' | 'NORMAL' | 'CLOSE'): void {
        this.zoomLevel = level;
        const zoom = this.ZOOM_LEVELS[level];
        this.container.scale.set(zoom);
        
        // 缩放后重新居中
        this.recenter();
    }
    
    private recenter(): void {
        const zoom = this.getZoom();
        const scaledWidth = this.worldWidth * zoom;
        const scaledHeight = this.worldHeight * zoom;
        
        // 计算使地图居中的偏移量
        const offsetX = (this.viewWidth - scaledWidth) / 2;
        const offsetY = (this.viewHeight - scaledHeight) / 2;
        
        this.container.x = offsetX;
        this.container.y = offsetY;
        
        console.log('重新居中: zoom=' + zoom, 'offset=', offsetX, offsetY);
    }
    
    getZoom(): number {
        return this.ZOOM_LEVELS[this.zoomLevel];
    }
    
    getZoomLevel(): string {
        return this.zoomLevel;
    }
    
    pan(dx: number, dy: number): void {
        this.container.x += dx;
        this.container.y += dy;
    }
    
    setPosition(x: number, y: number): void {
        this.container.x = x;
        this.container.y = y;
    }
    
    getPosition(): { x: number; y: number } {
        return {
            x: this.container.x,
            y: this.container.y
        };
    }
    
    setCenter(): void {
        this.recenter();
    }
    
    zoomIn(worldX?: number, worldY?: number, viewX?: number, viewY?: number): void {
        let newLevel: 'FAR' | 'NORMAL' | 'CLOSE' = 'NORMAL';
        if (this.zoomLevel === 'FAR') {
            newLevel = 'NORMAL';
        } else if (this.zoomLevel === 'NORMAL') {
            newLevel = 'CLOSE';
        }
        
        if (worldX !== undefined && worldY !== undefined && viewX !== undefined && viewY !== undefined) {
            this.zoomToPoint(newLevel, worldX, worldY, viewX, viewY);
        } else {
            this.setZoom(newLevel);
        }
    }
    
    zoomOut(worldX?: number, worldY?: number, viewX?: number, viewY?: number): void {
        let newLevel: 'FAR' | 'NORMAL' | 'CLOSE' = 'NORMAL';
        if (this.zoomLevel === 'CLOSE') {
            newLevel = 'NORMAL';
        } else if (this.zoomLevel === 'NORMAL') {
            newLevel = 'FAR';
        }
        
        if (worldX !== undefined && worldY !== undefined && viewX !== undefined && viewY !== undefined) {
            this.zoomToPoint(newLevel, worldX, worldY, viewX, viewY);
        } else {
            this.setZoom(newLevel);
        }
    }
    
    private zoomToPoint(level: 'FAR' | 'NORMAL' | 'CLOSE', worldX: number, worldY: number, viewX: number, viewY: number): void {
        const oldZoom = this.getZoom();
        const newZoom = this.ZOOM_LEVELS[level];
        
        // 计算新位置以保持worldX, worldY在视图上的位置不变
        const newX = viewX - worldX * newZoom;
        const newY = viewY - worldY * newZoom;
        
        this.zoomLevel = level;
        this.container.scale.set(newZoom);
        this.container.x = newX;
        this.container.y = newY;
    }
}
