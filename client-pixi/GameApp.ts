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
import { seededRandom } from './utils/seededRandom';

const MAP_WIDTH = 300;
const HITBOX_SIZE = 48; // 角色点击热区大小
const ITEM_HITBOX_SIZE = 86; // 物品点击热区大小（与SCALED_SIZE一致）
const MAP_HEIGHT = 150;
const TILE_SIZE = 64;
const SCALE = 1.35;
const SCALED_SIZE = TILE_SIZE * SCALE;
const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;

// 服务器状态 → 显示文字 映射
const ACTION_TEXT: Record<string, string> = {
    'idle': '🧘待机',
    'wandering': '🚶巡逻',
    'seeking_food': '🔍找食物',
    'seeking_water': '💧找水',
    'eating': '🍖进食',
    'drinking': '💧饮水',
    'resting': '💤休息',
    'gathering': '🫐采集',
};

interface ServerCharacter {
    id: string;
    name: string;
    x: number;
    y: number;
    needs: {
        hunger: number;
        thirst: number;
        energy: number;
    };
    action: string;
    actionTimer?: number;
    actionTimerMax?: number;
    inventory?: {
        berries: number;
        calories: number;
    };
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
    private terrainTextureMissingLogged: boolean = false;  // 是否已打印缺少地形纹理警告
    private serverTiles: any[][] = [];  // 服务器下发的地形数据
    private lastGroundObjects: any[] = [];  // 保存服务器发送的物品数据（用于季节变化后重新渲染）
    private viewportOffsetX: number = 0;  // 视口偏移X
    private viewportOffsetY: number = 0;  // 视口偏移Y
    private selectedCharacterId: string = 'adam';  // 当前选中的角色
    private characterSprites: Map<string, any> = new Map();
    private terrainSprites: Map<string, PIXI.Sprite> = new Map();
    private groundObjects: PIXI.Container[] = [];

    // 角色状态面板
    private statusPanel!: HTMLElement;
    private selectedCharacter: ServerCharacter | null = null;
    
    // 状态面板DOM元素缓存（避免每次查询）
    private statusPanelCache: {
        name?: HTMLElement;
        type?: HTMLElement;
        avatar?: HTMLElement;
        position?: HTMLElement;
        foodBar?: HTMLElement;
        waterBar?: HTMLElement;
        energyBar?: HTMLElement;
        foodVal?: HTMLElement;
        waterVal?: HTMLElement;
        energyVal?: HTMLElement;
        healthBar?: HTMLElement;
        healthVal?: HTMLElement;
        action?: HTMLElement;
        dnaAttrs?: HTMLElement;
        statusIcon?: HTMLElement;
    } = {};
    private lastDnaStr: string = ''; // 用于检测DNA是否变化

    // 物品状态面板
    private itemStatusUI!: ItemStatusUI;
    private itemSprites: Map<string, any> = new Map();

    // 角色目标位置（用于平滑插值）
    private characterTargets: Map<string, { x: number; y: number }> = new Map();
    
    // 角色标签缓存（避免每次都更新PIXI Text）
    private characterLabelCache: Map<string, string> = new Map();

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

        // 清除目标位置
        this.characterTargets.clear();

        // 重置标记
        this.groundObjectsRendered = false;

