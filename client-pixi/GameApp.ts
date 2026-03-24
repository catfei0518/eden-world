/**
 * 伊甸世界 - 在线版客户端
 * 参考单机版渲染 + WebSocket同步
 */

import * as PIXI from 'pixi.js';
import { EdenServerClient } from './EdenServerClient';
import { Camera } from '../shared/pixi-layers/Camera';
import { commandSystem } from './CommandSystem';
import { ItemStatusUI } from '../shared/ui/ItemStatusUI';
import type { ItemData } from '../shared/ui/ItemStatusUI';
import { latencyComp, seededRandom } from './LatencyCompensation';

const MAP_WIDTH = 200;
const HITBOX_SIZE = 48; // 角色点击热区大小
const ITEM_HITBOX_SIZE = 40; // 物品点击热区大小
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
    dna?: {
        bravery: number;
        aggression: number;
        curiosity: number;
        metabolism: number;
        strength: number;
        constitution: number;
        intelligence: number;
        lifespan: number;
    };
}

export class GameApp {
    private app!: PIXI.Application;
    private worldContainer!: PIXI.Container;
    private camera!: Camera;
    private server!: EdenServerClient;
    
    private currentSeason: string = 'summer';
    private textures: Map<string, PIXI.Texture> = new Map();
    private worldSeed: number = 0;  // Latency Compensation: 世界种子
    private groundObjectsRendered: boolean = false;  // 物品是否已从服务器渲染
    private serverTiles: any[][] = [];  // 服务器下发的地形数据
    private selectedCharacterId: string = 'adam';  // 当前选中的角色
    private characterSprites: Map<string, any> = new Map();
    private terrainSprites: Map<string, PIXI.Sprite> = new Map();
    private groundObjects: PIXI.Sprite[] = [];
    
    // 角色状态面板
    private statusPanel!: HTMLElement;
    private selectedCharacter: ServerCharacter | null = null;
    
    // 物品状态面板
    private itemStatusUI!: ItemStatusUI;
    private itemSprites: Map<string, any> = new Map();
    
