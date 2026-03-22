/**
 * 物品渲染系统
 */

import { GameMap, TileType } from '../world/MapGenerator';

export type ItemType = 'tree' | 'bush' | 'rock' | 'stick' | 'berry' | 'flower' | 'branch';
export type ItemLayer = 'ground' | 'low' | 'high';

export class Item {
    type: ItemType;
    x: number;
    y: number;
    layer: ItemLayer;
    pixelX: number;
    pixelY: number;
    
    constructor(type: ItemType, x: number, y: number, layer: ItemLayer) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.layer = layer;
        this.pixelX = x * 64 + 32;
        this.pixelY = y * 64 + 32;
    }
}

export class ItemManager {
    private items: Item[] = [];
    private map: GameMap;
    private textureCache: Map<string, HTMLImageElement> = new Map();
    
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
    }
    
    generate(): void {
        const mapSize = this.map.getSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                this.generateItemsForTile(tile.type, x, y);
            }
        }
        this.loadTextures();
    }
    
    private generateItemsForTile(tileType: TileType, x: number, y: number): void {
        const rand = Math.random();
        
        switch (tileType) {
            case TileType.FOREST:
                if (rand < 0.12) {
                    this.items.push(new Item('tree', x, y, 'high'));
                } else if (rand < 0.22) {
                    this.items.push(new Item('bush', x, y, 'low'));
                } else if (rand < 0.28) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                } else if (rand < 0.35) {
                    this.items.push(new Item('berry', x, y, 'ground'));
                }
                break;
                
            case TileType.GRASS:
                if (rand < 0.05) {
                    this.items.push(new Item('flower', x, y, 'ground'));
                } else if (rand < 0.10) {
                    this.items.push(new Item('berry', x, y, 'ground'));
                } else if (rand < 0.13) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
                
            case TileType.PLAIN:
                if (rand < 0.15) {
                    this.items.push(new Item('stick', x, y, 'ground'));
                } else if (rand < 0.22) {
                    this.items.push(new Item('flower', x, y, 'ground'));
                } else if (rand < 0.28) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
                
            case TileType.HILL:
                if (rand < 0.08) {
                    this.items.push(new Item('rock', x, y, 'ground'));
                } else if (rand < 0.14) {
                    this.items.push(new Item('bush', x, y, 'low'));
                } else if (rand < 0.18) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
                
            case TileType.MOUNTAIN:
                if (rand < 0.10) {
                    this.items.push(new Item('rock', x, y, 'ground'));
                } else if (rand < 0.15) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
        }
    }
    
    private async loadTextures(): Promise<void> {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            await this.loadTexture(type, path);
        }
    }
    
    private loadTexture(type: string, path: string): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.textureCache.set(type, img); resolve(); };
            img.onerror = () => { console.warn(`Failed: ${path}`); resolve(); };
            img.src = path;
        });
    }
    
    getItems(): Item[] { return this.items; }
    getTexture(type: ItemType): HTMLImageElement | undefined { return this.textureCache.get(type); }
    getSize(layer: ItemLayer): number { return this.SIZES[layer]; }
}
