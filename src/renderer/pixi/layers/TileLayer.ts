/**
 * 地形层
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';

const TILE_SIZE = 64;
const SCALE = 1.35;

export class TileLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private textureCache: Map<string, PIXI.Texture> = new Map();
    
    private readonly TEXTURES: Record<string, string> = {
        [TileType.PLAIN]: 'img/64x64像素草平原.png',
        [TileType.GRASS]: 'img/64x64像素草地春.png',
        [TileType.DESERT]: 'img/64x64像素沙漠.png',
        [TileType.FOREST]: 'img/64x64像素森林春夏.png',
        [TileType.OCEAN]: 'img/海洋.png',
        [TileType.LAKE]: 'img/湖泊春夏秋.png',
        [TileType.RIVER]: 'img/河流.png',
        [TileType.SWAMP]: 'img/沼泽.png',
        [TileType.MOUNTAIN]: 'img/山地.png',
        [TileType.HILL]: 'img/山丘.png',
        [TileType.CAVE]: 'img/石头.png',
        [TileType.BEACH]: 'img/沙滩.png',
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
    }
    
    async init(): Promise<void> {
        await this.loadTextures();
        this.render();
    }
    
    private async loadTextures(): Promise<void> {
        console.log('🔄 开始加载纹理...');
        for (const [type, path] of Object.entries(this.TEXTURES)) {
            console.log(`  加载: ${path}`);
            try {
                const texture = await PIXI.Assets.load(path);
                this.textureCache.set(path, texture);
                console.log(`  ✅ 成功: ${path}`);
            } catch (e) {
                console.warn(`  ❌ 失败: ${path}`, e);
            }
        }
        console.log('✅ 纹理加载完成');
    }
    
    render(): void {
        console.log('🎨 开始渲染地形...');
        this.container.removeChildren();
        
        const mapSize = this.map.getSize();
        console.log(`  地图尺寸: ${mapSize.width}x${mapSize.height}`);
        
        const SCALED_SIZE = TILE_SIZE * SCALE;
        const OFFSET = (SCALED_SIZE - TILE_SIZE) / 2;
        
        let count = 0;
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile) continue;
                
                const path = this.TEXTURES[tile.type];
                if (!path) continue;
                
                const texture = this.textureCache.get(path);
                if (!texture) continue;
                
                const sprite = new PIXI.Sprite(texture);
                sprite.x = x * TILE_SIZE - OFFSET;
                sprite.y = y * TILE_SIZE - OFFSET;
                sprite.width = SCALED_SIZE;
                sprite.height = SCALED_SIZE;
                
                this.container.addChild(sprite);
                count++;
            }
        }
        console.log(`✅ 渲染了 ${count} 个地形块`);
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
}
