/**
 * 角色层
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';
import { Character } from '../../../entities/Character';

const TILE_SIZE = 64;
const CHAR_SIZE = 32;
const HITBOX_SIZE = 48; // 点击热区大小

export class CharacterLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private characters: Character[] = [];
    private sprites: Map<Character, PIXI.Sprite> = new Map();
    private labels: Map<Character, PIXI.Text> = new Map();
    private textures: Map<string, PIXI.Texture> = new Map();
    private hitboxes: Map<Character, PIXI.Graphics> = new Map();
    
    // 点击回调
    public onCharacterClick: ((char: Character) => void) | null = null;
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
    }
    
    async init(): Promise<void> {
        console.log('🎭 CharacterLayer.init() 开始');
        await this.loadTextures();
        this.spawnCharacters();
        this.setupInteraction();
        console.log('🎭 CharacterLayer.init() 完成');
    }
    
    private async loadTextures(): Promise<void> {
        console.log('🔄 开始加载角色纹理...');
        const sources: Record<string, string> = {
            'adam': 'img/亚当.png',
            'eve': 'img/夏娃.png'
        };
        
        for (const [key, path] of Object.entries(sources)) {
            console.log(`  加载: ${path}`);
            try {
                const texture = await PIXI.Assets.load(path);
                this.textures.set(key, texture);
                console.log(`  ✅ 成功: ${path}`);
            } catch (e) {
                console.error(`  ❌ 失败: ${path}`, e);
            }
        }
        console.log('✅ 角色纹理加载完成');
    }
    
    private spawnCharacters(): void {
        console.log('🎭 开始生成角色...');
        const walkable = (x: number, y: number): boolean => {
            if (x < 0 || y < 0) return false;
            const tile = this.map.getTile(x, y);
            if (!tile) return false;
            return ![TileType.OCEAN, TileType.LAKE, TileType.RIVER, TileType.MOUNTAIN, TileType.SWAMP].includes(tile.type);
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
        
        const adam = new Character('adam', spawnX, spawnY, '亚当', walkable);
        const eve = new Character('eve', spawnX + 1, spawnY, '夏娃', walkable);
        
        this.characters.push(adam, eve);
        console.log(`🎭 角色数量: ${this.characters.length}, 位置: (${spawnX}, ${spawnY})`);
        
        // 创建精灵和点击区域
        for (const char of this.characters) {
            const tex = this.textures.get(char.type);
            console.log(`🎭 创建${char.name}精灵, 纹理: ${tex ? '有' : '无'}`);
            if (!tex) continue;
            
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
            hitbox.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
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
    
    private setupInteraction(): void {
        // 不设置容器的eventMode，让事件穿透到下层的物品层
        // 只让角色的hitbox可以接收点击
    }
    
    update(deltaTime: number): void {
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
                } else {
                    label.text = `${char.name}: ${char.action}`;
                    label.style.fill = 0xffffff;
                }
                const pos = char.getPixelPos();
                label.x = pos.x - label.width / 2;
                label.y = pos.y - CHAR_SIZE - 14;
            }
        }
    }
    
    private getWorldState() {
        const foods: { type: string; position: { x: number; y: number }; quantity: number }[] = [];
        const waters: { type: string; position: { x: number; y: number }; quantity: number }[] = [];
        
        const size = this.map.getSize();
        for (let y = 0; y < size.height; y++) {
            for (let x = 0; x < size.width; x++) {
                const tile = this.map.getTile(x, y);
                if (tile?.type === TileType.RIVER || tile?.type === TileType.LAKE) {
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
    
    getContainer(): PIXI.Container {
        return this.container;
    }
    
    getCharacters(): Character[] {
        return this.characters;
    }
}
