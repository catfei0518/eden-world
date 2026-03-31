"use strict";
/**
 * 相机控制器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Camera = void 0;
class Camera {
    constructor(container) {
        this.zoomLevel = 'NORMAL';
        this.ZOOM_LEVELS = {
            'FAR': 0.25,
            'NORMAL': 1.0,
            'CLOSE': 4.0
        };
        this.worldWidth = 0;
        this.worldHeight = 0;
        this.viewWidth = 0;
        this.viewHeight = 0;
        this.container = container;
    }
    setWorldSize(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }
    setViewSize(viewWidth, viewHeight) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
    }
    setZoom(level) {
        this.zoomLevel = level;
        const zoom = this.ZOOM_LEVELS[level];
        this.container.scale.set(zoom);
        // 缩放后重新居中
        this.recenter();
    }
    recenter() {
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
    getZoom() {
        return this.ZOOM_LEVELS[this.zoomLevel];
    }
    getZoomLevel() {
        return this.zoomLevel;
    }
    pan(dx, dy) {
        this.container.x += dx;
        this.container.y += dy;
    }
    setPosition(x, y) {
        this.container.x = x;
        this.container.y = y;
    }
    getPosition() {
        return {
            x: this.container.x,
            y: this.container.y
        };
    }
    setCenter() {
        this.recenter();
    }
    zoomIn(worldX, worldY, viewX, viewY) {
        let newLevel = 'NORMAL';
        if (this.zoomLevel === 'FAR') {
            newLevel = 'NORMAL';
        }
        else if (this.zoomLevel === 'NORMAL') {
            newLevel = 'CLOSE';
        }
        if (worldX !== undefined && worldY !== undefined && viewX !== undefined && viewY !== undefined) {
            this.zoomToPoint(newLevel, worldX, worldY, viewX, viewY);
        }
        else {
            this.setZoom(newLevel);
        }
    }
    zoomOut(worldX, worldY, viewX, viewY) {
        let newLevel = 'NORMAL';
        if (this.zoomLevel === 'CLOSE') {
            newLevel = 'NORMAL';
        }
        else if (this.zoomLevel === 'NORMAL') {
            newLevel = 'FAR';
        }
        if (worldX !== undefined && worldY !== undefined && viewX !== undefined && viewY !== undefined) {
            this.zoomToPoint(newLevel, worldX, worldY, viewX, viewY);
        }
        else {
            this.setZoom(newLevel);
        }
    }
    zoomToPoint(level, worldX, worldY, viewX, viewY) {
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
exports.Camera = Camera;
