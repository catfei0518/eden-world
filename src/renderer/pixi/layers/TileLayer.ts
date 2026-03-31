/**
 * 地形层 - 支持季节切换
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const TILE_SIZE = 64;
const SCALE = 1.35;

export class TileLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private textureCache: Map<string, PIXI.Texture> = new Map();
    private currentSeason: Season = 'summer';
    private tileSprites: PIXI.Sprite[] = [];
    
    // 按季节的地形纹理
    private readonly TEXTURES: Record<TileType, Record<Season, string>> = {
        [TileType.PLAINS]: {
            spring: 'img/64x64像素草平原.png',
            summer: 'img/64x64像素草平原.png',
            autumn: 'img/64x64像素草平原.png',
            winter: 'img/64x64像素草平原雪.png'
        },
        [TileType.GRASS]: {
            spring: 'img/64x64像素草地春夏.png',
            summer: 'img/64x64像素草地春夏.png',
            autumn: 'img/64x64像素草地秋.png',
            winter: 'img/64x64像素草地冬.png'
        },
        [TileType.DESERT]: {
            spring: 'img/64x64像素沙漠.png',
            summer: 'img/64x64像素沙漠.png',
            autumn: 'img/64x64像素沙漠.png',
            winter: 'img/64x64像素沙漠雪.png'
        },
        [TileType.FOREST]: {
            spring: 'img/64x64像素森林春夏.png',
            summer: 'img/64x64像素森林春夏.png',
            autumn: 'img/64x64像素森林秋.png',
            winter: 'img/64x64像素森林冬.png'
        },
        [TileType.OCEAN]: {
            spring: 'img/海洋.png',
            summer: 'img/海洋.png',
            autumn: 'img/海洋.png',
            winter: 'img/海洋.png'
        },
        [TileType.LAKE]: {
            spring: 'img/湖泊春夏秋.png',
            summer: 'img/湖泊春夏秋.png',
            autumn: 'img/湖泊春夏秋.png',
            winter: 'img/湖泊冬.png'
        },
        [TileType.RIVER]: {
            spring: 'img/河流.png',
            summer: 'img/河流.png',
            autumn: 'img/河流.png',
            winter: 'img/河流.png'
        },
        [TileType.SWAMP]: {
            spring: 'img/沼泽.png',
            summer: 'img/沼泽.png',
            autumn: 'img/沼泽.png',
            winter: 'img/沼泽雪.png'
        },
        [TileType.MOUNTAIN]: {
            spring: 'img/山地.png',
            summer: 'img/山地.png',
            autumn: 'img/山地.png',
            winter: 'img/山地雪.png'
        },
        [TileType.HILL]: {
            spring: 'img/山丘.png',
            summer: 'img/山丘.png',
            autumn: 'img/山丘.png',
            winter: 'img/山丘雪.png'
        },
        [TileType.BEACH]: {
            spring: 'img/沙滩.png',
            summer: 'img/沙滩.png',
            autumn: 'img/沙滩.png',
            winter: 'img/沙滩雪.png'
        },
        [TileType.MARSH]: {
            spring: 'img/沼泽.png',
            summer: 'img/沼泽.png',
            autumn: 'img/沼泽.png',
            winter: 'img/沼泽雪.png'
        },
        [TileType.BADLANDS]: {
            spring: 'img/山地.png',
            summer: 'img/山地.png',
            autumn: 'img/山地.png',
            winter: 'img/山地雪.png'
        }
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
    }
    
    // 设置季节
    setSeason(season: Season): void {
        this.currentSeason = season;
        this.updateAllTiles();
        console.log(`🌍 地形切换为: ${season}`);
    }
    
    async init(): Promise<void> {
        await this.loadTextures();
        this.render();
    }
    
    private async loadTextures(): Promise<void> {
        console.log('🔄 开始加载地形纹理...');
        
        // 收集所有需要加载的纹理
        const toLoad: string[] = [];
        const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
        
        for (const tileType of Object.keys(this.TEXTURES)) {
            for (const season of seasons) {
                const path = this.TEXTURES[tileType as TileType][season];
                if (!toLoad.includes(path)) {
                    toLoad.push(path);
                }
            }
        }
        
        // 加载纹理
        for (const path of toLoad) {
            try {
                const texture = await PIXI.Assets.load(path);
                this.textureCache.set(path, texture);
                console.log(`  ✅ ${path}`);
            } catch (e) {
                console.warn(`  ❌ 加载失败: ${path}`);
            }
        }
        
        console.log(`✅ 地形纹理加载完成 (${this.textureCache.size} 个)`);
    }
    
    private getTexture(tileType: TileType): PIXI.Texture | null {
        const path = this.TEXTURES[tileType][this.currentSeason];
        return this.textureCache.get(path) || null;
    }
    
    render(): void {
        console.log('🎨 开始渲染地形...');
        this.container.removeChildren();
        this.tileSprites = [];
        
        const mapSize = this.map.getSize();
        console.log(`  地图尺寸: ${mapSize.width}x${mapSize.height}`);
        
        const SCALED_SIZE = TILE_SIZE * SCALE;
        const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;
        
        let count = 0;
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const texture = this.getTexture(tile.type);
                if (!texture) continue;
                
                const sprite = new PIXI.Sprite(texture);
                sprite.x = x * TILE_SIZE - OFFSET;
                sprite.y = y * TILE_SIZE - OFFSET;
                sprite.width = SCALED_SIZE;
                sprite.height = SCALED_SIZE;
                
                this.container.addChild(sprite);
                this.tileSprites.push(sprite);
                count++;
            }
        }
        console.log(`✅ 渲染了 ${count} 个地形块`);
    }
    
    // 更新所有地形纹理（季节切换时调用）
    private updateAllTiles(): void {
        const mapSize = this.map.getSize();
        let index = 0;
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const texture = this.getTexture(tile.type);
                if (texture && index < this.tileSprites.length) {
                    this.tileSprites[index].texture = texture;
                }
                index++;
            }
        }
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
}
