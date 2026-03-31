"use strict";
/**
 * 地形层 - 支持季节切换
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
exports.TileLayer = void 0;
const PIXI = __importStar(require("pixi.js"));
const MapGenerator_1 = require("../../../world/MapGenerator");
const TILE_SIZE = 64;
const SCALE = 1.35;
class TileLayer {
    constructor(map) {
        this.textureCache = new Map();
        this.currentSeason = 'summer';
        this.tileSprites = [];
        // 按季节的地形纹理
        this.TEXTURES = {
            [MapGenerator_1.TileType.PLAIN]: {
                spring: 'img/64x64像素草平原.png',
                summer: 'img/64x64像素草平原.png',
                autumn: 'img/64x64像素草平原.png',
                winter: 'img/64x64像素草平原雪.png'
            },
            [MapGenerator_1.TileType.GRASS]: {
                spring: 'img/64x64像素草地春夏.png',
                summer: 'img/64x64像素草地春夏.png',
                autumn: 'img/64x64像素草地秋.png',
                winter: 'img/64x64像素草地冬.png'
            },
            [MapGenerator_1.TileType.DESERT]: {
                spring: 'img/64x64像素沙漠.png',
                summer: 'img/64x64像素沙漠.png',
                autumn: 'img/64x64像素沙漠.png',
                winter: 'img/64x64像素沙漠雪.png'
            },
            [MapGenerator_1.TileType.FOREST]: {
                spring: 'img/64x64像素森林春夏.png',
                summer: 'img/64x64像素森林春夏.png',
                autumn: 'img/64x64像素森林秋.png',
                winter: 'img/64x64像素森林冬.png'
            },
            [MapGenerator_1.TileType.OCEAN]: {
                spring: 'img/海洋.png',
                summer: 'img/海洋.png',
                autumn: 'img/海洋.png',
                winter: 'img/海洋.png'
            },
            [MapGenerator_1.TileType.LAKE]: {
                spring: 'img/湖泊春夏秋.png',
                summer: 'img/湖泊春夏秋.png',
                autumn: 'img/湖泊春夏秋.png',
                winter: 'img/湖泊冬.png'
            },
            [MapGenerator_1.TileType.RIVER]: {
                spring: 'img/河流.png',
                summer: 'img/河流.png',
                autumn: 'img/河流.png',
                winter: 'img/河流.png'
            },
            [MapGenerator_1.TileType.SWAMP]: {
                spring: 'img/沼泽.png',
                summer: 'img/沼泽.png',
                autumn: 'img/沼泽.png',
                winter: 'img/沼泽雪.png'
            },
            [MapGenerator_1.TileType.MOUNTAIN]: {
                spring: 'img/山地.png',
                summer: 'img/山地.png',
                autumn: 'img/山地.png',
                winter: 'img/山地雪.png'
            },
            [MapGenerator_1.TileType.HILL]: {
                spring: 'img/山丘.png',
                summer: 'img/山丘.png',
                autumn: 'img/山丘.png',
                winter: 'img/山丘雪.png'
            },
            [MapGenerator_1.TileType.CAVE]: {
                spring: 'img/石头.png',
                summer: 'img/石头.png',
                autumn: 'img/石头.png',
                winter: 'img/石头.png'
            },
            [MapGenerator_1.TileType.BEACH]: {
                spring: 'img/沙滩.png',
                summer: 'img/沙滩.png',
                autumn: 'img/沙滩.png',
                winter: 'img/沙滩雪.png'
            }
        };
        this.map = map;
        this.container = new PIXI.Container();
    }
    // 设置季节
    setSeason(season) {
        this.currentSeason = season;
        this.updateAllTiles();
        console.log(`🌍 地形切换为: ${season}`);
    }
    async init() {
        await this.loadTextures();
        this.render();
    }
    async loadTextures() {
        console.log('🔄 开始加载地形纹理...');
        // 收集所有需要加载的纹理
        const toLoad = [];
        const seasons = ['spring', 'summer', 'autumn', 'winter'];
        for (const tileType of Object.keys(this.TEXTURES)) {
            for (const season of seasons) {
                const path = this.TEXTURES[tileType][season];
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
            }
            catch (e) {
                console.warn(`  ❌ 加载失败: ${path}`);
            }
        }
        console.log(`✅ 地形纹理加载完成 (${this.textureCache.size} 个)`);
    }
    getTexture(tileType) {
        const path = this.TEXTURES[tileType][this.currentSeason];
        return this.textureCache.get(path) || null;
    }
    render() {
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
                if (!tile)
                    continue;
                const texture = this.getTexture(tile.type);
                if (!texture)
                    continue;
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
    updateAllTiles() {
        const mapSize = this.map.getSize();
        let index = 0;
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile)
                    continue;
                const texture = this.getTexture(tile.type);
                if (texture && index < this.tileSprites.length) {
                    this.tileSprites[index].texture = texture;
                }
                index++;
            }
        }
    }
    getContainer() {
        return this.container;
    }
}
exports.TileLayer = TileLayer;