    // 清除所有精灵（用于重连时）
    private clearAllSprites(): void {
        // 清除地形
        this.terrainSprites.forEach(sprite => sprite.destroy());
        this.terrainSprites.clear();
        
        // 清除物品
        this.groundObjects.forEach(sprite => sprite.destroy());
        this.groundObjects = [];
        
        // 清除角色
        this.characterSprites.forEach(sprite => sprite.destroy());
        this.characterSprites.clear();
        
        // 重置标记
        this.groundObjectsRendered = false;
        
        console.log('🧹 已清除所有精灵');
    }
    
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
        this.setupItemStatusUI();
        
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.camera.clamp();
        });
        
        // Latency Compensation: 启动更新循环
        this.app.ticker.add((ticker) => {
            this.updateRender(ticker.deltaTime);
        });
        
        console.log('✅ 初始化完成');
    }
    
    private async loadTextures() {
        console.log('📦 加载纹理...');
        
        // 尝试从 IndexedDB 加载本地资源
        const localResources = await this.loadLocalResources();
        
        if (!localResources) {
            console.error('❌ 本地资源不存在，请先下载资源包！');
            alert('错误：本地资源未找到！请返回登录页下载资源包。');
            throw new Error('本地资源未找到');
        }
        
        // 加载本地资源（只加载图片类型的资源）
        for (const [key, data] of Object.entries(localResources)) {
            // 跳过非图片资源（manifest, version等）
            if (!key.startsWith('img/')) continue;
            if (!(data instanceof Blob)) continue;
            
            try {
                // 使用 createImageBitmap 转换 Blob 为图片源
                const bitmap = await createImageBitmap(data);
                const texture = PIXI.Texture.from(bitmap);
                // 提取纹理key（去掉img/前缀）
                const texKey = key.replace('img/', '').replace('.png', '');
                this.textures.set(texKey, texture);
                console.log(`✅ ${texKey} (本地)`);
            } catch (e) {
                console.error(`❌ 加载失败: ${key}`, e);
            }
        }
        
        // 映射纹理到正确key（确保英文key也有对应纹理）
        const textureMap: Record<string, string> = {
            // 地形纹理
            '64x64像素草地春夏': 'grass',
            '64x64像素草平原': 'plain',
            '森林春': 'forest',
            '森林夏': 'forest',
            '森林秋': 'forest_autumn',
            '森林冬': 'forest_winter',
            '森林雪': 'forest_winter',
            '64x64像素沙漠': 'desert',
            '海洋': 'ocean',
            '沙滩': 'beach',
            '河流': 'river',
            '湖泊春夏秋': 'lake',
            '沼泽': 'swamp',
            '山地': 'mountain',
            '山丘': 'hill',
            // 英文 terrain type 到纹理 key 的映射
            'grass': 'grass',
            'plains': 'plain',
            'forest': 'forest',
            'forest_autumn': 'forest_autumn',
            'forest_winter': 'forest_winter',
            'desert': 'desert',
            'ocean': 'ocean',
            'beach': 'beach',
            'river': 'river',
            'lake': 'lake',
            'swamp': 'swamp',
            'mountain': 'mountain',
            'hill': 'hill',
            // 英文到中文文件名的映射（用于从缓存加载）
            'img/山丘春.png': 'hill',
            'img/山丘夏.png': 'hill',
            'img/山丘秋.png': 'hill',
            'img/山丘冬.png': 'hill',
            'img/山丘雪.png': 'hill',
            // 角色纹理
            '亚当': 'adam',
            '夏娃': 'eve',
            // 物品纹理
            '树': 'tree',
            '森林树木春夏': 'forest_tree',
            '森林树木秋': 'forest_tree',
            '森林树木冬': 'forest_tree',
            '森林树木雪': 'forest_tree',
            '石头': 'stone',
            '灌木': 'bush',
            '灌木果': 'berry',
            '灌木花': 'bush_flower',
            '井': 'well'
        };
        
        // 确保所有需要的纹理都加载了（使用英文key）
        const neededKeys = ['grass', 'plain', 'forest', 'forest_autumn', 'forest_winter', 
                          'desert', 'ocean', 'beach', 'river', 'lake', 'swamp', 'mountain', 'hill',
                          'adam', 'eve', 'tree', 'forest_tree', 'stone', 'bush', 'berry', 'bush_flower', 'well'];
        
        for (const texKey of neededKeys) {
            if (this.textures.has(texKey)) continue;  // 已有纹理
            
            // 查找对应的中文名
            for (const [cnName, enKey] of Object.entries(textureMap)) {
                if (enKey === texKey) {
                    const imgKey = `img/${cnName}.png`;
                    if (localResources[imgKey] instanceof Blob) {
                        try {
                            // 使用 createImageBitmap 转换 Blob 为图片源
                            const bitmap = await createImageBitmap(localResources[imgKey]);
                            const texture = PIXI.Texture.from(bitmap);
                            this.textures.set(texKey, texture);
                            console.log(`✅ ${texKey} (本地)`);
                        } catch (e) {
                            console.error(`❌ 加载失败: ${texKey}`);
                        }
                    }
                    break;
                }
            }
        }
        
        // 调试：打印已加载的纹理
        console.log('📦 已加载纹理:', Array.from(this.textures.keys()).join(', '));
        
        console.log('📦 纹理加载完成');
    }
    
    // 从 IndexedDB 加载本地资源
    private async loadLocalResources(): Promise<Record<string, Blob | null> | null> {
        try {
            const DB_NAME = 'eden_world_cache';
            const STORE_NAME = 'resources';
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 2);
                
                request.onerror = () => {
                    console.error('❌ 无法打开本地数据库');
                    resolve(null);
                };
                
                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction([STORE_NAME], 'readonly');
                    const store = transaction.objectStore(STORE_NAME);
                    const getAllRequest = store.getAll();
                    
                    getAllRequest.onsuccess = () => {
                        const items = getAllRequest.result || [];
                        if (items.length === 0) {
                            console.error('❌ 本地缓存为空');
                            resolve(null);
                            return;
                        }
                        
                        const resources: Record<string, Blob | null> = {};
                        for (const item of items) {
                            if (item.key && item.data) {
                                resources[item.key] = item.data;
                            }
                        }
                        
                        console.log(`📦 从本地加载了 ${items.length} 个资源`);
                        resolve(resources);
                    };
                    
                    getAllRequest.onerror = () => {
                        console.error('❌ 读取本地资源失败');
                        resolve(null);
                    };
                };
                
                request.onupgradeneeded = () => {
                    resolve(null);
                };
            });
        } catch (e) {
            console.error('❌ 加载本地资源失败:', e);
            return null;
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
            
            // 重连时清除旧的精灵和状态
            this.clearAllSprites();
            // 清除延迟补偿状态
            latencyComp.reset();
            
            // Latency Compensation: 初始化 - 先设置数据
            if (state.world?.worldSeed) {
                this.worldSeed = state.world.worldSeed;
            }
            
            // 存储服务器的地形数据 - 这要在syncState之前设置
            if (state.world?.tiles) {
                this.serverTiles = state.world.tiles;
                console.log(`🗺️ 收到服务器地形: ${this.serverTiles.length}x${this.serverTiles[0]?.length}`);
                console.log(`🗺️ 地形类型: ${[...new Set(this.serverTiles.flat().map(t => t.type))].join(', ')}`);
            } else {
                console.log('❌ 未收到服务器地形，使用本地生成');
            }
            
            // 渲染地面物品（从服务器数据）- 在syncState之前
            if (state.world?.groundObjects) {
                console.log(`📦 收到服务器物品: ${state.world.groundObjects.length}个`);
            }
            
            // 先渲染地形（使用服务器数据）
            if (state.world?.tiles) {
                console.log('🗺️ 开始渲染地形...');
                this.renderTerrain();
                console.log('🗺️ 地形渲染完成');
            }
            
            // 现在调用syncState渲染角色
            this.syncState(state);
            
            // 渲染地面物品（从服务器数据）
            if (state.world?.groundObjects) {
                this.renderGroundObjectsFromServer(state.world.groundObjects);
            } else {
                console.log('❌ 未收到服务器物品');
            }
            
            // 相机跟随第一个角色
            if (state.characters && state.characters.length > 0) {
                // 先设置本地玩家ID
                this.selectedCharacterId = state.characters[0].id;
                latencyComp.setLocalPlayerId(this.selectedCharacterId);
                // 再相机跟随
                this.cameraFollow(state.characters[0]);
            }
        });
        
        // Latency Compensation: 输入确认
        this.server.on('input_ack', (data) => {
            latencyComp.acknowledgeInput(data.seq);
        });
        
        this.server.on('state', (state) => {
            // Latency Compensation: 更新状态用于协调
            latencyComp.updateWithServerState(state);
            
            // 观察模式：禁用自动相机跟随，允许用户自由拖动
            // if (state.characters && state.characters.length > 0) {
            //     this.cameraFollow(state.characters[0]);
            // }
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
    
    // Latency Compensation: 更新渲染
    private updateRender(deltaTime: number) {
        // 对其他玩家使用实体插值
        for (const [id, container] of this.characterSprites) {
            const interpolated = latencyComp.getInterpolatedPosition(id);
            if (interpolated) {
                container.x = interpolated.x * TILE_SIZE + TILE_SIZE / 2;
                container.y = interpolated.y * TILE_SIZE + TILE_SIZE / 2;
            }
        }
    }
    
    private renderTerrain() {
        const terrainTextures: Record<string, Record<string, string>> = {
            spring: { grass: 'grass', plains: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            summer: { grass: 'grass', plains: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            autumn: { grass: 'grass', plains: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            winter: { grass: 'grass', plains: 'plain', forest: 'forest_winter', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' }
        };
        
        const terrainMap = terrainTextures[this.currentSeason] || terrainTextures.summer;
        
        // 英文key到中文文件名的映射（用于从缓存加载的纹理）
        const terrainKeyToFile: Record<string, string> = {
            'grass': '64x64像素草地春夏',
            'plain': '64x64像素草平原',
            'forest': '森林春',
            'forest_autumn': '森林秋',
            'forest_winter': '森林冬',
            'desert': '64x64像素沙漠',
            'ocean': '海洋',
            'beach': '沙滩',
            'river': '河流',
            'lake': '湖泊春夏秋',
            'swamp': '沼泽',
            'mountain': '山地',
            'hill': '山丘春'
        };
        
        const terrainCount: Record<string, number> = {};
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const key = `${x},${y}`;
                if (this.terrainSprites.has(key)) continue;
                
                // 优先使用服务器的地形数据
                let terrainType: string;
                if (this.serverTiles && this.serverTiles[y] && this.serverTiles[y][x]) {
                    terrainType = this.serverTiles[y][x].type;
                } else {
                    terrainType = this.getTerrainType(x, y);
                }
                terrainCount[terrainType] = (terrainCount[terrainType] || 0) + 1;
                
                const texKey = terrainMap[terrainType] || 'grass';
                // 如果直接key找不到，尝试用英文key映射到中文文件名
                let texture = this.textures.get(texKey);
                if (!texture && terrainKeyToFile[texKey]) {
                    texture = this.textures.get(terrainKeyToFile[texKey]);
                }
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
        
        // 物品渲染：在收到服务器数据后处理，不在这里渲染
    }
    
    // Latency Compensation: 从服务器数据渲染物品
    private renderGroundObjectsFromServer(groundObjects: any[]) {
        if (!groundObjects || groundObjects.length === 0) return;
        
        this.groundObjectsRendered = true;  // 标记已渲染
        for (const obj of groundObjects) {
            this.addGroundObject(obj.x, obj.y, obj.type, obj.durability, obj.maxDurability);
        }
    }
    
    private renderGroundObjects(groundObjects?: any[]) {
        // 在线模式：只使用服务器数据，不本地生成
        // 如果已经从服务器渲染过，跳过
        if (this.groundObjectsRendered) {
            return;
        }
        
        // 如果有服务器物品数据，使用服务器的数据
        if (groundObjects && groundObjects.length > 0) {
            for (const obj of groundObjects) {
                this.addGroundObject(obj.x, obj.y, obj.type, obj.durability, obj.maxDurability);
            }
            this.groundObjectsRendered = true;
            return;
        }
        
        // 如果有世界种子但没有服务器数据，不生成物品（在线模式必须用服务器数据）
        console.log('🕐 等待服务器物品数据...');
    }
    
    // Latency Compensation: 确定性生成物品
    private renderGroundObjectsSeeded() {
        // 确定性生成（与服务器一致）
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const terrainType = this.getTerrainType(x, y);
                const rand = seededRandom(this.worldSeed, x, y);
                
                // 森林：树 (15%概率)
                if (terrainType === 'forest' && rand < 0.15) {
                    this.addGroundObject(x, y, 'tree');
                }
                // 草地/平原：灌木 (8%概率)
                else if ((terrainType === 'grass' || terrainType === 'plains') && rand < 0.08) {
                    this.addGroundObject(x, y, 'bush');
                }
                // 山地/丘陵：石头 (10%概率)
                else if ((terrainType === 'mountain' || terrainType === 'hill') && rand < 0.10) {
                    this.addGroundObject(x, y, 'rock');
                }
                // 海滩：贝壳 (3%概率)
                else if (terrainType === 'beach' && rand < 0.03) {
                    this.addGroundObject(x, y, 'shell');
                }
            }
        }
    }
    
    private addGroundObject(x: number, y: number, type: string, durability?: number, maxDurability?: number) {
        const tex = this.textures.get(type);
        if (!tex) return;
        
        const container = new PIXI.Container();
        
        const sprite = new PIXI.Sprite(tex);
        // 森林树和果树比格子大1/3
        const size = (type === 'tree' || type === 'forest_tree' || type === 'tree_fruit') ? TILE_SIZE * 1.33 : 40;
        sprite.width = size;
        sprite.height = size;
        sprite.anchor.set(0.5);
        container.addChild(sprite);
        
        // 创建物品数据（保存格子坐标用于显示）
        const itemData: ItemData = {
            type: type,
            x: x,
            y: y,
            layer: 'ground',
            durability: durability ?? (type === 'bush' || type === 'berry' ? 100 : 0),
            maxDurability: maxDurability ?? (type === 'bush' || type === 'berry' ? 100 : 0)
        };
        
        // 创建点击热区
        const hitbox = new PIXI.Graphics();
        hitbox.rect(-ITEM_HITBOX_SIZE / 2, -ITEM_HITBOX_SIZE / 2, ITEM_HITBOX_SIZE, ITEM_HITBOX_SIZE);
        hitbox.fill({ color: 0xffffff, alpha: 0.001 });
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';
        
        // 点击事件
        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            this.showItemStatus(itemData);
        });
        
        container.addChild(hitbox);
        
        // 设置位置（需要转像素坐标）
        container.x = x * TILE_SIZE + TILE_SIZE / 2;
        container.y = y * TILE_SIZE + TILE_SIZE / 2;
        container.zIndex = 2; // 在地形上面，角色下面
        
        this.worldContainer.addChild(container);
        
        // 保存物品数据和精灵
        const itemKey = `${x},${y},${type}`;
        this.itemSprites.set(itemKey, container);
        (container as any).itemData = itemData;
        
        this.groundObjects.push(container);
    }
    
    private getTerrainType(x: number, y: number): string {
        // 与服务器一致的地形生成
        const hash = (px: number, py: number) => {
            const n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
            return n - Math.floor(n);
        };
        
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const smoothstep = (t: number) => t * t * (3 - 2 * t);
        
        const noise2D = (px: number, py: number) => {
            const ix = Math.floor(px);
            const iy = Math.floor(py);
            const fx = px - ix;
            const fy = py - iy;
            const sx = smoothstep(fx);
            const sy = smoothstep(fy);
            
            const n00 = hash(ix, iy);
            const n10 = hash(ix + 1, iy);
            const n01 = hash(ix, iy + 1);
            const n11 = hash(ix + 1, iy + 1);
            
            const nx0 = lerp(n00, n10, sx);
            const nx1 = lerp(n01, n11, sx);
            return lerp(nx0, nx1, sy);
        };
        
        const fbm = (px: number, py: number, octaves: number) => {
            let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
            for (let i = 0; i < octaves; i++) {
                value += amplitude * noise2D(px * frequency, py * frequency);
                maxValue += amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }
            return value / maxValue;
        };
        
        const scale = 0.02;
        const elevation = fbm(x * scale, y * scale, 4);
        const moisture = fbm(x * scale + 100, y * scale + 100, 3);
        
        // 湖泊（优先）
        if (this.isLakeArea(x, y)) return 'lake';
        
        // 河流
        if (this.isRiverTile(x, y)) return 'river';
        
        // 基础地形
        if (elevation < 0.35) return 'ocean';
        if (elevation < 0.40) return 'beach';
        if (elevation > 0.70) return 'mountain';
        if (elevation > 0.60) return 'hill';
        if (moisture > 0.6) return 'forest';
        if (moisture > 0.5) return 'grass';
        return 'plains';
    }
    
    private isLakeArea(x: number, y: number): boolean {
        const lakes = [
            { cx: 30, cy: 30, r: 8 },
            { cx: 80, cy: 50, r: 10 },
            { cx: 140, cy: 40, r: 12 },
            { cx: 160, cy: 70, r: 6 }
        ];
        
        for (const lake of lakes) {
            const dist = Math.sqrt((x - lake.cx) ** 2 + (y - lake.cy) ** 2);
            if (dist < lake.r) return true;
        }
        return false;
    }
    
    private isRiverTile(x: number, y: number): boolean {
        const rivers = [
            { x1: 50, y1: 0, x2: 60, y2: 100 },
            { x1: 120, y1: 0, x2: 110, y2: 100 },
            { x1: 180, y1: 0, x2: 170, y2: 100 }
        ];
        
        for (const river of rivers) {
            const riverWidth = 2;
            const t = y / 100;
            const riverX = river.x1 + (river.x2 - river.x1) * t;
            if (Math.abs(x - riverX) < riverWidth) return true;
        }
        return false;
    }
    
    private cameraFollow(char: ServerCharacter) {
        if (char.x === null || char.y === null) return;
        
        const scale = this.camera.scale;
        // 居中到角色位置
        this.camera.target.x = window.innerWidth / 2 - (char.x * TILE_SIZE + TILE_SIZE / 2) * scale;
        this.camera.target.y = window.innerHeight / 2 - (char.y * TILE_SIZE + TILE_SIZE / 2) * scale;
    }
    
    private renderCharacter(data: ServerCharacter) {
        let container = this.characterSprites.get(data.id);
        
        if (!container) {
            container = this.createCharacterSprite(data);
            this.worldContainer.addChild(container);
            this.characterSprites.set(data.id, container);
            if (this.terrainSprites.size === 0) {
                this.renderTerrain();
            }
        }
        
        if (data.x !== null && data.y !== null) {
            // 调试：记录角色像素位置
            const pixelX = data.x * TILE_SIZE + TILE_SIZE / 2;
            const pixelY = data.y * TILE_SIZE + TILE_SIZE / 2;
            if (data.id === 'adam') {
                console.log(`🎭 亚当位置: tile=(${data.x}, ${data.y}), pixel=(${pixelX}, ${pixelY})`);
            }
            // Latency Compensation: 使用服务器确认的位置
            // 对于本地玩家，使用协调后的位置；对于其他玩家使用插值位置
            if (data.id === this.selectedCharacterId) {
                // 本地玩家：使用协调后的位置
                const reconciled = latencyComp.getReconciledPosition(data.x, data.y);
                container.x = reconciled.x * TILE_SIZE + TILE_SIZE / 2;
                container.y = reconciled.y * TILE_SIZE + TILE_SIZE / 2;
            } else {
                // 其他玩家：位置由updateRender中的插值处理
                // 这里只设置当前位置作为基准
                container.x = data.x * TILE_SIZE + TILE_SIZE / 2;
                container.y = data.y * TILE_SIZE + TILE_SIZE / 2;
            }
        }
        container.zIndex = 10;
        
        // 根据角色状态显示文字（与单机版一致）
        const hunger = data.hunger || 50;
        const thirst = data.thirst || 50;
        const energy = data.energy || 5;
        
        let statusText = '移动';
        if (thirst < 30) statusText = '很渴';
        else if (hunger < 30) statusText = '很饿';
        else if (thirst < 50) statusText = '口渴';
        else if (hunger < 50) statusText = '饥饿';
        else if (energy < 2) statusText = '疲惫';
        else if (data.action === '饮水中') statusText = '饮水';
        else if (data.action === '进食中') statusText = '进食';
        else if (data.action === '休息中') statusText = '休息';
        else if (data.action === '闲置') statusText = '待机';
        else if (data.action?.includes('寻找')) statusText = '探索';
        
        // 显示 "角色名: 状态"
        (container as any).label.text = `${data.name}: ${statusText}`;
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
        
        // 点击区域 - 透明热区 (使用路径API)
        // 注意：rect 在 (0,0) 位置，因为后面会设置 container.x/y
        const hitbox = new PIXI.Graphics();
        hitbox.rect(-HITBOX_SIZE / 2, -HITBOX_SIZE / 2, HITBOX_SIZE, HITBOX_SIZE);
        hitbox.fill({ color: 0xffffff, alpha: 0.001 });
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';
        
        // 点击事件
        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            this.showCharacterStatus(data);
        });
        
        // 调试：打印 hitbox 信息
        console.log(`🎯 创建角色热区: ${data.name}, hitbox尺寸: ${HITBOX_SIZE}x${HITBOX_SIZE}`);
        
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
        
        // 点击画布移动角色
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = this.app.screen;
        // 观察游戏模式：点击地图不移动角色，只显示信息
        this.app.stage.on('pointerdown', (event) => {
            this.handleMapClick(event.global.x, event.global.y);
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
        // 使用 setTimeout 延迟创建，避免 PIXI 事件循环干扰
        setTimeout(() => {
            if (!this.statusPanel) return;
            
            this.selectedCharacter = char;
            
            // 根据角色状态获取状态图标
            const hunger = char.hunger || 50;
            const thirst = char.thirst || 50;
            const energy = char.energy || 5;
            
            let statusIcon = '🚶';
            if (thirst < 30) statusIcon = '💧很渴';
            else if (hunger < 30) statusIcon = '🍖很饿';
            else if (thirst < 50) statusIcon = '💧口渴';
            else if (hunger < 50) statusIcon = '🍖饥饿';
            else if (energy < 2) statusIcon = '😴疲惫';
            else if (char.action === '饮水中') statusIcon = '💧饮水';
            else if (char.action === '进食中') statusIcon = '🍖进食';
            else if (char.action === '休息中') statusIcon = '💤休息';
            else if (char.action === '闲置') statusIcon = '🧘待机';
            else if (char.action?.includes('寻找')) statusIcon = '🔍探索';
            
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
            const statusIconElem = document.getElementById('status-icon');
            
            // 更新状态图标
            if (statusIconElem) statusIconElem.textContent = statusIcon;
            
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
            
            // DNA属性
            if (dnaContainer && char.dna) {
                const dna = char.dna;
                const lifespanText = `${Math.round((dna.lifespan / 1200) * 70)}岁`;
                dnaContainer.innerHTML = `
                    <div class="dna-row" style="background: rgba(74, 169, 74, 0.3); font-weight: bold;">
                        <span>🎭 角色</span><span>${char.id === 'adam' ? '亚当' : '夏娃'}</span>
                    </div>
                    <div class="dna-row">
                        <span>❤️ 寿命</span><span>${lifespanText}</span>
                    </div>
                    <div class="dna-row">
                        <span>🔥 代谢</span><span>${(dna.metabolism * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>💪 力量</span><span>${(dna.strength * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>🏋️ 体质</span><span>${(dna.constitution * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>🧠 智力</span><span>${(dna.intelligence * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>⚔️ 胆量</span><span>${(dna.bravery * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>🤝 社交</span><span>${(dna.aggression * 100).toFixed(0)}</span>
                    </div>
                    <div class="dna-row">
                        <span>🌟 好奇心</span><span>${(dna.curiosity * 100).toFixed(0)}</span>
                    </div>
                `;
            }
            
            // 显示面板
            this.statusPanel.style.cssText = 'display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;';
        }, 50);
    }
    
    private hideStatusPanel() {
        this.selectedCharacter = null;
        // 移除调试面板
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) debugPanel.remove();
        // 隐藏状态面板
        if (this.statusPanel) {
            this.statusPanel.style.cssText = 'display: none;';
        }
    }
    
    private setupItemStatusUI() {
        this.itemStatusUI = new ItemStatusUI();
    }
    
    // Latency Compensation: 处理地图点击，发送移动输入
    private handleMapClick(screenX: number, screenY: number) {
        // 观察模式：点击地图显示位置信息，但不移动角色
        try {
            if (!this.camera || !this.camera.target || !this.camera.offset) {
                return;
            }
            const worldX = (this.camera.target.x - this.camera.offset.x + screenX) / this.camera.zoom;
            const worldY = (this.camera.target.y - this.camera.offset.y + screenY) / this.camera.zoom;
            const tileX = Math.floor(worldX / TILE_SIZE);
            const tileY = Math.floor(worldY / TILE_SIZE);
            console.log(`🗺️ 点击位置: tile=(${tileX}, ${tileY})`);
        } catch (e) {
            // 忽略点击错误
        }
    }
    
    // 观察模式：发送移动输入（保留但不调用）
    private sendMoveInput(targetX: number, targetY: number) {
        // 观察游戏模式：禁用移动输入
        console.log(`🗺️ 观察模式：移动到 (${targetX}, ${targetY}) 已禁用`);
    }
    
    private showItemStatus(item: ItemData) {
        // 使用 setTimeout 避免 PIXI 事件循环干扰
        setTimeout(() => {
            this.itemStatusUI.showItem(item);
        }, 50);
    }
}

// 验证 token
export async function validateToken(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');
    
    if (!token) {
        token = localStorage.getItem('eden_token') || undefined;
    }
    
    if (!token) {
        console.warn('⚠️ 没有 token，跳转到登录页');
        window.location.href = '/';
        return false;
    }
    
    try {
        const res = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            console.warn('⚠️ token 无效，跳转到登录页');
            localStorage.removeItem('eden_token');
            window.location.href = '/';
            return false;
        }
        
        localStorage.setItem('eden_token', token);
        return true;
    } catch (e) {
        console.error('❌ token 验证失败:', e);
        window.location.href = '/';
        return false;
    }
}

// 跳转到登录页
export function redirectToLogin() {
    window.location.href = '/?redirect=client';
}
