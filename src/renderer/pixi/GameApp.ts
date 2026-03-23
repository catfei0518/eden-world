/**
 * PixiJS 游戏主应用
 */

import * as PIXI from 'pixi.js';
import { GameMap } from '../../world/MapGenerator';
import { TileLayer } from './layers/TileLayer';
import { ItemLayer } from './layers/ItemLayer';
import { CharacterLayer } from './layers/CharacterLayer';
import { Camera } from './Camera';
import { StatusUI } from '../StatusUI';
import { ItemStatusUI } from '../ItemStatusUI';
import { ConsoleUI } from '../ConsoleUI';
import { commandSystem } from '../../systems/CommandSystem';
import { LLMController } from '../../systems/LLMController';

export class GameApp {
    private app: PIXI.Application;
    private worldContainer: PIXI.Container;
    private camera: Camera;
    private tileLayer: TileLayer;
    private itemLayer: ItemLayer;
    private characterLayer: CharacterLayer;
    private statusUI: StatusUI;
    private itemStatusUI: ItemStatusUI;
    private consoleUI: ConsoleUI;
    
    private map: GameMap;
    private viewportWidth: number;
    private viewportHeight: number;
    
    // 当前季节
    private currentSeason: string = 'summer';
    private llmController: LLMController;
    
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
        this.statusUI = new StatusUI();
        this.itemStatusUI = new ItemStatusUI();
        this.consoleUI = new ConsoleUI();
        this.llmController = new LLMController();
        
        // 设置控制台命令回调
        this.setupConsoleCommands();
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
        await this.characterLayer.init();
        
        // 启用LLM控制亚当和夏娃
        const characters = this.characterLayer.getCharacters();
        if (characters.length >= 2) {
            this.llmController.addCharacter(characters[0]);  // 亚当
            this.llmController.addCharacter(characters[1]);  // 夏娃
            console.log('🤖 LLM控制器已启用，亚当和夏娃将由Ollama控制');
        }
        
        // 设置角色点击回调
        this.characterLayer.onCharacterClick = (char) => {
            this.statusUI.showCharacter(char);
        };
        
        // 设置物品点击回调
        this.itemLayer.onItemClick = (item) => {
            this.itemStatusUI.showItem(item);
        };
        
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
        // LLM更新计数器
        let llmUpdateCounter = 0;
        
        this.app.ticker.add((ticker) => {
            this.characterLayer.update(ticker.deltaTime);
            this.statusUI.updateCharacters(this.characterLayer.getCharacters());
            
            // 每60帧（约1秒）更新一次LLM
            llmUpdateCounter++;
            if (llmUpdateCounter >= 60) {
                llmUpdateCounter = 0;
                // 获取世界状态并更新LLM
                const world = (this.characterLayer as any).getWorldState?.();
                if (world) {
                    this.llmController.update(world);
                }
            }
        });
    }
    
    // 设置控制台命令处理
    private setupConsoleCommands(): void {
        // 季节切换
        window.addEventListener('console-season', ((e: CustomEvent) => {
            const season = e.detail as string;
            this.currentSeason = season;
            this.tileLayer.setSeason(season as any);
            this.itemLayer.setSeason(season as any);
            // 季节切换的消息由CommandSystem输出
        }) as EventListener);
        
        // 角色信息 - 通过事件触发后，由commandSystem的print输出
        window.addEventListener('console-char', ((e: CustomEvent) => {
            const args = e.detail as string[];
            const chars = this.characterLayer.getCharacters();
            const seasonNames: Record<string, string> = { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' };
            
            if (args[0]) {
                const char = chars.find(c => c.name === args[0]);
                if (char) {
                    const charAny = char as any;
                    commandSystem.print(`📊 ${char.name}:`);
                    commandSystem.print(`   位置: (${char.x.toFixed(1)}, ${char.y.toFixed(1)})`);
                    commandSystem.print(`   饥饿: ${charAny.hungerPercent}%`);
                    commandSystem.print(`   水: ${charAny.thirstPercent}%`);
                    commandSystem.print(`   精力: ${(char.energy/5*100).toFixed(0)}%`);
                    commandSystem.print(`   行动: ${char.action}`);
                    commandSystem.print(`   季节: ${seasonNames[this.currentSeason] || this.currentSeason}`);
                } else {
                    commandSystem.print(`未找到角色: ${args[0]}`);
                }
            } else {
                commandSystem.print(`📊 角色数量: ${chars.length}`);
                for (const char of chars) {
                    commandSystem.print(`   ${char.name}: (${char.x.toFixed(1)}, ${char.y.toFixed(1)}) - ${char.action}`);
                }
            }
        }) as EventListener);
        
        // 天数
        window.addEventListener('console-day', () => {
            commandSystem.print(`📅 当前季节: ${this.currentSeason}`);
            commandSystem.print(`⏰ 时间系统尚未实现`);
        });
        
        // 游戏信息
        window.addEventListener('console-info', () => {
            commandSystem.print(`🌍 伊甸世界 v0.11.0-alpha`);
            commandSystem.print(`📦 物品数量: ${this.itemLayer.getItems().length}`);
            commandSystem.print(`👥 角色数量: ${this.characterLayer.getCharacters().length}`);
            commandSystem.print(`🌿 当前季节: ${this.currentSeason}`);
        });
    }
    
    destroy(): void {
        this.app.destroy(true);
    }
}
