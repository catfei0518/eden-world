/**
 * 物品层
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';

export type ItemType = 'tree' | 'bush' | 'rock' | 'stick' | 'berry' | 'flower' | 'branch';
export type ItemLayer = 'ground' | 'low' | 'high';

const TILE_SIZE = 64;

class Item {
    type: ItemType;
    x: number;
    y: number;
    layer: ItemLayer;
    
    constructor(type: ItemType, x: number, y: number, layer: ItemLayer) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.layer = layer;
    }
}

export class ItemLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private items: Item[] = [];
    private textureCache: Map<string, PIXI.Texture> = new Map();
    
    private readonly ASSETS: Record<ItemType, string> = {
        'tree': 'img/树.png',
        'bush': 'img/灌木.png',
        'rock': 'img/石头.png',
        'stick': 'img/木棍.png',
        'berry': 'img/浆果.png',
        'flower': 'img/花.png',
        'branch': 'img/树枝.png',
    };
    
    private readonly SIZES: Record<ItemLayer, number> = {
        'ground': 40,
        'low': 48,
        'high': 64,
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
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
                        if (rand < 0.12) this.items.push(new Item('tree', x, y, 'high'));
                        else if (rand < 0.22) this.items.push(new Item('bush', x, y, 'low'));
                        else if (rand < 0.28) this.items.push(new Item('branch', x, y, 'ground'));
                        else if (rand < 0.35) this.items.push(new Item('berry', x, y, 'ground'));
                        break;
                    case TileType.GRASS:
                        if (rand < 0.05) this.items.push(new Item('flower', x, y, 'ground'));
                        else if (rand < 0.10) this.items.push(new Item('berry', x, y, 'ground'));
                        else if (rand < 0.13) this.items.push(new Item('branch', x, y, 'ground'));
                        break;
                    case TileType.PLAIN:
                        if (rand < 0.15) this.items.push(new Item('stick', x, y, 'ground'));
                        else if (rand < 0.22) this.items.push(new Item('flower', x, y, 'ground'));
                        else if (rand < 0.28) this.items.push(new Item('branch', x, y, 'ground'));
                        break;
                    case TileType.HILL:
                        if (rand < 0.08) this.items.push(new Item('rock', x, y, 'ground'));
                        else if (rand < 0.14) this.items.push(new Item('bush', x, y, 'low'));
                        else if (rand < 0.18) this.items.push(new Item('branch', x, y, 'ground'));
                        break;
                    case TileType.MOUNTAIN:
                        if (rand < 0.10) this.items.push(new Item('rock', x, y, 'ground'));
                        else if (rand < 0.15) this.items.push(new Item('branch', x, y, 'ground'));
                        break;
                }
            }
        }
    }
    
    private async loadTextures(): Promise<void> {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            try {
                const texture = await PIXI.Assets.load(path);
                this.textureCache.set(type, texture);
            } catch (e) {
                console.warn(`Failed to load item texture: ${path}`);
            }
        }
    }
    
    private render(): void {
        // ground层
        for (const item of this.items.filter(i => i.layer === 'ground')) {
            this.createSprite(item);
        }
        // low层
        for (const item of this.items.filter(i => i.layer === 'low')) {
            this.createSprite(item);
        }
        // high层
        for (const item of this.items.filter(i => i.layer === 'high')) {
            this.createSprite(item);
        }
    }
    
    private createSprite(item: Item): void {
        const texture = this.textureCache.get(item.type);
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
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
}
