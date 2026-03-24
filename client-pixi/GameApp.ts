/**
 * 伊甸世界 - 在线版客户端
 * 参考单机版渲染 + WebSocket同步
 */

import * as PIXI from 'pixi.js';
import { EdenServerClient } from './EdenServerClient';
import { Camera } from './Camera';
import { commandSystem } from './CommandSystem';

const MAP_WIDTH = 200;
const HITBOX_SIZE = 48; // 点击热区大小
const MAP_HEIGHT = 100;
const TILE_SIZE = 64;
const SCALE = 1.35;
const SCALED_SIZE = TILE_SIZE * SCALE;
const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;

interface ServerCharacter {
    id: string;
    name: string;
    x: number;
    y: number;
    hunger: number;
    thirst: number;
    energy: number;
    action: string;
}

export class GameApp {
    private app!: PIXI.Application;
    private worldContainer!: PIXI.Container;
    private camera!: Camera;
    private server!: EdenServerClient;
    
    private currentSeason: string = 'summer';
    private textures: Map<string, PIXI.Texture> = new Map();
    private characterSprites: Map<string, any> = new Map();
    private terrainSprites: Map<string, PIXI.Sprite> = new Map();
    private groundObjects: PIXI.Sprite[] = [];
    
    // 角色状态面板
    private statusPanel!: HTMLElement;
    private selectedCharacter: ServerCharacter | null = null;
    
    async init() {
        console.log('🌍 伊甸世界在线版启动...');
        
        const container = document.getElementById('game-container')!;
        const oldCanvas = container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();
        
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);
        
        this.app = new PIXI.Application();
        await this.app.init({
            canvas: canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x1a1a2e,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        
        this.worldContainer = new PIXI.Container();
        this.worldContainer.sortableChildren = true;
        this.app.stage.addChild(this.worldContainer);
        
        this.camera = new Camera(this.worldContainer, canvas);
        
        await this.loadTextures();
        this.setupServer();
        this.setupKeyboard();
        this.setupConsole();
        this.setupStatusPanel();
        
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.camera.clamp();
        });
        
