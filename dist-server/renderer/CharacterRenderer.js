"use strict";
/**
 * 角色渲染器
 *
 * 负责渲染角色（亚当、夏娃）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterManager = exports.Character = exports.CHARACTER_SIZE = void 0;
const MapGenerator_1 = require("../world/MapGenerator");
// 角色尺寸（Tile的1/2）
exports.CHARACTER_SIZE = 32;
// 角色类
class Character {
    constructor(type, x, y) {
        this.targetX = null;
        this.targetY = null;
        this.type = type;
        this.x = x;
        this.y = y;
        this.pixelX = x * 64 + 16; // 居中于格子
        this.pixelY = y * 64 + 16;
        this.direction = 'down';
        this.state = 'idle';
    }
    // 设置目标位置（AI决策）
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.state = 'walking';
    }
    // 更新位置
    update() {
        if (this.targetX === null || this.targetY === null) {
            this.state = 'idle';
            return;
        }
        // 简单的移动逻辑：向目标移动
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.5) {
            // 到达目标
            this.x = this.targetX;
            this.y = this.targetY;
            this.targetX = null;
            this.targetY = null;
            this.state = 'idle';
        }
        else {
            // 移动
            const speed = 0.05;
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
            // 更新方向
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            }
            else {
                this.direction = dy > 0 ? 'down' : 'up';
            }
        }
        // 更新像素坐标
        this.pixelX = this.x * 64 + 16;
        this.pixelY = this.y * 64 + 16;
    }
}
exports.Character = Character;
/**
 * 角色管理器
 */
class CharacterManager {
    constructor(map) {
        this.characters = [];
        this.textureCache = new Map();
        // 素材映射
        this.ASSETS = {
            'adam': 'img/亚当.png',
            'eve': 'img/夏娃.png',
        };
        this.map = map;
    }
    // 初始化角色
    init() {
        // 创建亚当
        const adam = new Character('adam', 50, 25);
        this.characters.push(adam);
        // 创建夏娃
        const eve = new Character('eve', 51, 25);
        this.characters.push(eve);
        // 加载素材
        this.loadTextures();
    }
    // 加载角色素材
    async loadTextures() {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            await this.loadTexture(type, path);
        }
    }
    loadTexture(type, path) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.textureCache.set(type, img);
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load character texture: ${path}`);
                resolve();
            };
            img.src = path;
        });
    }
    // 检查地形是否可通行
    isWalkable(x, y) {
        const tile = this.map.getTile(x, y);
        if (!tile)
            return false;
        // 不可通行地形
        const blocked = [
            MapGenerator_1.TileType.OCEAN,
            MapGenerator_1.TileType.LAKE,
            MapGenerator_1.TileType.RIVER,
            MapGenerator_1.TileType.MOUNTAIN,
            MapGenerator_1.TileType.SWAMP,
            MapGenerator_1.TileType.CAVE,
        ];
        return !blocked.includes(tile.type);
    }
    // 更新所有角色
    update() {
        for (const character of this.characters) {
            // 简单的AI：随机移动
            if (character.state === 'idle' && Math.random() < 0.02) {
                // 随机选择方向
                const directions = [
                    { dx: 1, dy: 0 },
                    { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 },
                    { dx: 0, dy: -1 },
                ];
                // 打乱顺序
                for (let i = directions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [directions[i], directions[j]] = [directions[j], directions[i]];
                }
                // 找到第一个可通行的方向
                for (const dir of directions) {
                    const newX = Math.floor(character.x + dir.dx);
                    const newY = Math.floor(character.y + dir.dy);
                    if (this.isWalkable(newX, newY)) {
                        character.setTarget(newX, newY);
                        break;
                    }
                }
            }
            // 更新位置
            character.update();
        }
    }
    // 渲染所有角色
    render(ctx) {
        for (const character of this.characters) {
            const texture = this.textureCache.get(character.type);
            if (!texture)
                continue;
            // 居中于像素位置
            const drawX = character.pixelX - exports.CHARACTER_SIZE / 2;
            const drawY = character.pixelY - exports.CHARACTER_SIZE / 2;
            ctx.drawImage(texture, drawX, drawY, exports.CHARACTER_SIZE, exports.CHARACTER_SIZE);
        }
    }
    // 获取所有角色
    getCharacters() {
        return this.characters;
    }
}
exports.CharacterManager = CharacterManager;
