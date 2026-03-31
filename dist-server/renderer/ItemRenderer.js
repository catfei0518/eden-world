"use strict";
/**
 * 物品渲染系统
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemManager = exports.Item = void 0;
const MapGenerator_1 = require("../world/MapGenerator");
class Item {
    constructor(type, x, y, layer) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.layer = layer;
        this.pixelX = x * 64 + 32;
        this.pixelY = y * 64 + 32;
    }
}
exports.Item = Item;
class ItemManager {
    constructor(map) {
        this.items = [];
        this.textureCache = new Map();
        this.ASSETS = {
            'tree': 'img/树.png',
            'bush': 'img/灌木.png',
            'rock': 'img/石头.png',
            'stick': 'img/木棍.png',
            'berry': 'img/浆果.png',
            'flower': 'img/花.png',
            'branch': 'img/树枝.png',
        };
        this.SIZES = {
            'ground': 40,
            'low': 48,
            'high': 64,
        };
        this.map = map;
    }
    generate() {
        const mapSize = this.map.getSize();
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (!tile)
                    continue;
                this.generateItemsForTile(tile.type, x, y);
            }
        }
        this.loadTextures();
    }
    generateItemsForTile(tileType, x, y) {
        const rand = Math.random();
        switch (tileType) {
            case MapGenerator_1.TileType.FOREST:
                if (rand < 0.12) {
                    this.items.push(new Item('tree', x, y, 'high'));
                }
                else if (rand < 0.22) {
                    this.items.push(new Item('bush', x, y, 'low'));
                }
                else if (rand < 0.28) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                else if (rand < 0.35) {
                    this.items.push(new Item('berry', x, y, 'ground'));
                }
                break;
            case MapGenerator_1.TileType.GRASS:
                if (rand < 0.05) {
                    this.items.push(new Item('flower', x, y, 'ground'));
                }
                else if (rand < 0.10) {
                    this.items.push(new Item('berry', x, y, 'ground'));
                }
                else if (rand < 0.13) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
            case MapGenerator_1.TileType.PLAIN:
                if (rand < 0.15) {
                    this.items.push(new Item('stick', x, y, 'ground'));
                }
                else if (rand < 0.22) {
                    this.items.push(new Item('flower', x, y, 'ground'));
                }
                else if (rand < 0.28) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
            case MapGenerator_1.TileType.HILL:
                if (rand < 0.08) {
                    this.items.push(new Item('rock', x, y, 'ground'));
                }
                else if (rand < 0.14) {
                    this.items.push(new Item('bush', x, y, 'low'));
                }
                else if (rand < 0.18) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
            case MapGenerator_1.TileType.MOUNTAIN:
                if (rand < 0.10) {
                    this.items.push(new Item('rock', x, y, 'ground'));
                }
                else if (rand < 0.15) {
                    this.items.push(new Item('branch', x, y, 'ground'));
                }
                break;
        }
    }
    async loadTextures() {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            await this.loadTexture(type, path);
        }
    }
    loadTexture(type, path) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { this.textureCache.set(type, img); resolve(); };
            img.onerror = () => { console.warn(`Failed: ${path}`); resolve(); };
            img.src = path;
        });
    }
    getItems() { return this.items; }
    getTexture(type) { return this.textureCache.get(type); }
    getSize(layer) { return this.SIZES[layer]; }
}
exports.ItemManager = ItemManager;
