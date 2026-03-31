/**
 * 相机控制器 - 3档缩放 + 移动端支持
 * 
 * 支持:
 * - 鼠标拖动
 * - 鼠标滚轮缩放
 * - 单指拖动 (移动端)
 * - 双指缩放 (移动端)
 * - 双击/双指tap重置
 */

import * as PIXI from 'pixi.js';

const MAP_WIDTH = 300;
const MAP_HEIGHT = 150;
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
    
    // ===== 鼠标拖动 =====
    private isDragging: boolean = false;
    private lastX: number = 0;
    private lastY: number = 0;
    
    // ===== 移动端触摸 =====
    private isTouchDragging: boolean = false;
    private isPinching: boolean = false;
    private lastTouchX: number = 0;
    private lastTouchY: number = 0;
    private lastPinchDistance: number = 0;
    private lastPinchCenterX: number = 0;
    private lastPinchCenterY: number = 0;
    
    // ===== 缩放限制 =====
    private readonly MIN_ZOOM: number = 0.15;
    private readonly MAX_ZOOM: number = 6;
    
    constructor(target: PIXI.Container, canvas: HTMLCanvasElement) {
        this.target = target;
        this.setupControls(canvas);
        
        // 标记为全局可访问（供外部补丁使用）
        (window as any).camera = this;
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
        
        // ===== 移动端触摸事件 =====
        this.setupTouchControls(canvas);
    }
    
    /**
     * 移动端触摸控制
     */
    setupTouchControls(canvas: HTMLCanvasElement) {
        // 阻止默认触摸行为
        canvas.style.touchAction = 'none';
        
        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            e.preventDefault();
            
            if (e.touches.length === 1) {
                // 单指触摸 - 开始拖动
                this.isTouchDragging = true;
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
                
            } else if (e.touches.length === 2) {
                // 双指触摸 - 开始缩放
                this.isTouchDragging = false;
                this.isPinching = true;
                
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
                this.lastPinchCenterX = (touch1.clientX + touch2.clientX) / 2;
                this.lastPinchCenterY = (touch1.clientY + touch2.clientY) / 2;
            }
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            e.preventDefault();
            
            if (e.touches.length === 1 && this.isTouchDragging) {
                // 单指拖动地图
                const touch = e.touches[0];
                const dx = touch.clientX - this.lastTouchX;
                const dy = touch.clientY - this.lastTouchY;
                
                this.target.x += dx;
                this.target.y += dy;
                
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
                
                this.clamp();
                
            } else if (e.touches.length === 2 && this.isPinching) {
                // 双指缩放
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
                const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
                
                // 计算缩放比例
                const scaleChange = currentDistance / this.lastPinchDistance;
                const newScale = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.scale * scaleChange));
                
                // 以双指中心点为基准缩放
                if (newScale !== this.scale) {
                    const worldX = (currentCenterX - this.target.x) / this.scale;
                    const worldY = (currentCenterY - this.target.y) / this.scale;
                    
                    this.target.scale.set(newScale);
                    this.scale = newScale;
                    
                    this.target.x = currentCenterX - worldX * newScale;
                    this.target.y = currentCenterY - worldY * newScale;
                    
                    this.clamp();
                }
                
                this.lastPinchDistance = currentDistance;
                this.lastPinchCenterX = currentCenterX;
                this.lastPinchCenterY = currentCenterY;
            }
        }, { passive: false });
        
        canvas.addEventListener('touchend', (e: TouchEvent) => {
            e.preventDefault();
            
            if (e.touches.length === 0) {
                this.isTouchDragging = false;
                this.isPinching = false;
            } else if (e.touches.length === 1) {
                // 从双指切换到单指
                this.isPinching = false;
                this.isTouchDragging = true;
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
            }
        }, { passive: false });
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
