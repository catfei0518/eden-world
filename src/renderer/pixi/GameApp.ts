/**
 * PixiJS 游戏主应用
 */

import * as PIXI from 'pixi.js';
import { GameMap } from '../world/MapGenerator';
import { TileLayer } from './layers/TileLayer';
import { ItemLayer } from './layers/ItemLayer';
import { CharacterLayer } from './layers/CharacterLayer';
import { Camera } from './Camera';

export class GameApp {
    private app: PIXI.Application;
    private worldContainer: PIXI.Container;
    private camera: Camera;
    private tileLayer: TileLayer;
    private itemLayer: ItemLayer;
    private characterLayer: CharacterLayer;
    
    private map: GameMap;
    private viewportWidth: number;
    private viewportHeight: number;
    
    constructor(map: GameMap, width: number, height: number) {
        this.map = map;
        this.viewportWidth = width;
        this.viewportHeight = height;
        
        this.app = new PIXI.Application();
        this.worldContainer = new PIXI.Container();
        this.camera = new Camera(this.worldContainer);
        this.tileLayer = new TileLayer(map);
        this.itemLayer = new ItemLayer(map);
        this.characterLayer = new CharacterLayer(map);
    }
    
    async init(): Promise<void> {
        // PixiJS v8: 先创建，后init
        await this.app.init({
            width: this.viewportWidth,
            height: this.viewportHeight,
            backgroundColor: 0x1a1a2e,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        
        // 添加世界容器到舞台
        this.app.stage.addChild(this.worldContainer);
        
        // 添加各层
        this.worldContainer.addChild(this.tileLayer.getContainer());
        this.worldContainer.addChild(this.itemLayer.getContainer());
        this.worldContainer.addChild(this.characterLayer.getContainer());
        
        // 初始化各层
        await this.tileLayer.init();
        await this.itemLayer.init();
        this.characterLayer.init();
        
        // 设置相机
        const worldWidth = this.map.getSize().width * 64;
        const worldHeight = this.map.getSize().height * 64;
        
        // 设置相机世界和视口尺寸
        this.camera.setWorldSize(worldWidth, worldHeight);
        this.camera.setViewSize(this.viewportWidth, this.viewportHeight);
        
        // 初始缩放和居中
        this.camera.setZoom('NORMAL');
        
        // 调试信息
        console.log('WorldContainer位置:', this.worldContainer.x, this.worldContainer.y);
        console.log('WorldContainer缩放:', this.worldContainer.scale.x, this.worldContainer.scale.y);
        console.log('Stage子节点数:', this.app.stage.children.length);
        
        // PixiJS v8: 确保渲染器启动
        this.app.render();
    }
    
    getView(): HTMLCanvasElement {
        return this.app.canvas as HTMLCanvasElement;
    }
    
    getCamera(): Camera {
        return this.camera;
    }
    
    getCharacterLayer(): CharacterLayer {
        return this.characterLayer;
    }
    
    startTick(): void {
        this.app.ticker.add(() => {
            this.characterLayer.update();
        });
    }
    
    destroy(): void {
        this.app.destroy(true);
    }
}