        console.log('🧹 已清除所有精灵');
    }
    
    private clearTerrainSprites(): void {
        this.terrainSprites.forEach(sprite => sprite.destroy());
        this.terrainSprites.clear();
        console.log('🧹 已清除地形精灵');
    }
    
    private lastViewportRequest: number = 0;
    private viewportRequestCooldown: number = 500; // 500ms 防抖
    
    private requestViewportUpdate(): void {
        const now = Date.now();
        if (now - this.lastViewportRequest < this.viewportRequestCooldown) {
            return;
        }
        this.lastViewportRequest = now;
        
        // 计算相机中心的世界坐标
        const scale = this.camera.scale;
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;
        const cameraX = this.camera.target.x;
        const cameraY = this.camera.target.y;
        
        // 世界坐标 = (屏幕中心 - 相机偏移) / 缩放 / TILE_SIZE
        // 注意：camera.target 是 worldContainer 相对于屏幕的偏移
        // 当 camera.target.x 为负值时，世界向左移动，屏幕中心看到的世界坐标更大
        const centerX = Math.floor((screenCenterX - cameraX) / scale / TILE_SIZE);
        const centerY = Math.floor((screenCenterY - cameraY) / scale / TILE_SIZE);
        
        // 限制在有效世界范围内
        const worldX = Math.max(0, Math.min(MAP_WIDTH - 1, centerX));
        const worldY = Math.max(0, Math.min(MAP_HEIGHT - 1, centerY));
        
        console.log(`📡 requestViewport: camera=(${cameraX.toFixed(0)},${cameraY.toFixed(0)}), screenCenter=(${screenCenterX},${screenCenterY}), scale=${scale}, raw=(${centerX},${centerY}), world=(${worldX},${worldY})`);
        this.server.requestViewport(worldX, worldY);
    }

    // 位置插值系统 - 让角色移动更平滑
    private setupPositionInterpolation() {
        const LERP_SPEED = 0.25; // 插值速度，值越大移动越快

        this.app.ticker.add((ticker) => {
            const delta = ticker.deltaTime;

            // 视口裁剪：相机移动时生成新地形
            this.renderTerrain();

            this.characterSprites.forEach((container, id) => {
                const target = this.characterTargets.get(id);
                if (target) {
                    // 平滑插值到目标位置
                    const dx = target.x - container.x;
                    const dy = target.y - container.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // 距离很近时直接跳到目标
                    if (distance < 1) {
                        container.x = target.x;
                        container.y = target.y;
                    } else {
                        // 使用平滑插值
                        container.x += dx * LERP_SPEED * Math.min(delta, 3);
                        container.y += dy * LERP_SPEED * Math.min(delta, 3);
                    }
                }
            });
        });
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

        // ===== 移动端触摸支持 =====
        this.setupMobileControls(canvas);

        await this.loadTextures();
        this.setupServer();
        this.setupKeyboard();
        this.setupConsole();
        this.setupStatusPanel();
        this.setupItemStatusUI();
        this.setupTimePanel();

        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.camera.clamp();
        });

        // 隐藏加载遮罩
        // 注意：不要在这里隐藏！因为服务器连接和地形渲染还需要时间
        // 加载遮罩会在 init 事件处理完成后隐藏

        // 初始化位置插值系统
        this.setupPositionInterpolation();

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
            '岩石': 'rock',
            '灌木': 'bush',
            '灌木果': 'berry',
            '灌木花': 'bush_flower',
            '树枝': 'twig',
            '贝壳': 'shell',
            '井': 'well'
        };

        // 服务器发送的物品类型到纹理的映射
        const serverItemTextureMap: Record<string, string> = {
            'rock': 'stone',  // 服务器rock -> 客户端stone纹理
            'shell': '贝壳'   // 服务器shell -> 客户端贝壳纹理
        };

        // 确保所有需要的纹理都加载了（使用英文key）
        const neededKeys = ['grass', 'plain', 'forest', 'forest_autumn', 'forest_winter',
            'desert', 'ocean', 'beach', 'river', 'lake', 'swamp', 'mountain', 'hill',
            'adam', 'eve', 'tree', 'forest_tree', 'stone', 'rock', 'bush', 'berry', 'bush_flower', 'twig', 'shell', 'well'];

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
                            break;
                        } catch (e) {
                            console.error(`❌ 加载失败: ${texKey}`);
                        }
                    }
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
            try {
            console.log('📊 收到初始状态:', state ? '数据正常' : '数据为空');
            
            // 初始化时间面板
            if (state.time) {
                // 直接传递时间数据，不包装 data 属性
                this.refreshTimeDisplay(state.time);
                // 保存初始时间用于后续更新
                this.lastServerTime = { ...state.time };
                this.lastServerTimeMs = Date.now();
            } else if (state.season) {
                // 兼容旧版本：使用season字段
                this.refreshTimeDisplay({
                    season: state.season,
                    seasonName: state.season === 'spring' ? '春' : state.season === 'summer' ? '夏' : state.season === 'autumn' ? '秋' : '冬',
                    seasonEmoji: state.season === 'spring' ? '🌸' : state.season === 'summer' ? '☀️' : state.season === 'autumn' ? '🍂' : '❄️',
                    year: 1,
                    day: 1,
                    timeString: '00:00',
                    periodEmoji: '☀️'
                });
            }

            // 重连时清除旧的精灵和状态
            this.clearAllSprites();

            // 初始化 - 先设置数据
            if (state.world?.worldSeed) {
                this.worldSeed = state.world.worldSeed;
            }

            // 存储服务器的地形数据（如果有的话）
            if (state.world?.viewport?.tiles) {
                // 服务器发送的是视口地形
                this.serverTiles = state.world.viewport.tiles;
                this.viewportOffsetX = state.world.viewport.centerX - state.world.viewport.radius;
                this.viewportOffsetY = state.world.viewport.centerY - state.world.viewport.radius;
                console.log(`🗺️ 收到服务器视口地形: ${this.serverTiles.length}x${this.serverTiles[0]?.length} (偏移: ${this.viewportOffsetX}, ${this.viewportOffsetY})`);
            } else if (state.world?.tiles) {
                // 兼容旧格式：完整地形
                this.serverTiles = state.world.tiles;
                this.viewportOffsetX = 0;
                this.viewportOffsetY = 0;
                console.log(`🗺️ 收到服务器完整地形: ${this.serverTiles.length}x${this.serverTiles[0]?.length}`);
            } else {
                this.serverTiles = [];
                this.viewportOffsetX = 0;
                this.viewportOffsetY = 0;
                console.log('🗺️ 未收到服务器地形，使用本地生成（基于worldSeed）');
            }

            // 渲染地面物品（从服务器数据）- 在syncState之前
            if (state.world?.groundObjects) {
                console.log(`📦 收到服务器物品: ${state.world.groundObjects.length}个`);
            }

            // 先移动相机到角色位置，再渲染地形
            // 这样 renderTerrain 可以正确计算视口范围
            if (state.characters && state.characters.length > 0) {
                this.cameraCenterOnAll(state.characters);
            }

            // 先渲染地形（使用服务器数据）
            if (state.world?.viewport?.tiles || state.world?.tiles) {
                const loadingText = document.getElementById('loading-text');
                if (loadingText) loadingText.textContent = '正在生成游戏世界';
                console.log('🗺️ 开始渲染地形...');
                this.renderTerrain();
                console.log('🗺️ 地形渲染完成');
            }

            // 现在调用syncState渲染角色
            this.syncState(state);

            // 渲染地面物品（从服务器数据）
            if (state.world?.groundObjects) {
                const loadingText = document.getElementById('loading-text');
                if (loadingText) loadingText.textContent = '正在放置物品';
                console.log(`🔍 调用renderGroundObjectsFromServer，物品数量: ${state.world.groundObjects.length}`);
                this.renderGroundObjectsFromServer(state.world.groundObjects);
            } else {
                console.log('❌ 未收到服务器物品');
            }

            // 相机跟随第一个角色（相机已在前面居中）
            if (state.characters && state.characters.length > 0) {
                const loadingText = document.getElementById('loading-text');
                if (loadingText) loadingText.textContent = '正在唤醒角色';
                // 先设置本地玩家ID
                this.selectedCharacterId = state.characters[0].id;

                // 如果有选中的角色，更新面板状态
                if (this.selectedCharacter) {
                    const serverChar = state.characters.find(c => c.id === this.selectedCharacter!.id);
                    if (serverChar) {
                        this.selectedCharacter = serverChar;
                        this.updateStatusPanel(serverChar);
                    }
                }

                // 初始化完成，隐藏加载遮罩
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            } else {
                // 没有角色数据时也隐藏遮罩
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            }
            } catch (e) {
                console.error('❌ 初始化出错:', e);
                // 出错时也隐藏遮罩
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.classList.add('hidden');
                }
            }
        });
        
        // 处理视口更新（地形数据）
        this.server.on('viewport_update', (data) => {
            try {
                if (data?.viewport?.tiles) {
                    console.log(`🗺️ 收到视口更新: ${data.viewport.tiles.length}x${data.viewport.tiles[0]?.length}`);
                    
                    // 调试：统计收到的地形类型
                    const terrainStats: Record<string, number> = {};
                    for (const row of data.viewport.tiles) {
                        for (const tile of row) {
                            terrainStats[tile.type] = (terrainStats[tile.type] || 0) + 1;
                        }
                    }
                    console.log(`📊 收到的视口地形统计: ${JSON.stringify(terrainStats)}`);
                    
                    this.serverTiles = data.viewport.tiles;
                    // 计算tiles数组的实际范围
                    const tilesStartX = data.viewport.centerX - data.viewport.radius;
                    const tilesStartY = data.viewport.centerY - data.viewport.radius;
                    const tilesEndX = Math.min(tilesStartX + data.viewport.tiles[0]?.length || 0, data.viewport.centerX + data.viewport.radius);
                    const tilesEndY = Math.min(tilesStartY + data.viewport.tiles.length, data.viewport.centerY + data.viewport.radius);
                    
                    // 如果tiles被裁剪（例如请求的区域超出世界边界），需要调整offset
                    if (data.viewport.tiles[0]?.[0]) {
                        this.viewportOffsetX = data.viewport.tiles[0][0].x;
                        this.viewportOffsetY = data.viewport.tiles[0][0].y;
                    } else {
                        this.viewportOffsetX = Math.max(0, tilesStartX);
                        this.viewportOffsetY = Math.max(0, tilesStartY);
                    }
                    
                    // 调试：检查实际返回的 tile 数据
                    const firstTile = data.viewport.tiles[0]?.[0];
                    const lastTile = data.viewport.tiles[data.viewport.tiles.length-1]?.[data.viewport.tiles[0]?.length-1];
                    console.log(`🗺️ 设置视口偏移: fromTile=(${this.viewportOffsetX},${this.viewportOffsetY}), tiles=${data.viewport.tiles.length}x${data.viewport.tiles[0]?.length || 0}`);
                    console.log(`🗺️ 第一个tile: (${firstTile?.x}, ${firstTile?.y}), 最后一个tile: (${lastTile?.x}, ${lastTile?.y})`);
                    
                    // 清除旧的地形精灵，强制重新渲染
                    this.clearTerrainSprites();
                }
            } catch (e) {
                console.error('❌ 视口更新出错:', e);
            }
        });
        
        // 超时保护：10秒后强制隐藏加载遮罩
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 10000);

        // 角色选中事件 - 收到服务器返回的完整数据（含DNA）
        this.server.on('character_selected', (data) => {
            console.log('🎭 收到角色完整数据:', data);
            this.showCharacterStatus(data);
        });

        this.server.on('state', (state) => {
            // 观察模式：直接使用服务器位置更新角色显示
            if (state.characters) {
                for (const char of state.characters) {
                    this.renderCharacter(char);
                }
                // 更新选中角色的状态面板
                if (this.selectedCharacter) {
                    const serverChar = state.characters.find(c => c.id === this.selectedCharacter!.id);
                    if (serverChar) {
                        this.selectedCharacter = serverChar;
                        this.updateStatusPanel(serverChar);
                    }
                }
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
            spring: { grass: 'grass', plains: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            summer: { grass: 'grass', plains: 'plain', forest: 'forest', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
            autumn: { grass: 'grass', plains: 'plain', forest: 'forest_autumn', desert: 'desert', ocean: 'ocean', beach: 'beach', river: 'river', lake: 'lake', swamp: 'swamp', mountain: 'mountain', hill: 'hill' },
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

        // 检查服务器地形数据是否可用
        if (!this.serverTiles || this.serverTiles.length === 0) {
            return; // 等待服务器数据
        }

        // 计算视口范围（基于相机位置）- 视口裁剪优化
        const scale = this.camera?.target?.scale?.x || 1;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // 世界坐标计算：与 requestViewportUpdate 保持一致
        // 世界坐标 = (屏幕中心 - 相机偏移) / 缩放 / TILE_SIZE
        const viewCenterX = Math.floor((screenWidth / 2 - this.camera.target.x) / scale / TILE_SIZE);
        const viewCenterY = Math.floor((screenHeight / 2 - this.camera.target.y) / scale / TILE_SIZE);

        const terrainCount: Record<string, number> = {};

        // 计算 serverTiles 的实际范围
        const serverTilesMinX = this.viewportOffsetX;
        const serverTilesMinY = this.viewportOffsetY;
        const serverTilesMaxX = serverTilesMinX + (this.serverTiles[0]?.length || 0) - 1;
        const serverTilesMaxY = serverTilesMinY + this.serverTiles.length - 1;

        // 只渲染视口范围内的地形，但也要确保在 serverTiles 范围内
        const minX = Math.max(serverTilesMinX, Math.floor(Math.max(0, viewCenterX - Math.ceil(screenWidth / 2 / TILE_SIZE) - 5)));
        const maxX = Math.min(serverTilesMaxX, Math.floor(Math.min(MAP_WIDTH - 1, viewCenterX + Math.ceil(screenWidth / 2 / TILE_SIZE) + 5)));
        const minY = Math.max(serverTilesMinY, Math.floor(Math.max(0, viewCenterY - Math.ceil(screenHeight / 2 / TILE_SIZE) - 5)));
        const maxY = Math.min(serverTilesMaxY, Math.floor(Math.min(MAP_HEIGHT - 1, viewCenterY + Math.ceil(screenHeight / 2 / TILE_SIZE) + 5)));

        let skippedNoServerData = 0;
        let skippedAlreadyRendered = 0;
        let skippedNoTexture = 0;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const key = `${x},${y}`;
                if (this.terrainSprites.has(key)) {
                    skippedAlreadyRendered++;
                    continue;
                }

                // 只使用服务器的地形数据，超出范围则跳过（使用整数坐标）
                const serverX = Math.floor(x - this.viewportOffsetX);
                const serverY = Math.floor(y - this.viewportOffsetY);
                if (!this.serverTiles || !this.serverTiles[serverY] || !this.serverTiles[serverY][serverX]) {
                    // 超出服务器数据范围，跳过渲染（等待服务器发送更多数据）
                    skippedNoServerData++;
                    if (skippedNoServerData <= 3) {
                        console.log(`DEBUG 跳过地形 [${x},${y}]: serverX=${serverX}, serverY=${serverY}, serverTiles[${serverY}]?.length=${this.serverTiles?.[serverY]?.length}`);
                    }
                    continue;
                }
                const terrainType = this.serverTiles[serverY][serverX].type;
                terrainCount[terrainType] = (terrainCount[terrainType] || 0) + 1;

                const texKey = terrainMap[terrainType] || 'grass';
                // 如果直接key找不到，尝试用英文key映射到中文文件名
                let texture = this.textures.get(texKey);
                if (!texture && terrainKeyToFile[texKey]) {
                    texture = this.textures.get(terrainKeyToFile[texKey]);
                }
                if (!texture) {
                    // 只打印一次
                    if (!this.terrainTextureMissingLogged) {
                        console.log(`❌ 地形找不到纹理: ${terrainType} -> ${texKey} -> ${terrainKeyToFile[texKey]}`);
                        this.terrainTextureMissingLogged = true;
                    }
                    continue;
                }
                this.terrainTextureMissingLogged = false;

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
        console.log(`🗺️ 地形统计: ${Object.entries(terrainCount).map(([k,v]) => `${k}:${v}`).join(', ') || '无'}, 跳过: 已渲染=${skippedAlreadyRendered}, 无数据=${skippedNoServerData} (视口${minX}-${maxX}, ${minY}-${maxY})`);

        // 物品渲染：在收到服务器数据后处理，不在这里渲染
    }

    // Latency Compensation: 从服务器数据渲染物品
    private renderGroundObjectsFromServer(groundObjects: any[]) {
        if (!groundObjects || groundObjects.length === 0) return;

        // 保存物品数据用于季节变化后重新渲染
        this.lastGroundObjects = groundObjects;
        this.groundObjectsRendered = true;  // 标记已渲染

        // 详细调试坐标
        if (groundObjects.length > 0) {
            console.log(`📍 视口偏移: viewportOffsetX=${this.viewportOffsetX}, viewportOffsetY=${this.viewportOffsetY}`);
            console.log(`📍 相机位置: target.x=${this.camera.target.x.toFixed(0)}, target.y=${this.camera.target.y.toFixed(0)}`);
            const charClientX = (this.serverTiles[0]?.[0]?.x || 0) - this.viewportOffsetX + 50; // 估算角色位置
            const charClientY = (this.serverTiles[0]?.[0]?.y || 0) - this.viewportOffsetY + 50;
            console.log(`📍 角色估算位置: (${charClientX}, ${charClientY})`);
        }

        for (const obj of groundObjects) {
            // 直接使用服务器坐标，不需要转换
            // 物品的 x, y 就是世界坐标
            const worldX = obj.x;
            const worldY = obj.y;
            const pixelX = worldX * TILE_SIZE - OFFSET;
            const pixelY = worldY * TILE_SIZE - OFFSET;

            if (groundObjects.indexOf(obj) < 3) {
                console.log(`📍 物品坐标: 世界(${worldX}, ${worldY}) -> 像素(${pixelX.toFixed(0)}, ${pixelY.toFixed(0)})`);
            }

            // 传递像素坐标给 addGroundObject（Y轴微调：0像素）
            this.addGroundObjectByPixel(pixelX, pixelY, obj.type, obj.durability, obj.maxDurability, obj.berryCount, obj.maxBerries, obj.hasBerries);
        }
        console.log(`📦 从服务器渲染了 ${groundObjects.length} 个物品`);
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
                this.addGroundObject(obj.x, obj.y, obj.type, obj.durability, obj.maxDurability, obj.berryCount, obj.maxBerries, obj.hasBerries);
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
                // 使用服务器地形数据
                const serverX = x - this.viewportOffsetX;
                const serverY = y - this.viewportOffsetY;

                let terrainType: string;
                if (this.serverTiles && this.serverTiles[serverY] && this.serverTiles[serverY][serverX]) {
                    terrainType = this.serverTiles[serverY][serverX].type;
                } else {
                    continue; // 超出服务器数据范围，跳过
                }

                const rand = seededRandom(this.worldSeed, x, y);

                // 森林：树 (100%生成)
                if (terrainType === 'forest') {
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

    private addGroundObject(x: number, y: number, type: string, durability?: number, maxDurability?: number, berryCount?: number, maxBerries?: number, hasBerries?: boolean) {
        // 服务器发送的物品类型到纹理的映射
        const serverItemTextureMap: Record<string, string> = {
            'rock': 'stone',  // 服务器rock -> 客户端stone纹理
            'shell': 'rock'   // 服务器shell -> 暂时用石头代替（等素材）
        };

        // 映射服务器类型到客户端纹理类型
        const textureKey = serverItemTextureMap[type] || type;

        const tex = this.textures.get(textureKey);
        if (!tex) {
            console.log(`❌ 找不到物品纹理: ${type} -> ${textureKey}`);
            return;
        }

        const container = new PIXI.Container();

        const sprite = new PIXI.Sprite(tex);
        // 森林树和果树比格子大1/3
        const size = (type === 'tree' || type === 'forest_tree' || type === 'tree_fruit') ? TILE_SIZE * 1.33 : SCALED_SIZE;
        sprite.width = size;
        sprite.height = size;
        // 不设置 anchor，保持与地形一致（左上角对齐）
        container.addChild(sprite);

        // 创建物品数据（保存格子坐标用于显示）
        const itemData: ItemData = {
            type: type,
            x: x,
            y: y,
            layer: 'ground',
            durability: durability,
            maxDurability: maxDurability,
            berryCount: berryCount,
            maxBerries: maxBerries,
            hasBerries: hasBerries
        };

        // 创建点击热区（覆盖整个格子，从左上角开始）
        const hitbox = new PIXI.Graphics();
        hitbox.rect(0, 0, ITEM_HITBOX_SIZE, ITEM_HITBOX_SIZE);
        hitbox.fill({ color: 0xffffff, alpha: 0.001 });
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';

        // 点击事件
        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            console.log('🖱️ 点击物品(addGroundObject):', itemData.type, '坐标:', itemData.x, itemData.y);
            this.showItemStatus(itemData);
        });

        container.addChild(hitbox);

        // 设置位置（与地形对齐）
        container.x = x * TILE_SIZE - OFFSET;
        container.y = y * TILE_SIZE - OFFSET;
        container.zIndex = 2; // 在地形上面，角色下面

        this.worldContainer.addChild(container);

        // 保存物品数据和精灵
        const itemKey = `${x},${y},${type}`;
        this.itemSprites.set(itemKey, container);
        (container as any).itemData = itemData;

        this.groundObjects.push(container);
    }

    // 像素坐标版本的 addGroundObject
    private addGroundObjectByPixel(pixelX: number, pixelY: number, type: string, durability?: number, maxDurability?: number, berryCount?: number, maxBerries?: number, hasBerries?: boolean) {
        const serverItemTextureMap: Record<string, string> = {
            'rock': 'stone',
            'shell': 'rock'
        };

        const textureKey = serverItemTextureMap[type] || type;
        const tex = this.textures.get(textureKey);
        if (!tex) {
            console.log(`❌ 找不到物品纹理: ${type} -> ${textureKey}`);
            return;
        }

        const container = new PIXI.Container();

        const sprite = new PIXI.Sprite(tex);
        const size = (type === 'tree' || type === 'forest_tree' || type === 'tree_fruit') ? TILE_SIZE * 1.33 : SCALED_SIZE;
        sprite.width = size;
        sprite.height = size;
        container.addChild(sprite);

        // 从像素坐标计算世界坐标
        const worldX = Math.round((pixelX + OFFSET) / TILE_SIZE);
        const worldY = Math.round((pixelY + OFFSET) / TILE_SIZE);

        const itemData: ItemData = {
            type: type,
            x: worldX,
            y: worldY,
            layer: 'ground',
            durability: durability,
            maxDurability: maxDurability,
            berryCount: berryCount,
            maxBerries: maxBerries,
            hasBerries: hasBerries
        };

        const hitbox = new PIXI.Graphics();
        hitbox.rect(0, 0, ITEM_HITBOX_SIZE, ITEM_HITBOX_SIZE);
        hitbox.fill({ color: 0xffffff, alpha: 0.001 });
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';

        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            console.log('🖱️ 点击物品:', itemData.type, '坐标:', itemData.x, itemData.y);
            this.showItemStatus(itemData);
        });

        container.addChild(hitbox);

        // 直接使用像素坐标
        container.x = pixelX;
        container.y = pixelY;
        container.zIndex = 2;

        this.worldContainer.addChild(container);
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

    /**
     * 相机居中显示所有角色
     * @param characters 角色列表
     */
    private cameraCenterOnAll(characters: ServerCharacter[]) {
        if (!characters || characters.length === 0) return;

        // 过滤出有效位置的角色
        const validChars = characters.filter(c => c.x !== null && c.y !== null);
        if (validChars.length === 0) return;

        // 计算所有角色的边界框
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const char of validChars) {
            if (char.x !== null && char.y !== null) {
                minX = Math.min(minX, char.x);
                maxX = Math.max(maxX, char.x);
                minY = Math.min(minY, char.y);
                maxY = Math.max(maxY, char.y);
            }
        }

        // 计算中心点
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const scale = this.camera.scale;
        // 居中到角色位置（与地形对齐）
        this.camera.target.x = window.innerWidth / 2 - (centerX * TILE_SIZE - OFFSET) * scale;
        this.camera.target.y = window.innerHeight / 2 - (centerY * TILE_SIZE - OFFSET) * scale;
    }

    private cameraFollow(char: ServerCharacter) {
        if (char.x === null || char.y === null) return;

        const scale = this.camera.scale;
        // 居中到角色位置（与地形对齐）
        this.camera.target.x = window.innerWidth / 2 - (char.x * TILE_SIZE - OFFSET) * scale;
        this.camera.target.y = window.innerHeight / 2 - (char.y * TILE_SIZE - OFFSET) * scale;
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
            // 存储目标位置（用于平滑插值，与地形对齐）
            this.characterTargets.set(data.id, {
                x: data.x * TILE_SIZE - OFFSET,
                y: data.y * TILE_SIZE - OFFSET
            });
        }
        container.zIndex = 10;

        // 根据角色状态显示文字（与单机版一致）
        const hunger = data.needs?.hunger ?? 50;
        const thirst = data.needs?.thirst ?? 50;
        const energy = data.needs?.energy ?? 50;

        // 优先显示动作状态，动作结束再看需求
        let statusText = '🚶巡逻';
        if (data.action === 'drinking') statusText = '💧饮水';
        else if (data.action === 'eating') statusText = '🍖进食';
        else if (data.action === 'resting') statusText = '💤休息';
        else if (data.action === 'idle') statusText = '🧘待机';
        else if (data.action === 'seeking_food') statusText = '🔍找食物';
        else if (data.action === 'seeking_water') statusText = '💧找水';
        else if (data.action === 'gathering') statusText = '🫐采集';
        else if (data.action === 'wandering') statusText = '🚶巡逻';
        else if (thirst < 30) statusText = '很渴';
        else if (hunger < 30) statusText = '很饿';
        else if (thirst < 50) statusText = '口渴';
        else if (hunger < 50) statusText = '饥饿';
        else if (energy < 20) statusText = '疲惫';

        // 只在状态变化时更新标签（避免频繁更新导致卡顿）
        const newLabel = `${data.name}: ${statusText}`;
        const cachedLabel = this.characterLabelCache.get(data.id);
        if (cachedLabel !== newLabel) {
            this.characterLabelCache.set(data.id, newLabel);
            (container as any).label.text = newLabel;
        }

        // 进度条更新 - 只有在有进度且动作是进行中时才显示
        const progressBar = (container as any).progressBar as PIXI.Graphics;
        const timer = data.actionTimer ?? 0;
        const timerMax = data.actionTimerMax ?? 1;
        const hasProgress = timer > 0 && timerMax > 0;

        // 显示进度的动作类型
        const progressActions = ['eating', 'drinking', 'gathering', 'resting'];

        if (hasProgress && progressActions.includes(data.action)) {
            const progress = 1 - (timer / timerMax); // 0到1
            const barWidth = 40;
            const barHeight = 6;
            const fillWidth = barWidth * progress;

            progressBar.clear();
            progressBar.visible = true;

            // 背景条（灰色）
            progressBar.rect(-barWidth / 2, 0, barWidth, barHeight);
            progressBar.fill({ color: 0x555555 });

            // 前景条（绿色）
            progressBar.rect(-barWidth / 2, 0, fillWidth, barHeight);
            progressBar.fill({ color: 0x00ff00 });
        } else {
            progressBar.visible = false;
        }
    }

    private createCharacterSprite(data: ServerCharacter) {
        const container = new PIXI.Container();
        container.eventMode = 'static';
        container.cursor = 'pointer';

        const texKey = data.type === 'adam' ? 'adam' : 'eve';
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
            body.fill(data.type === 'adam' ? 0x4169E1 : 0xFF69B4);
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

        // 动作进度条 - 默认隐藏
        const progressBar = new PIXI.Graphics();
        progressBar.visible = false;
        progressBar.y = -50; // 在标签上方
        container.addChild(progressBar);
        (container as any).progressBar = progressBar;

        // 点击区域 - 透明热区 (使用路径API)
        // 注意：rect 在 (0,0) 位置，因为后面会设置 container.x/y
        const hitbox = new PIXI.Graphics();
        hitbox.rect(-HITBOX_SIZE / 2, -HITBOX_SIZE / 2, HITBOX_SIZE, HITBOX_SIZE);
        hitbox.fill({ color: 0xffffff, alpha: 0.001 });
        hitbox.eventMode = 'static';
        hitbox.cursor = 'pointer';

        // 点击事件 - 向服务器请求完整数据（含DNA）
        hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            event.stopPropagation();
            this.server.selectCharacter(data.id);
        });

        // 调试：打印 hitbox 信息
        console.log(`🎯 创建角色热区: ${data.name}, hitbox尺寸: ${HITBOX_SIZE}x${HITBOX_SIZE}`);

        container.addChild(hitbox);
        (container as any).hitbox = hitbox;

        return container;
    }

    // ===== 移动端触摸控制 =====
    private setupMobileControls(canvas: HTMLCanvasElement) {
        // 触摸状态
        let isTouchDragging = false;
        let isPinching = false;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let lastPinchDistance = 0;
        let lastPinchCenterX = 0;
        let lastPinchCenterY = 0;

        // 阻止默认触摸行为
        canvas.style.touchAction = 'none';

        canvas.addEventListener('touchstart', (e: TouchEvent) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                // 单指触摸 - 开始拖动
                isTouchDragging = true;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // 双指触摸 - 开始缩放
                isTouchDragging = false;
                isPinching = true;

                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
                lastPinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                lastPinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e: TouchEvent) => {
            e.preventDefault();

            if (e.touches.length === 1 && isTouchDragging) {
                // 单指拖动地图
                const touch = e.touches[0];
                const dx = touch.clientX - lastTouchX;
                const dy = touch.clientY - lastTouchY;

                this.camera.target.x += dx;
                this.camera.target.y += dy;

                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;

                this.camera.clamp();

            } else if (e.touches.length === 2 && isPinching) {
                // 双指缩放
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];

                const dx = touch2.clientX - touch1.clientX;
                const dy = touch2.clientY - touch1.clientY;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);
                const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
                const currentCenterY = (touch1.clientY + touch2.clientY) / 2;

                // 计算缩放比例
                const scaleChange = currentDistance / lastPinchDistance;
                const newScale = Math.max(0.15, Math.min(6, this.camera.scale * scaleChange));

                // 以双指中心点为基准缩放
                if (newScale !== this.camera.scale) {
                    const worldX = (currentCenterX - this.camera.target.x) / this.camera.scale;
                    const worldY = (currentCenterY - this.camera.target.y) / this.camera.scale;

                    this.camera.target.scale.set(newScale);
                    this.camera.scale = newScale;

                    this.camera.target.x = currentCenterX - worldX * newScale;
                    this.camera.target.y = currentCenterY - worldY * newScale;

                    this.camera.clamp();
                }

                lastPinchDistance = currentDistance;
                lastPinchCenterX = currentCenterX;
                lastPinchCenterY = currentCenterY;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e: TouchEvent) => {
            e.preventDefault();

            if (e.touches.length === 0) {
                isTouchDragging = false;
                isPinching = false;
            } else if (e.touches.length === 1) {
                // 从双指切换到单指
                isPinching = false;
                isTouchDragging = true;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        }, { passive: false });

        console.log('📱 移动端触摸控制已启用');
    }

    private setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            const step = 5;
            
            console.log(`⌨️ keydown: ${key}, before: camera.target.y=${this.camera.target.y.toFixed(0)}`);

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
            
            // 请求新视口数据
            this.requestViewportUpdate();
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

        // 缓存DOM元素引用
        this.statusPanelCache = {
            name: document.getElementById('panel-name') ?? undefined,
            type: document.getElementById('panel-type') ?? undefined,
            avatar: document.getElementById('panel-avatar') ?? undefined,
            position: document.getElementById('panel-position') ?? undefined,
            foodBar: document.getElementById('panel-food-bar') ?? undefined,
            waterBar: document.getElementById('panel-water-bar') ?? undefined,
            energyBar: document.getElementById('panel-energy-bar') ?? undefined,
            foodVal: document.getElementById('panel-food-val') ?? undefined,
            waterVal: document.getElementById('panel-water-val') ?? undefined,
            energyVal: document.getElementById('panel-energy-val') ?? undefined,
            healthBar: document.getElementById('panel-health-bar') ?? undefined,
            healthVal: document.getElementById('panel-health-val') ?? undefined,
            action: document.getElementById('panel-action') ?? undefined,
            dnaAttrs: document.getElementById('panel-dna-attrs') ?? undefined,
            statusIcon: document.getElementById('status-icon') ?? undefined,
        };

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
            const hunger = char.needs?.hunger ?? 50;
            const thirst = char.needs?.thirst ?? 50;
            const energy = char.needs?.energy ?? 50;

            let statusIcon = '🚶';
            // 优先显示动作状态，动作结束再看需求
            if (char.action === 'drinking') statusIcon = '💧饮水';
            else if (char.action === 'eating') statusIcon = '🍖进食';
            else if (char.action === 'resting') statusIcon = '💤休息';
            else if (char.action === 'idle') statusIcon = '🧘待机';
            else if (char.action === 'seeking_food') statusIcon = '🔍找食物';
            else if (char.action === 'seeking_water') statusIcon = '💧找水';
            else if (char.action === 'gathering') statusIcon = '🫐采集';
            else if (char.action === 'wandering') statusIcon = '🚶巡逻';
            else if (thirst < 30) statusIcon = '💧很渴';
            else if (hunger < 30) statusIcon = '🍖很饿';
            else if (thirst < 50) statusIcon = '💧口渴';
            else if (hunger < 50) statusIcon = '🍖饥饿';
            else if (energy < 20) statusIcon = '😴疲惫';

            // 使用缓存的DOM元素更新
            const c = this.statusPanelCache;
            if (c.statusIcon) c.statusIcon.textContent = statusIcon;
            if (c.name) c.name.textContent = char.name;
            if (c.type) c.type.textContent = char.id === 'adam' ? '亚当' : '夏娃';
            if (c.avatar) {
                c.avatar.className = `avatar ${char.id === 'adam' ? 'adam' : 'eve'}`;
                c.avatar.textContent = char.id === 'adam' ? '♂' : '♀';
            }
            if (c.position) c.position.textContent = `(${char.x.toFixed(1)}, ${char.y.toFixed(1)})`;

            const hungerKcal = char.needs?.hunger ?? 2000;
            const hungerPct = Math.min(100, Math.round((hungerKcal / 2000) * 100));
            const thirstPct = Math.min(100, Math.round(char.needs?.thirst ?? 50));
            const energyPct = Math.round(char.needs?.energy ?? 50);

            if (c.foodBar) c.foodBar.style.width = `${hungerPct}%`;
            if (c.waterBar) c.waterBar.style.width = `${thirstPct}%`;
            if (c.energyBar) c.energyBar.style.width = `${energyPct}%`;
            if (c.foodVal) c.foodVal.textContent = `${Math.round(hungerKcal)} kcal`;
            if (c.waterVal) c.waterVal.textContent = `${thirstPct}%`;
            if (c.energyVal) c.energyVal.textContent = `${energyPct}%`;

            if (c.healthBar) c.healthBar.style.width = '100%';
            if (c.healthVal) c.healthVal.textContent = '100%';
            // 行动文字：映射服务器状态值到显示文字
            if (c.action) {
                const actionText = ACTION_TEXT[char.action] || char.action || '闲置';
                c.action.textContent = actionText;
            }

            // DNA属性 - 只在DNA变化时重建HTML
            if (c.dnaAttrs && char.dna) {
                const dna = char.dna;
                const dnaStr = JSON.stringify(dna);
                if (dnaStr !== this.lastDnaStr) {
                    this.lastDnaStr = dnaStr;
                    const lifespanText = `${Math.round((dna.lifespan / 1200) * 70)}岁`;
                    c.dnaAttrs.innerHTML = `
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
            }

            // 背包数据
            if (char.inventory) {
                const inv = char.inventory;
                // 第一个格子显示浆果
                const slot0 = document.getElementById('slot-0-count');
                if (slot0) slot0.textContent = String(inv.berries);
                // 更新热量
                const calElem = document.getElementById('inventory-calories');
                if (calElem) calElem.textContent = String(Math.round(inv.totalCalories || 0));
            }

            // 显示面板
            this.statusPanel.style.cssText = 'display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999;';
        }, 50);
    }

    private lastTimeUpdate: any = null;       // 上次收到的时间数据
    private lastTimeUpdateMs: number = 0;    // 上次收到时间戳（毫秒）
    private timePredictionInterval: number = 0; // 预测更新定时器
    
    private lastServerTime: any = null;      // 上次服务器时间
    private lastServerTimeMs: number = 0;   // 上次收到服务器时间戳（毫秒）
    
    private setupTimePanel() {
        // 时间面板已通过HTML静态添加，这里只需设置事件监听
        // 监听服务器时间更新（每游戏小时 = 1真实分钟）
        this.server.on('time_update', (data: any) => {
            this.onServerTimeUpdate(data);
        });
        
        // 监听季节变化
        this.server.on('season_changed', (data: any) => {
            this.onServerTimeUpdate(data);
        });
        
        // 客户端驱动：每秒更新时间
        window.setInterval(() => {
            this.driveTimeUpdate();
        }, 1000);
        
        console.log('⏰ 时间面板初始化完成');
    }
    
    /**
     * 收到服务器时间更新
     */
    private onServerTimeUpdate(data: any) {
        if (!data) return;
        
        // time_update消息数据直接在顶层，type也在顶层
        // init消息数据在data.data中
        const timeData = data.type === 'time_update' ? data : (data.data || data);
        
        // 检查季节是否变化
        const newSeason = timeData.season;
        if (newSeason && newSeason !== this.currentSeason) {
            console.log(`🌿 季节变化: ${this.currentSeason} → ${newSeason}`);
            this.currentSeason = newSeason;
            // 刷新所有地形精灵以更新季节纹理
            this.terrainSprites.forEach(sprite => sprite.destroy());
            this.terrainSprites.clear();
            // 刷新地面物品精灵
            this.groundObjects.forEach(sprite => sprite.destroy());
            this.groundObjects.length = 0;
            this.groundObjectsRendered = false;
            // 重新渲染地形
            this.renderTerrain();
            // 重新渲染物品
            if (this.lastGroundObjects && this.lastGroundObjects.length > 0) {
                this.renderGroundObjectsFromServer(this.lastGroundObjects);
            }
        }
        
        // 保存服务器时间
        this.lastServerTime = { ...timeData };
        this.lastServerTimeMs = Date.now();
        
        // 立即更新显示
        this.refreshTimeDisplay(this.lastServerTime);
    }
    
    /**
     * 客户端驱动时间前进（每秒调用）
     */
    private driveTimeUpdate() {
        if (!this.lastServerTime) return;
        
        const now = Date.now();
        const elapsedMs = now - this.lastServerTimeMs;
        const elapsedSeconds = elapsedMs / 1000;
        
        // 游戏分钟增量 = 真实秒数 * 每真实秒对应的游戏分钟数
        const gameMinutesPerRealSecond = this.lastServerTime.gameMinutesPerRealSecond || 1;
        const totalGameMinutes = this.lastServerTime.minute + Math.floor(elapsedSeconds * gameMinutesPerRealSecond);
        
        // 分离小时和分钟
        const gameMinutesInHour = totalGameMinutes % 60;
        const hoursAdded = Math.floor(totalGameMinutes / 60);
        let newHour = (this.lastServerTime.hour + hoursAdded) % 24;
        let newDay = this.lastServerTime.day + Math.floor((this.lastServerTime.hour + hoursAdded) / 24);
        let newYear = this.lastServerTime.year;
        
        // 跨天处理
        if (newDay > 12) { // 1年=12天
            newDay = newDay - 12;
            newYear = this.lastServerTime.year + 1;
        }
        
        // 更新显示
        const dateEl = document.getElementById('time-date');
        const seasonEl = document.getElementById('time-season');
        
        if (dateEl) {
            dateEl.textContent = `📅 ${newYear}年${newDay}日`;
        }
        
        if (seasonEl) {
            const seasonEmoji = this.lastServerTime.seasonEmoji || '🌸';
            const seasonName = this.lastServerTime.seasonName || '春';
            const periodEmoji = this.lastServerTime.periodEmoji || '☀️';
            const timeStr = `${String(newHour).padStart(2, '0')}:${String(gameMinutesInHour).padStart(2, '0')}`;
            seasonEl.innerHTML = `${seasonEmoji} ${seasonName} ${periodEmoji} ${timeStr}`;
        }
    }
    
    /**
     * 刷新时间显示（立即使用服务器数据）
     */
    private refreshTimeDisplay(timeData: any) {
        const dateEl = document.getElementById('time-date');
        const seasonEl = document.getElementById('time-season');
        
        if (!dateEl || !seasonEl || !timeData) return;
        
        const year = timeData.year || 1;
        const day = timeData.day || 1;
        dateEl.textContent = `📅 ${year}年${day}日`;
        
        const seasonEmoji = timeData.seasonEmoji || '🌸';
        const seasonName = timeData.seasonName || '春';
        const periodEmoji = timeData.periodEmoji || '☀️';
        const hour = timeData.hour || 0;
        const minute = timeData.minute || 0;
        
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        seasonEl.innerHTML = `${seasonEmoji} ${seasonName} ${periodEmoji} ${timeStr}`;
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

    // 更新角色状态面板（从服务器状态同步）
    private updateStatusPanel(char: ServerCharacter) {
        if (!this.statusPanel || !this.selectedCharacter) return;

        // 根据角色状态获取状态图标
        const hunger = char.needs?.hunger ?? 50;
        const thirst = char.needs?.thirst ?? 50;
        const energy = char.needs?.energy ?? 50;

        let statusIcon = '🚶';
        // 优先显示动作状态，动作结束再看需求
        if (char.action === 'drinking') statusIcon = '💧饮水';
        else if (char.action === 'eating') statusIcon = '🍖进食';
        else if (char.action === 'resting') statusIcon = '💤休息';
        else if (char.action === 'idle') statusIcon = '🧘待机';
        else if (char.action === 'seeking_food') statusIcon = '🔍找食物';
        else if (char.action === 'seeking_water') statusIcon = '💧找水';
        else if (char.action === 'gathering') statusIcon = '🫐采集';
        else if (char.action === 'wandering') statusIcon = '🚶巡逻';
        else if (thirst < 30) statusIcon = '💧很渴';
        else if (hunger < 30) statusIcon = '🍖很饿';
        else if (thirst < 50) statusIcon = '💧口渴';
        else if (hunger < 50) statusIcon = '🍖饥饿';
        else if (energy < 20) statusIcon = '😴疲惫';

        // 更新状态图标
        const statusIconElem = document.getElementById('status-icon');
        if (statusIconElem) statusIconElem.textContent = statusIcon;

        // 更新位置
        const posElem = document.getElementById('panel-position');
        if (posElem) posElem.textContent = `(${char.x.toFixed(1)}, ${char.y.toFixed(1)})`;

        // 更新需求条 - 饥饿(kcal) / 口渴(百分比)
        const hungerKcal = char.needs?.hunger ?? 2000;
        const hungerPct = Math.min(100, Math.round((hungerKcal / 2000) * 100));
        const thirstPct = Math.min(100, Math.round(char.needs?.thirst ?? 50));
        const energyPct = Math.round(char.needs?.energy ?? 50);

        const foodBar = document.getElementById('panel-food-bar');
        const waterBar = document.getElementById('panel-water-bar');
        const energyBar = document.getElementById('panel-energy-bar');
        const foodVal = document.getElementById('panel-food-val');
        const waterVal = document.getElementById('panel-water-val');
        const energyVal = document.getElementById('panel-energy-val');

        if (foodBar) foodBar.style.width = `${hungerPct}%`;
        if (waterBar) waterBar.style.width = `${thirstPct}%`;
        if (energyBar) energyBar.style.width = `${energyPct}%`;
        if (foodVal) foodVal.textContent = `${Math.round(hungerKcal)} kcal`;
        if (waterVal) waterVal.textContent = `${thirstPct}%`;
        if (energyVal) energyVal.textContent = `${energyPct}%`;

        // 更新行动
        const actionElem = document.getElementById('panel-action');
        if (actionElem) actionElem.textContent = ACTION_TEXT[char.action] || char.action || '闲置';

        // 更新背包
        if (char.inventory) {
            const inv = char.inventory;
            const slot0 = document.getElementById('slot-0-count');
            if (slot0) slot0.textContent = String(inv.berries);
            const calElem = document.getElementById('inventory-calories');
            if (calElem) calElem.textContent = String(Math.round(inv.totalCalories || 0));
        }
    }

    private setupItemStatusUI() {
        this.itemStatusUI = new ItemStatusUI();
    }

    // Latency Compensation: 处理地图点击，发送移动输入
    private handleMapClick(screenX: number, screenY: number) {
        // 观察模式：点击地图显示位置信息，但不移动角色
        try {
            if (!this.camera || !this.camera.target) {
                return;
            }
            const worldX = (screenX - this.camera.target.x) / this.camera.scale;
            const worldY = (screenY - this.camera.target.y) / this.camera.scale;
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
        token = localStorage.getItem('eden_token');
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
