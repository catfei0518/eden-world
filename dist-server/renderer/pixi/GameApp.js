"use strict";
/**
 * PixiJS 游戏主应用
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameApp = void 0;
const PIXI = __importStar(require("pixi.js"));
const TileLayer_1 = require("./layers/TileLayer");
const ItemLayer_1 = require("./layers/ItemLayer");
const CharacterLayer_1 = require("./layers/CharacterLayer");
const Camera_1 = require("./Camera");
const StatusUI_1 = require("../StatusUI");
const ItemStatusUI_1 = require("../ItemStatusUI");
const ConsoleUI_1 = require("../ConsoleUI");
const CommandSystem_1 = require("../../systems/CommandSystem");
const LLMController_1 = require("../../systems/LLMController");
class GameApp {
    constructor(map, width, height) {
        // 当前季节
        this.currentSeason = 'summer';
        this.map = map;
        this.viewportWidth = width;
        this.viewportHeight = height;
        this.app = new PIXI.Application();
        this.worldContainer = new PIXI.Container();
        this.camera = new Camera_1.Camera(this.worldContainer);
        this.tileLayer = new TileLayer_1.TileLayer(map);
        this.itemLayer = new ItemLayer_1.ItemLayer(map);
        this.characterLayer = new CharacterLayer_1.CharacterLayer(map);
        this.statusUI = new StatusUI_1.StatusUI();
        this.itemStatusUI = new ItemStatusUI_1.ItemStatusUI();
        this.consoleUI = new ConsoleUI_1.ConsoleUI();
        this.llmController = new LLMController_1.LLMController();
        // 设置控制台命令回调
        this.setupConsoleCommands();
    }
    async init() {
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
            this.llmController.addCharacter(characters[0]); // 亚当
            this.llmController.addCharacter(characters[1]); // 夏娃
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
    getView() {
        return this.app.canvas;
    }
    getCamera() {
        return this.camera;
    }
    getCharacterLayer() {
        return this.characterLayer;
    }
    startTick() {
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
                const world = this.characterLayer.getWorldState?.();
                if (world) {
                    this.llmController.update(world);
                }
            }
        });
    }
    // 设置控制台命令处理
    setupConsoleCommands() {
        // 季节切换
        window.addEventListener('console-season', ((e) => {
            const season = e.detail;
            this.currentSeason = season;
            this.tileLayer.setSeason(season);
            this.itemLayer.setSeason(season);
            // 季节切换的消息由CommandSystem输出
        }));
        // 角色信息 - 通过事件触发后，由commandSystem的print输出
        window.addEventListener('console-char', ((e) => {
            const args = e.detail;
            const chars = this.characterLayer.getCharacters();
            const seasonNames = { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' };
            if (args[0]) {
                const char = chars.find(c => c.name === args[0]);
                if (char) {
                    const charAny = char;
                    CommandSystem_1.commandSystem.print(`📊 ${char.name}:`);
                    CommandSystem_1.commandSystem.print(`   位置: (${char.x.toFixed(1)}, ${char.y.toFixed(1)})`);
                    CommandSystem_1.commandSystem.print(`   饥饿: ${charAny.hungerPercent}%`);
                    CommandSystem_1.commandSystem.print(`   水: ${charAny.thirstPercent}%`);
                    CommandSystem_1.commandSystem.print(`   精力: ${(char.energy / 5 * 100).toFixed(0)}%`);
                    CommandSystem_1.commandSystem.print(`   行动: ${char.action}`);
                    CommandSystem_1.commandSystem.print(`   季节: ${seasonNames[this.currentSeason] || this.currentSeason}`);
                }
                else {
                    CommandSystem_1.commandSystem.print(`未找到角色: ${args[0]}`);
                }
            }
            else {
                CommandSystem_1.commandSystem.print(`📊 角色数量: ${chars.length}`);
                for (const char of chars) {
                    CommandSystem_1.commandSystem.print(`   ${char.name}: (${char.x.toFixed(1)}, ${char.y.toFixed(1)}) - ${char.action}`);
                }
            }
        }));
        // 天数
        window.addEventListener('console-day', () => {
            CommandSystem_1.commandSystem.print(`📅 当前季节: ${this.currentSeason}`);
            CommandSystem_1.commandSystem.print(`⏰ 时间系统尚未实现`);
        });
        // 游戏信息
        window.addEventListener('console-info', () => {
            CommandSystem_1.commandSystem.print(`🌍 伊甸世界 v0.11.0-alpha`);
            CommandSystem_1.commandSystem.print(`📦 物品数量: ${this.itemLayer.getItems().length}`);
            CommandSystem_1.commandSystem.print(`👥 角色数量: ${this.characterLayer.getCharacters().length}`);
            CommandSystem_1.commandSystem.print(`🌿 当前季节: ${this.currentSeason}`);
        });
    }
    destroy() {
        this.app.destroy(true);
    }
}
exports.GameApp = GameApp;
