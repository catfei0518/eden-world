/**
 * 角色渲染器
 * 
 * 负责渲染角色（亚当、夏娃）
 */

import { GameMap, TileType } from '../world/MapGenerator';

// 角色尺寸（Tile的1/2）
export const CHARACTER_SIZE = 32;

// 角色类型
export type CharacterType = 'adam' | 'eve';

// 角色方向
export type Direction = 'up' | 'down' | 'left' | 'right';

// 角色状态
export type CharacterState = 'idle' | 'walking';

// 角色配置
export interface CharacterConfig {
    type: CharacterType;
    x: number;          // 格子坐标
    y: number;
    direction: Direction;
    state: CharacterState;
}

// 角色类
export class Character {
    type: CharacterType;
    x: number;          // 逻辑坐标（格子）
    y: number;
    pixelX: number;    // 像素坐标
    pixelY: number;
    direction: Direction;
    state: CharacterState;
    targetX: number | null = null;
    targetY: number | null = null;
    
    constructor(type: CharacterType, x: number, y: number) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.pixelX = x * 64 + 16; // 居中于格子
        this.pixelY = y * 64 + 16;
        this.direction = 'down';
        this.state = 'idle';
    }
    
    // 设置目标位置（AI决策）
    setTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
        this.state = 'walking';
    }
    
    // 更新位置
    update(): void {
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
        } else {
            // 移动
            const speed = 0.05;
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
            
            // 更新方向
            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.direction = dy > 0 ? 'down' : 'up';
            }
        }
        
        // 更新像素坐标
        this.pixelX = this.x * 64 + 16;
        this.pixelY = this.y * 64 + 16;
    }
}

/**
 * 角色管理器
 */
export class CharacterManager {
    private characters: Character[] = [];
    private map: GameMap;
    private textureCache: Map<string, HTMLImageElement> = new Map();
    
    // 素材映射
    private readonly ASSETS: Record<string, string> = {
        'adam': 'img/亚当.png',
        'eve': 'img/夏娃.png',
    };
    
    constructor(map: GameMap) {
        this.map = map;
    }
    
    // 初始化角色
    init(): void {
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
    private async loadTextures(): Promise<void> {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            await this.loadTexture(type, path);
        }
    }
    
    private loadTexture(type: string, path: string): Promise<void> {
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
    isWalkable(x: number, y: number): boolean {
        const tile = this.map.getTile(x, y);
        if (!tile) return false;
        
        // 不可通行地形
        const blocked: TileType[] = [
            TileType.OCEAN,
            TileType.LAKE,
            TileType.RIVER,
            TileType.MOUNTAIN,
            TileType.SWAMP,
            TileType.CAVE,
        ];
        
        return !blocked.includes(tile.type);
    }
    
    // 更新所有角色
    update(): void {
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
    render(ctx: CanvasRenderingContext2D): void {
        for (const character of this.characters) {
            const texture = this.textureCache.get(character.type);
            if (!texture) continue;
            
            // 居中于像素位置
            const drawX = character.pixelX - CHARACTER_SIZE / 2;
            const drawY = character.pixelY - CHARACTER_SIZE / 2;
            
            ctx.drawImage(
                texture,
                drawX,
                drawY,
                CHARACTER_SIZE,
                CHARACTER_SIZE
            );
        }
    }
    
    // 获取所有角色
    getCharacters(): Character[] {
        return this.characters;
    }
}