        console.log('✅ 初始化完成');
    }
    
    private async loadTextures() {
        console.log('📦 加载纹理...');
        
        const sources: Record<string, string> = {
            'grass': '/img/64x64像素草地春夏.png',
            'plain': '/img/64x64像素草平原.png',
            'forest': '/img/64x64像素森林春夏.png',
            'forest_autumn': '/img/64x64像素森林秋.png',
            'forest_winter': '/img/64x64像素森林冬.png',
            'desert': '/img/64x64像素沙漠.png',
            'ocean': '/img/海洋.png',
            'beach': '/img/沙滩.png',
            'river': '/img/河流.png',
            'lake': '/img/湖泊春夏秋.png',
            'swamp': '/img/沼泽.png',
            'mountain': '/img/山地.png',
            'hill': '/img/山丘.png',
            'adam': '/img/亚当.png',
            'eve': '/img/夏娃.png',
            'berry': '/img/灌木果.png',
            'bush': '/img/灌木.png',
            'bush_flower': '/img/灌木花.png',
            'water': '/img/河流.png',
            'well': '/img/井.png',
            // 地面物品
            'tree': '/img/树.png',
            'stone': '/img/石头.png',
        };
        
        for (const [key, path] of Object.entries(sources)) {
            try {
                const tex = await PIXI.Assets.load(path);
                this.textures.set(key, tex);
                console.log(`✅ ${key}`);
            } catch (e) {
                console.error(`❌ ${key}: ${path}`);
            }
        }
    }
    
    private setupServer() {
        this.server = new EdenServerClient();
        
        this.server.on('connect', () => {
            commandSystem.print('✅ 已连接到服务器');
        });
        
        this.server.on('disconnect', () => {
            commandSystem.print('❌ 断开连接');
        });
        
        this.server.on('init', (state) => {
            console.log('📊 收到初始状态');
            this.syncState(state);
            // 相机跟随第一个角色
            if (state.characters && state.characters.length > 0) {
                this.cameraFollow(state.characters[0]);
            }
        });
        
        this.server.on('state', (state) => {
            this.syncState(state);
            // 相机跟随第一个角色
            if (state.characters && state.characters.length > 0) {
                this.cameraFollow(state.characters[0]);
            }
        });
        
        this.server.connect();
    }
    
    private syncState(state: any) {
        if (!state) return;
        if (state.world?.season) {
            this.currentSeason = state.world.season;
        }
        if (state.characters) {
            for (const char of state.characters) {
                this.renderCharacter(char);
            }
        }
    }
    
    private renderTerrain() {
        const terrainTextures: Record<string, Record<string, string>> = {
            spring: { grass: 'grass', plain: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            summer: { grass: 'grass', plain: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            autumn: { grass: 'grass', plain: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            winter: { grass: 'grass', plain: 'plain', forest: 'forest_winter', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' }
        };
        
        const terrainMap = terrainTextures[this.currentSeason] || terrainTextures.summer;
        const terrainCount: Record<string, number> = {};
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const key = `${x},${y}`;
                if (this.terrainSprites.has(key)) continue;
                
                const terrainType = this.getTerrainType(x, y);
                terrainCount[terrainType] = (terrainCount[terrainType] || 0) + 1;
                
                const texKey = terrainMap[terrainType] || 'grass';
                const texture = this.textures.get(texKey);
                if (!texture) continue;
                
                const sprite = new PIXI.Sprite(texture);
                sprite.x = x * TILE_SIZE - OFFSET;
                sprite.y = y * TILE_SIZE - OFFSET;
                sprite.width = SCALED_SIZE;
                sprite.height = SCALED_SIZE;
                sprite.zIndex = 0;
                this.worldContainer.addChildAt(sprite, 0);
                this.terrainSprites.set(key, sprite);
            }
        }
        console.log('🗺️ 地形统计:', terrainCount);
        
        // 渲染地面物品（树、灌木、石头）
        this.renderGroundObjects();
    }
    
    private renderGroundObjects() {
        // 树、灌木、石头根据地形类型生成
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const terrainType = this.getTerrainType(x, y);
                
                // 森林地形生成树
                if (terrainType === 'forest' && Math.random() < 0.15) {
                    this.addGroundObject(x, y, 'tree');
                }
                // 草地生成灌木
                else if (terrainType === 'grass' && Math.random() < 0.05) {
                    this.addGroundObject(x, y, 'bush');
                }
                // 山地生成石头
                else if (terrainType === 'mountain' && Math.random() < 0.1) {
                    this.addGroundObject(x, y, 'stone');
                }
                // 丘陵生成石头
                else if (terrainType === 'hill' && Math.random() < 0.05) {
                    this.addGroundObject(x, y, 'stone');
                }
            }
        }
    }
    
    private addGroundObject(x: number, y: number, type: string) {
        const tex = this.textures.get(type);
        if (!tex) return;
        
        const sprite = new PIXI.Sprite(tex);
        // 与单机版一致：ground=40, low=48, high=64
        const size = type === 'tree' ? 48 : 40;
        sprite.x = x * TILE_SIZE + TILE_SIZE / 2;
        sprite.y = y * TILE_SIZE + TILE_SIZE / 2;
        sprite.width = size;
        sprite.height = size;
        sprite.anchor.set(0.5);
        sprite.zIndex = 2; // 在地形上面，角色下面
        this.worldContainer.addChild(sprite);
        this.groundObjects.push(sprite);
    }
    
    private getTerrainType(x: number, y: number): string {
        const noise2D = (x: number, y: number) => {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);
            const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
            const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
            const n00 = Math.sin(X * 1.5 + Y * 0.7 + xf * 1.3 + yf * 2.1) * 0.5 + 0.5;
            const n01 = Math.sin(X * 1.5 + (Y+1) * 0.7 + xf * 1.3 + yf * 2.1) * 0.5 + 0.5;
            const n10 = Math.sin((X+1) * 1.5 + Y * 0.7 + xf * 1.3 + yf * 2.1) * 0.5 + 0.5;
            const n11 = Math.sin((X+1) * 1.5 + (Y+1) * 0.7 + xf * 1.3 + yf * 2.1) * 0.5 + 0.5;
            return n00 + (n01 - n00) * v + (n10 - n00) * u + (n00 - n01 - n10 + n11) * u * v;
        };
        
        const fbm = (x: number, y: number, octaves: number, freq: number, persist: number) => {
            let value = 0, amp = 1, maxVal = 0;
            for (let i = 0; i < octaves; i++) {
                value += amp * noise2D(x * freq, y * freq);
                maxVal += amp;
                amp *= persist;
                freq *= 2;
            }
            return (value / maxVal + 1) / 2;
        };
        
        const baseNoise = fbm(x * 0.04, y * 0.04, 4, 1, 0.5);
        const detailNoise = fbm(x * 0.1, y * 0.1, 2, 1, 0.5);
        const height = baseNoise * 0.7 + detailNoise * 0.3;
        const moisture = fbm(x * 0.03 + 500, y * 0.03, 3, 1, 0.5);
        const temperature = fbm(x * 0.02 + 1000, y * 0.02, 2, 1, 0.5);
        
        const maxOceanDepth = 2;
        const edgeNoise = fbm(x * 0.2, y * 0.2, 2, 2, 0.5);
        const oceanLimit = maxOceanDepth + edgeNoise * 1.5;
        
        const leftOcean = x < oceanLimit;
        const bottomOcean = y > 99 - oceanLimit;
        
        if (leftOcean || bottomOcean) return 'ocean';
        if (x < oceanLimit + 1 || y > 99 - oceanLimit - 1) {
            if (!leftOcean && !bottomOcean) return 'beach';
        }
        
        if (this.isLakeArea(x, y)) return 'lake';
        if (this.isRiverTile(x, y)) return 'river';
        if (height > 0.9) return 'mountain';
        if (height > 0.82) return 'hill';
        if (temperature > 0.75 && moisture < 0.3) return 'desert';
        if (moisture > 0.6 && temperature > 0.25 && temperature < 0.7) return 'forest';
        if (height < 0.62 && moisture > 0.65) return 'swamp';
        if (moisture > 0.4) return 'grass';
        return 'plain';
    }
    
    private isLakeArea(x: number, y: number): boolean {
        const lakes = [
            { cx: 60, cy: 40, r: 12 },
            { cx: 120, cy: 50, r: 10 },
            { cx: 90, cy: 70, r: 14 },
            { cx: 150, cy: 35, r: 8 },
        ];
        
        for (const lake of lakes) {
            const dist = Math.sqrt(Math.pow(x - lake.cx, 2) + Math.pow(y - lake.cy, 2));
            if (dist < lake.r) {
                const edgeNoise = Math.sin(x * 0.5) * Math.cos(y * 0.3) * 2;
                if (dist < lake.r + edgeNoise) return true;
            }
        }
        return false;
    }
    
    private isRiverTile(x: number, y: number): boolean {
        if (y < 20 || y > 90) return false;
        const noise = (a: number) => Math.sin(a * 0.5) * 0.5 + Math.sin(a * 0.3) * 0.3 + Math.sin(a * 0.7) * 0.2;
        const riverCenter = 100 + noise(y * 0.3) * 15;
        const riverWidth = 3 + Math.sin(y * 0.2) * 1;
        return Math.abs(x - riverCenter) < riverWidth;
    }
    
    private cameraFollow(char: ServerCharacter) {
        if (char.x === null || char.y === null) return;
        
        const scale = this.camera.scale;
        // 居中到角色位置
        this.camera.target.x = window.innerWidth / 2 - (char.x * TILE_SIZE + TILE_SIZE / 2) * scale;
        this.camera.target.y = window.innerHeight / 2 - (char.y * TILE_SIZE + TILE_SIZE / 2) * scale;
    }
    
    private renderCharacter(data: ServerCharacter) {
        let sprite = this.characterSprites.get(data.id);
        
        if (!sprite) {
            sprite = this.createCharacterSprite(data);
            this.worldContainer.addChild(sprite);
            this.characterSprites.set(data.id, sprite);
            if (this.terrainSprites.size === 0) {
                this.renderTerrain();
            }
        }
        
        if (data.x !== null && data.y !== null) {
            sprite.x = data.x * TILE_SIZE + TILE_SIZE / 2;
            sprite.y = data.y * TILE_SIZE + TILE_SIZE / 2;
        }
        sprite.zIndex = 10;
        // 与单机版一致：显示 "角色名: 动作"
        sprite.label.text = `${data.name}: ${data.action || '闲置'}`;
    }
    
    private createCharacterSprite(data: ServerCharacter) {
        const container = new PIXI.Container();
        container.eventMode = 'static';
        container.cursor = 'pointer';
        
        const texKey = data.id === 'adam' ? 'adam' : 'eve';
        const tex = this.textures.get(texKey);
        
        if (tex) {
            const sprite = new PIXI.Sprite(tex);
            sprite.anchor.set(0.5);
            // 按比例缩放，高度32像素
            const scale = 32 / tex.height;
            sprite.width = tex.width * scale;
            sprite.height = 32;
            container.addChild(sprite);
        } else {
            const body = new PIXI.Graphics();
            body.circle(0, 0, 16);
            body.fill(data.id === 'adam' ? 0x4169E1 : 0xFF69B4);
            body.stroke({ width: 2, color: 0x333333 });
            container.addChild(body);
        }
        
        // 角色名称 - 与单机版一致 "角色名: 动作"，带描边更清晰
        const label = new PIXI.Text({
            text: `${data.name}: ${data.action || '闲置'}`,
            style: {
                fontSize: 12,
                fontWeight: 'bold',
                fill: 0xffffff,
                fontFamily: 'Arial, sans-serif',
                stroke: { color: 0x000000, width: 3 },
            }
        });
        label.y = -36;
        label.anchor.set(0.5, 0);
        label.resolution = 2; // 更高清晰度
        container.addChild(label);
        (container as any).label = label;
        
        // 无饥饿/口渴条 - 与单机版一致
        (container as any).hungerBar = null;
        (container as any).thirstBar = null;
        
        // 点击区域 - 透明热区
        const hitbox = new PIXI.Graphics();
        hitbox.beginFill(0xffffff, 0.001);
        hitbox.drawRect(-HITBOX_SIZE / 2, -HITBOX_SIZE / 2, HITBOX_SIZE, HITBOX_SIZE);
        hitbox.endFill();
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';
        
        // 点击事件
        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            this.showCharacterStatus(data);
        });
        
        container.addChild(hitbox);
        (container as any).hitbox = hitbox;
        
        return container;
    }
    
    private setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const step = 5;
            
            switch (key) {
                case 'w': case 'arrowup':
                    this.camera.target.y += step * 20;
                    break;
                case 's': case 'arrowdown':
                    this.camera.target.y -= step * 20;
                    break;
                case 'a': case 'arrowleft':
                    this.camera.target.x += step * 20;
                    break;
                case 'd': case 'arrowright':
                    this.camera.target.x -= step * 20;
                    break;
                case '1':
                    // 以屏幕中心为基准缩放
                    this.camera.setZoom('FAR', window.innerWidth / 2, window.innerHeight / 2);
                    break;
                case '2':
                    this.camera.setZoom('NORMAL', window.innerWidth / 2, window.innerHeight / 2);
                    break;
                case '3':
                    this.camera.setZoom('CLOSE', window.innerWidth / 2, window.innerHeight / 2);
                    break;
            }
            this.camera.clamp();
        });
    }
    
    private setupConsole() {
        window.addEventListener('console-season', ((e: CustomEvent) => {
            const season = e.detail as string;
            this.currentSeason = season;
            this.server.send({ type: 'season', season });
            commandSystem.print(`🌿 季节切换为: ${season}`);
            this.terrainSprites.forEach(s => s.destroy());
            this.terrainSprites.clear();
            this.renderTerrain();
        }) as EventListener);
        
        window.addEventListener('console-info', () => {
            commandSystem.print(`🌍 伊甸世界 v0.12.0-alpha (在线版)`);
            commandSystem.print(`👥 角色: ${this.characterSprites.size}`);
            commandSystem.print(`🌿 季节: ${this.currentSeason}`);
        });
    }
    
    private setupStatusPanel() {
        this.statusPanel = document.getElementById('status-panel')!;
        if (!this.statusPanel) {
            console.warn('⚠️ status-panel 元素未找到');
            return;
        }
        
        // 点击空白处关闭
        document.addEventListener('pointerdown', (e) => {
            const target = e.target as HTMLElement;
            if (this.statusPanel.contains(target)) return;
            if (this.selectedCharacter) {
                this.hideStatusPanel();
            }
        });
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedCharacter) {
                this.hideStatusPanel();
            }
        });
    }
    
    private showCharacterStatus(char: ServerCharacter) {
        if (!this.statusPanel) return;
        
        this.selectedCharacter = char;
        
        // 更新面板内容
        const nameElem = document.getElementById('panel-name');
        const typeElem = document.getElementById('panel-type');
        const avatarElem = document.getElementById('panel-avatar');
        const posElem = document.getElementById('panel-position');
        const foodBar = document.getElementById('panel-food-bar');
        const waterBar = document.getElementById('panel-water-bar');
        const energyBar = document.getElementById('panel-energy-bar');
        const foodVal = document.getElementById('panel-food-val');
        const waterVal = document.getElementById('panel-water-val');
        const energyVal = document.getElementById('panel-energy-val');
        const healthBar = document.getElementById('panel-health-bar');
        const healthVal = document.getElementById('panel-health-val');
        const actionElem = document.getElementById('panel-action');
        const dnaContainer = document.getElementById('panel-dna-attrs');
        
        if (nameElem) nameElem.textContent = char.name;
        if (typeElem) typeElem.textContent = char.id === 'adam' ? '亚当' : '夏娃';
        if (avatarElem) {
            avatarElem.className = `avatar ${char.id === 'adam' ? 'adam' : 'eve'}`;
            avatarElem.textContent = char.id === 'adam' ? '♂' : '♀';
        }
        if (posElem) posElem.textContent = `(${char.x.toFixed(1)}, ${char.y.toFixed(1)})`;
        
        const hungerPct = Math.min(100, Math.round(char.hunger));
        const thirstPct = Math.min(100, Math.round(char.thirst));
        const energyPct = Math.round((char.energy / 5) * 100);
        
        if (foodBar) foodBar.style.width = `${hungerPct}%`;
        if (waterBar) waterBar.style.width = `${thirstPct}%`;
        if (energyBar) energyBar.style.width = `${energyPct}%`;
        if (foodVal) foodVal.textContent = `${hungerPct}%`;
        if (waterVal) waterVal.textContent = `${thirstPct}%`;
        if (energyVal) energyVal.textContent = `${energyPct}%`;
        
        if (healthBar) healthBar.style.width = '100%';
        if (healthVal) healthVal.textContent = '100%';
        
        if (actionElem) actionElem.textContent = char.action || '闲置';
        
        // DNA属性（在线版本显示基本信息）
        if (dnaContainer) {
            dnaContainer.innerHTML = `
                <div class="dna-row" style="background: rgba(74, 169, 74, 0.3); font-weight: bold;">
                    <span>🎭 角色</span><span>${char.id === 'adam' ? '亚当' : '夏娃'}</span>
                </div>
                <div class="dna-row" style="background: rgba(74, 169, 74, 0.2);">
                    <span>🌿 状态</span><span>在线同步</span>
                </div>
                <div class="dna-row">
                    <span>🍖 饥饿</span><span>${hungerPct}%</span>
                </div>
                <div class="dna-row">
                    <span>💧 口渴</span><span>${thirstPct}%</span>
                </div>
                <div class="dna-row">
                    <span>⚡ 精力</span><span>${energyPct}%</span>
                </div>
                <div class="dna-row">
                    <span>❤️ 生命</span><span>100%</span>
                </div>
            `;
        }
        
        // 显示面板
        this.statusPanel.style.display = 'block';
    }
    
    private hideStatusPanel() {
        this.selectedCharacter = null;
        if (this.statusPanel) {
            this.statusPanel.style.display = 'none';
        }
    }
}

let initialized = false;

document.addEventListener('DOMContentLoaded', async () => {
    if (initialized) return;
    initialized = true;
    console.log('🚀 启动伊甸世界在线版...');
    await new GameApp().init();
});
