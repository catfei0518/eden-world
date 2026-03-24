/**
 * 相机控制器 - 3档缩放
 */

import * as PIXI from 'pixi.js';

const MAP_WIDTH = 100;
const MAP_HEIGHT = 50;
const TILE_SIZE = 64;

export class Camera {
    public target: PIXI.Container;
    public scale: number = 1;
    
    // 3档缩放 - 与单机版一致
    private zoomLevel: 'FAR' | 'NORMAL' | 'CLOSE' = 'NORMAL';
    private readonly ZOOM_LEVELS = {
        'FAR': 0.25,
        'NORMAL': 1,
        'CLOSE': 4
    };
    
    private isDragging: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    
    constructor(target: PIXI.Container, canvas: HTMLCanvasElement) {
        this.target = target;
        this.setupControls(canvas);
    }
    
    setupControls(canvas: HTMLCanvasElement) {
        // 鼠标拖动
        canvas.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                canvas.style.cursor = 'grabbing';
            }
        });
        
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            canvas.style.cursor = 'grab';
        });
        
        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.isDragging) return;
            
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            
            this.target.x += dx;
            this.target.y += dy;
            
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });
        
        // 滚轮缩放 - 3档，以鼠标位置为中心
        canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            
            if (e.deltaY < 0) {
                this.zoomIn(e.clientX, e.clientY);
            } else {
                this.zoomOut(e.clientX, e.clientY);
            }
        });
        
        // 双击重置
        canvas.addEventListener('dblclick', () => {
            this.reset();
        });
        
        canvas.style.cursor = 'grab';
    }
    
    zoomIn(mouseX?: number, mouseY?: number) {
        if (this.zoomLevel === 'FAR') {
            this.setZoom('NORMAL', mouseX, mouseY);
        } else if (this.zoomLevel === 'NORMAL') {
            this.setZoom('CLOSE', mouseX, mouseY);
        }
    }
    
    zoomOut(mouseX?: number, mouseY?: number) {
        if (this.zoomLevel === 'CLOSE') {
            this.setZoom('NORMAL', mouseX, mouseY);
        } else if (this.zoomLevel === 'NORMAL') {
            this.setZoom('FAR', mouseX, mouseY);
        }
    }
    
    setZoom(level: 'FAR' | 'NORMAL' | 'CLOSE', mouseX?: number, mouseY?: number) {
        const oldZoom = this.scale;
        const newZoom = this.ZOOM_LEVELS[level];
        
        // 如果有鼠标位置，以鼠标位置为中心缩放
        if (mouseX !== undefined && mouseY !== undefined) {
            // 计算鼠标在世界中的位置
            const worldX = (mouseX - this.target.x) / oldZoom;
            const worldY = (mouseY - this.target.y) / oldZoom;
            
            // 应用新缩放
            this.zoomLevel = level;
            this.target.scale.set(newZoom);
            this.scale = newZoom;
            
            // 调整位置使鼠标仍在同一点
            this.target.x = mouseX - worldX * newZoom;
            this.target.y = mouseY - worldY * newZoom;
        } else {
            this.zoomLevel = level;
            this.target.scale.set(newZoom);
            this.scale = newZoom;
        }
        
        this.clamp();
    }
    
    reset() {
        this.setZoom('NORMAL');
        
        // 居中到角色起始位置 (100, 50) - 地图中心
        const centerX = 100 * TILE_SIZE;
        const centerY = 50 * TILE_SIZE;
        
        this.target.x = window.innerWidth / 2 - centerX;
        this.target.y = window.innerHeight / 2 - centerY;
    }
    
    clamp() {
        const canvasWidth = window.innerWidth;
        const canvasHeight = window.innerHeight;
        const worldWidth = MAP_WIDTH * TILE_SIZE * this.scale;
        const worldHeight = MAP_HEIGHT * TILE_SIZE * this.scale;
        
        if (worldWidth <= canvasWidth) {
            this.target.x = (canvasWidth - worldWidth) / 2;
        } else {
            this.target.x = Math.max(canvasWidth - worldWidth, Math.min(0, this.target.x));
        }
        
        if (worldHeight <= canvasHeight) {
            this.target.y = (canvasHeight - worldHeight) / 2;
        } else {
            this.target.y = Math.max(canvasHeight - worldHeight, Math.min(0, this.target.y));
        }
    }
    
    getZoomLevel(): string {
        return this.zoomLevel;
    }
}
