"use strict";
/**
 * 角色层
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
exports.CharacterLayer = void 0;
const PIXI = __importStar(require("pixi.js"));
const MapGenerator_1 = require("../../../world/MapGenerator");
const Character_1 = require("../../../entities/Character");
const TILE_SIZE = 64;
const CHAR_SIZE = 32;
const HITBOX_SIZE = 48; // 点击热区大小
class CharacterLayer {
    constructor(map) {
        this.characters = [];
        this.sprites = new Map();
        this.labels = new Map();
        this.textures = new Map();
        this.hitboxes = new Map();
        // 点击回调
        this.onCharacterClick = null;
        this.map = map;
        this.container = new PIXI.Container();
    }
    async init() {
        console.log('🎭 CharacterLayer.init() 开始');
        await this.loadTextures();
        this.spawnCharacters();
        this.setupInteraction();
        console.log('🎭 CharacterLayer.init() 完成');
    }
    async loadTextures() {
        console.log('🔄 开始加载角色纹理...');
        const sources = {
            'adam': 'img/亚当.png',
            'eve': 'img/夏娃.png'
        };
        for (const [key, path] of Object.entries(sources)) {
            console.log(`  加载: ${path}`);
            try {
                const texture = await PIXI.Assets.load(path);
                this.textures.set(key, texture);
                console.log(`  ✅ 成功: ${path}`);
            }
            catch (e) {
                console.error(`  ❌ 失败: ${path}`, e);
            }
        }
        console.log('✅ 角色纹理加载完成');
    }
    spawnCharacters() {
        console.log('🎭 开始生成角色...');
        const walkable = (x, y) => {
            if (x < 0 || y < 0)
                return false;
            const tile = this.map.getTile(x, y);
            if (!tile)
                return false;
            return ![MapGenerator_1.TileType.OCEAN, MapGenerator_1.TileType.LAKE, MapGenerator_1.TileType.RIVER, MapGenerator_1.TileType.MOUNTAIN, MapGenerator_1.TileType.SWAMP].includes(tile.type);
        };
        // 在地图中心区域寻找可行走位置
        const centerX = Math.floor(this.map.getSize().width / 2);
        const centerY = Math.floor(this.map.getSize().height / 2);
        let spawnX = centerX;
        let spawnY = centerY;
        // 螺旋向外搜索
        let found = false;
        for (let r = 0; r < 30 && !found; r++) {
            for (let dx = -r; dx <= r && !found; dx++) {
                for (let dy = -r; dy <= r && !found; dy++) {
                    const nx = spawnX + dx;
                    const ny = spawnY + dy;
                    if (walkable(nx, ny)) {
                        spawnX = nx;
                        spawnY = ny;
                        found = true;
                    }
                }
            }
        }
        console.log(`🎭 出生点: (${spawnX}, ${spawnY})`);
        const adam = new Character_1.Character('adam', spawnX, spawnY, '亚当', walkable);
        const eve = new Character_1.Character('eve', spawnX + 1, spawnY, '夏娃', walkable);
        this.characters.push(adam, eve);
        console.log(`🎭 角色数量: ${this.characters.length}, 位置: (${spawnX}, ${spawnY})`);
        // 创建精灵和点击区域
        for (const char of this.characters) {
            const tex = this.textures.get(char.type);
            console.log(`🎭 创建${char.name}精灵, 纹理: ${tex ? '有' : '无'}`);
            if (!tex)
                continue;
            // 创建精灵
            const sprite = new PIXI.Sprite(tex);
            sprite.width = CHAR_SIZE;
            sprite.height = CHAR_SIZE;
            this.container.addChild(sprite);
            this.sprites.set(char, sprite);
            // 创建不可见的点击区域
            const hitbox = new PIXI.Graphics();
            hitbox.beginFill(0xffffff, 0.001); // 几乎透明
            hitbox.drawRect(0, 0, HITBOX_SIZE, HITBOX_SIZE);
            hitbox.endFill();
            hitbox.x = 0; // 稍后设置位置
            hitbox.y = 0;
            hitbox.eventMode = 'static';
            hitbox.cursor = 'pointer';
            this.container.addChild(hitbox);
            this.hitboxes.set(char, hitbox);
            // 点击事件
            hitbox.on('pointerdown', (event) => {
                if (this.onCharacterClick) {
                    this.onCharacterClick(char);
                }
            });
            // 创建标签 - 添加描边更清晰
            const label = new PIXI.Text({
                text: char.name,
                style: {
                    fontSize: 14,
                    fontWeight: 'bold',
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 3 },
                }
            });
            label.resolution = 2; // 更高分辨率
            this.container.addChild(label);
            this.labels.set(char, label);
        }
        console.log(`🎭 精灵数量: ${this.sprites.size}`);
    }
    setupInteraction() {
        // 让容器可以点击
        this.container.eventMode = 'static';
        // 注意：不设置hitArea，让子元素可以接收点击事件
    }
    update(deltaTime) {
        // 准备世界状态
        const world = this.getWorldState();
        // 更新所有角色
        for (const char of this.characters) {
            if (!char.isDead) {
                // 存活角色：更新行为
                char.update(deltaTime, world);
            }
            // 更新精灵位置
            const sprite = this.sprites.get(char);
            const hitbox = this.hitboxes.get(char);
            if (sprite) {
                const pos = char.getPixelPos();
                sprite.x = pos.x - CHAR_SIZE / 2;
                sprite.y = pos.y - CHAR_SIZE / 2;
            }
            if (hitbox) {
                const pos = char.getPixelPos();
                hitbox.x = pos.x - HITBOX_SIZE / 2;
                hitbox.y = pos.y - HITBOX_SIZE / 2;
            }
            // 更新标签
            const label = this.labels.get(char);
            if (label) {
                if (char.isDead) {
                    label.text = `💀 ${char.name}: 死亡`;
                    label.style.fill = 0x888888;
                }
                else {
                    label.text = `${char.name}: ${char.action}`;
                    label.style.fill = 0xffffff;
                }
                const pos = char.getPixelPos();
                label.x = pos.x - label.width / 2;
                label.y = pos.y - CHAR_SIZE - 14;
            }
        }
    }
    getWorldState() {
        const foods = [];
        const waters = [];
        const size = this.map.getSize();
        for (let y = 0; y < size.height; y++) {
            for (let x = 0; x < size.width; x++) {
                const tile = this.map.getTile(x, y);
                if (tile?.type === MapGenerator_1.TileType.RIVER || tile?.type === MapGenerator_1.TileType.LAKE) {
                    waters.push({ type: 'water', position: { x, y }, quantity: 100 });
                }
            }
        }
        // 随机生成食物
        for (let i = 0; i < 10; i++) {
            foods.push({ type: 'food', position: { x: Math.random() * 100, y: Math.random() * 50 }, quantity: 50 });
        }
        return {
            time: 0,
            threats: [],
            nearbyFood: foods,
            nearbyWater: waters,
            nearbyIndividuals: this.characters.length - 1,
            temperature: 25,
            isNight: false
        };
    }
    getContainer() {
        return this.container;
    }
    getCharacters() {
        return this.characters;
    }
}
exports.CharacterLayer = CharacterLayer;
