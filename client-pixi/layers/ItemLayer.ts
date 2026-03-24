/**
 * 物品层 - 支持耐久和季节
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';

export type ItemType = 'tree' | 'bush' | 'rock' | 'stick' | 'berry' | 'flower' | 'branch';
export type ItemLayerType = 'ground' | 'low' | 'high';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const TILE_SIZE = 64;

export class GameItem {
    type: ItemType;
    x: number;
    y: number;
    layer: ItemLayerType;
    
    // 耐久相关（用于灌木/浆果丛）
    durability: number = 0;
    maxDurability: number = 0;
    
    constructor(type: ItemType, x: number, y: number, layer: ItemLayerType) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.layer = layer;
    }
    
    // 获取物品名称
    getName(): string {
        const names: Record<ItemType, string> = {
            'tree': '树',
            'bush': '灌木',
            'rock': '石头',
            'stick': '木棍',
            'berry': '浆果丛',
            'flower': '花朵',
            'branch': '树枝'
        };
        return names[this.type] || '未知物品';
    }
    
    // 是否还有资源
    hasResources(): boolean {
        return this.durability > 0;
    }
    
    // 采集（返回采集数量）
    harvest(amount: number = 1): number {
        if (this.durability <= 0) return 0;
        const harvested = Math.min(this.durability, amount);
        this.durability -= harvested;
        return harvested;
    }
}

export class ItemLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private items: GameItem[] = [];
    private sprites: Map<GameItem, PIXI.Sprite> = new Map();
    private hitboxes: Map<GameItem, PIXI.Graphics> = new Map();
    private textureCache: Map<string, PIXI.Texture> = new Map();
    private currentSeason: Season = 'summer'; // 默认夏天
    
    // 点击回调
    public onItemClick: ((item: GameItem) => void) | null = null;
    
    // 物品贴图（按季节）
    private readonly ASSETS: Record<ItemType, Record<Season, string>> = {
        'tree': {
            spring: 'img/树.png',
            summer: 'img/树.png',
            autumn: 'img/树.png',
            winter: 'img/树冬.png'
        },
        'bush': {
            spring: 'img/灌木花.png',
            summer: 'img/灌木果.png',
            autumn: 'img/灌木果.png',
            winter: 'img/灌木冬.png'
        },
        'rock': {
            spring: 'img/石头.png',
            summer: 'img/石头.png',
            autumn: 'img/石头.png',
            winter: 'img/石头.png'
        },
        'stick': {
            spring: 'img/木棍.png',
            summer: 'img/木棍.png',
            autumn: 'img/木棍.png',
            winter: 'img/木棍.png'
        },
        'berry': {
            spring: 'img/灌木花.png',
            summer: 'img/灌木果.png',
            autumn: 'img/灌木果.png',
            winter: 'img/灌木冬.png'
        },
        'flower': {
            spring: 'img/花.png',
            summer: 'img/花.png',
            autumn: 'img/花.png',
            winter: 'img/花.png'
        },
        'branch': {
            spring: 'img/树枝.png',
            summer: 'img/树枝.png',
            autumn: 'img/树枝.png',
            winter: 'img/树枝.png'
        }
    };
    
    private readonly SIZES: Record<ItemLayerType, number> = {
        'ground': 40,
        'low': 48,
        'high': 64,
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
    }
    
    // 设置季节
    setSeason(season: Season): void {
        this.currentSeason = season;
        
        // 季节性物品管理
        if (season === 'spring') {
            // 春天：生成花朵（如果还没有）
            this.generateSeasonalItems();
        } else {
            // 其他季节：删除花朵
            this.removeSeasonalItems();
        }
        
        this.updateAllSprites();
    }
    
    // 生成季节性物品（春天生成花朵）
    private generateSeasonalItems(): void {
        // 检查是否已有花朵
        const hasFlowers = this.items.some(i => i.type === 'flower');
        if (hasFlowers) return;
        
        console.log('🌸 春天生成花朵...');
        const mapSize = this.map.getSize();
        let count = 0;
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const rand = Math.random();
                
                // 草地上5%概率生成花朵
                if (tile.type === TileType.GRASS && rand < 0.05) {
                    const item = new GameItem('flower', x, y, 'ground');
                    this.items.push(item);
                    this.createSprite(item);
                    count++;
                }
                // 平地上2%概率生成花朵
                else if (tile.type === TileType.PLAIN && rand < 0.02) {
                    const item = new GameItem('flower', x, y, 'ground');
                    this.items.push(item);
                    this.createSprite(item);
                    count++;
                }
            }
        }
        
        console.log(`🌸 生成了 ${count} 朵花`);
    }
    
    // 删除季节性物品（其他季节删除花朵）
    private removeSeasonalItems(): void {
        const flowers = this.items.filter(i => i.type === 'flower');
        if (flowers.length === 0) return;
        
        console.log(`🍃 移除 ${flowers.length} 朵花...`);
        
        for (const flower of flowers) {
            // 移除精灵
            const sprite = this.sprites.get(flower);
            if (sprite) {
                this.container.removeChild(sprite);
                sprite.destroy();
                this.sprites.delete(flower);
            }
            // 移除点击区域
            const hitbox = this.hitboxes.get(flower);
            if (hitbox) {
                this.container.removeChild(hitbox);
                hitbox.destroy();
                this.hitboxes.delete(flower);
            }
            // 从数组中移除
            const index = this.items.indexOf(flower);
            if (index > -1) {
                this.items.splice(index, 1);
            }
        }
    }
    
    async init(): Promise<void> {
        this.generateItems();
        await this.loadTextures();
        this.render();
    }
    
    private generateItems(): void {
        const mapSize = this.map.getSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const rand = Math.random();
                
                switch (tile.type) {
                    case TileType.FOREST:
                        if (rand < 0.12) {
                            const item = new GameItem('tree', x, y, 'high');
                            this.items.push(item);
                        }
                        else if (rand < 0.25) {
                            const item = new GameItem('bush', x, y, 'low');
                            // 灌木有耐久（10-20）
                            item.maxDurability = 10 + Math.floor(Math.random() * 11);
                            item.durability = item.maxDurability;
                            this.items.push(item);
                        }
                        else if (rand < 0.30) {
                            const item = new GameItem('branch', x, y, 'ground');
                            item.maxDurability = 1 + Math.floor(Math.random() * 3);
                            item.durability = item.maxDurability;
                            this.items.push(item);
                        }
                        break;
                    case TileType.GRASS:
                        // 花朵在春天动态生成
                        if (rand < 0.08) {
                            const item = new GameItem('bush', x, y, 'low');
                            item.maxDurability = 8 + Math.floor(Math.random() * 9);
                            item.durability = item.maxDurability;
                            this.items.push(item);
                        }
                        break;
                    case TileType.PLAIN:
                        if (rand < 0.15) this.items.push(new GameItem('stick', x, y, 'ground'));
                        else if (rand < 0.26) {
                            const item = new GameItem('branch', x, y, 'ground');
                            item.maxDurability = 1 + Math.floor(Math.random() * 2);
                            item.durability = item.maxDurability;
                            this.items.push(item);
                        }
                        break;
                    case TileType.HILL:
                        if (rand < 0.08) this.items.push(new GameItem('rock', x, y, 'ground'));
                        else if (rand < 0.15) {
                            const item = new GameItem('bush', x, y, 'low');
                            item.maxDurability = 5 + Math.floor(Math.random() * 6);
                            item.durability = item.maxDurability;
                            this.items.push(item);
                        }
                        break;
                    case TileType.MOUNTAIN:
                        if (rand < 0.10) this.items.push(new GameItem('rock', x, y, 'ground'));
                        break;
                }
            }
        }
        
        console.log(`📦 生成了 ${this.items.length} 个物品`);
        const bushes = this.items.filter(i => i.type === 'bush');
        console.log(`🌿 其中 ${bushes.length} 个灌木`);
    }
    
    private async loadTextures(): Promise<void> {
        // 加载所有季节的所有物品纹理
        const toLoad: string[] = [];
        const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
        
        for (const type of Object.keys(this.ASSETS)) {
            for (const season of seasons) {
                const path = this.ASSETS[type as ItemType][season];
                if (!toLoad.includes(path)) {
                    toLoad.push(path);
                }
            }
        }
        
        for (const path of toLoad) {
            try {
                const texture = await PIXI.Assets.load(path);
                this.textureCache.set(path, texture);
            } catch (e) {
                console.warn(`Failed to load: ${path}`);
            }
        }
        
        console.log(`✅ 加载了 ${this.textureCache.size} 个物品纹理`);
    }
    
    // 获取物品贴图
    private getTexture(item: GameItem): PIXI.Texture | null {
        let path: string;
        
        if (item.type === 'bush') {
            // 灌木：根据季节和耐久决定贴图
            if (this.currentSeason === 'winter') {
                path = this.ASSETS.bush.winter;
            } else if (this.currentSeason === 'spring') {
                path = this.ASSETS.bush.spring;
            } else {
                // 夏秋：有耐久显示果，否则显示普通
                path = item.durability > 0 ? this.ASSETS.bush.summer : 'img/灌木.png';
            }
        } else if (item.type === 'flower') {
            // 花朵：只在春天显示
            if (this.currentSeason === 'spring') {
                path = this.ASSETS.flower.spring;
            } else {
                return null; // 其他季节不显示
            }
        } else {
            path = this.ASSETS[item.type][this.currentSeason];
        }
        
        return this.textureCache.get(path) || null;
    }
    
    private render(): void {
        // 按层级渲染
        for (const layer of ['ground', 'low', 'high'] as ItemLayerType[]) {
            for (const item of this.items.filter(i => i.layer === layer)) {
                this.createSprite(item);
            }
        }
    }
    
    private createSprite(item: GameItem): void {
        const texture = this.getTexture(item);
        if (!texture) return;
        
        const sprite = new PIXI.Sprite(texture);
        const size = this.SIZES[item.layer];
        const pixelX = item.x * TILE_SIZE + TILE_SIZE / 2;
        const pixelY = item.y * TILE_SIZE + TILE_SIZE / 2;
        
        sprite.x = pixelX - size / 2;
        sprite.y = pixelY - size / 2;
        sprite.width = size;
        sprite.height = size;
        
        this.container.addChild(sprite);
        this.sprites.set(item, sprite);
        
        // 添加点击区域（只有有耐久的东西才能点击）
        if (item.maxDurability > 0) {
            const hitbox = new PIXI.Graphics();
            hitbox.beginFill(0xffffff, 0.001);
            hitbox.drawRect(0, 0, size, size);
            hitbox.endFill();
            hitbox.x = sprite.x;
            hitbox.y = sprite.y;
            hitbox.eventMode = 'static';
            hitbox.cursor = 'pointer';
            hitbox.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                e.stopPropagation();
                if (this.onItemClick) {
                    this.onItemClick(item);
                }
            });
            this.container.addChild(hitbox);
            this.hitboxes.set(item, hitbox);
        }
    }
    
    // 更新所有物品贴图（季节变化时调用）
    private updateAllSprites(): void {
        for (const [item, sprite] of this.sprites) {
            const texture = this.getTexture(item);
            if (texture) {
                sprite.texture = texture;
            }
        }
    }
    
    // 更新单个物品（采集后调用）
    updateItem(item: GameItem): void {
        const sprite = this.sprites.get(item);
        const hitbox = this.hitboxes.get(item);
        if (!sprite) return;
        
        const texture = this.getTexture(item);
        if (texture) {
            sprite.texture = texture;
            sprite.visible = true;
        } else {
            sprite.visible = false; // 季节性隐藏（如夏天的花）
        }
        
        // 如果耐久为0，移除点击区域
        if (hitbox) {
            hitbox.visible = item.durability > 0 && sprite.visible;
        }
    }
    
    // 获取所有物品
    getItems(): GameItem[] {
        return this.items;
    }
    
    // 获取特定类型的物品
    getItemsByType(type: ItemType): GameItem[] {
        return this.items.filter(i => i.type === type);
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
}
