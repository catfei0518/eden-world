/**
 * 角色层
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';

export type CharacterType = 'adam' | 'eve';

const TILE_SIZE = 64;
const CHARACTER_SIZE = 32;

class Character {
    type: CharacterType;
    x: number;
    y: number;
    pixelX: number;
    pixelY: number;
    targetX: number | null = null;
    targetY: number | null = null;
    
    constructor(type: CharacterType, x: number, y: number) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.pixelX = x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = y * TILE_SIZE + TILE_SIZE / 2;
    }
    
    setTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
    }
    
    update(): void {
        if (this.targetX === null || this.targetY === null) return;
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.targetX = null;
            this.targetY = null;
        } else {
            const speed = 0.02;
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
        }
        
        this.pixelX = this.x * TILE_SIZE + TILE_SIZE / 2;
        this.pixelY = this.y * TILE_SIZE + TILE_SIZE / 2;
    }
}

export class CharacterLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private characters: Character[] = [];
    private sprites: Map<Character, PIXI.Sprite> = new Map();
    private textureCache: Map<CharacterType, PIXI.Texture> = new Map();
    
    private readonly ASSETS: Record<CharacterType, string> = {
        'adam': 'img/亚当.png',
        'eve': 'img/夏娃.png',
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
    }
    
    async init(): Promise<void> {
        this.createCharacters();
        await this.loadTextures();
        this.render();
    }
    
    private createCharacters(): void {
        const mapSize = this.map.getSize();
        const centerX = Math.floor(mapSize.width / 2);
        const centerY = Math.floor(mapSize.height / 2);
        
        this.characters.push(new Character('adam', centerX, centerY));
        this.characters.push(new Character('eve', centerX + 1, centerY));
    }
    
    private async loadTextures(): Promise<void> {
        for (const [type, path] of Object.entries(this.ASSETS)) {
            try {
                const texture = await PIXI.Assets.load(path);
                this.textureCache.set(type as CharacterType, texture);
            } catch (e) {
                console.warn(`Failed to load character texture: ${path}`);
            }
        }
    }
    
    private render(): void {
        for (const char of this.characters) {
            const texture = this.textureCache.get(char.type);
            if (!texture) continue;
            
            const sprite = new PIXI.Sprite(texture);
            sprite.x = char.pixelX - CHARACTER_SIZE / 2;
            sprite.y = char.pixelY - CHARACTER_SIZE / 2;
            sprite.width = CHARACTER_SIZE;
            sprite.height = CHARACTER_SIZE;
            
            this.container.addChild(sprite);
            this.sprites.set(char, sprite);
        }
    }
    
    private isWalkable(x: number, y: number): boolean {
        const tile = this.map.getTile(Math.floor(x), Math.floor(y));
        if (!tile) return false;
        
        const blocked = [TileType.OCEAN, TileType.LAKE, TileType.RIVER, TileType.MOUNTAIN, TileType.SWAMP];
        return !blocked.includes(tile.type);
    }
    
    update(): void {
        for (const char of this.characters) {
            if (char.targetX === null && Math.random() < 0.02) {
                const directions = [
                    { dx: 1, dy: 0 },
                    { dx: -1, dy: 0 },
                    { dx: 0, dy: 1 },
                    { dx: 0, dy: -1 },
                ];
                
                for (let i = directions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [directions[i], directions[j]] = [directions[j], directions[i]];
                }
                
                for (const dir of directions) {
                    const newX = Math.floor(char.x + dir.dx);
                    const newY = Math.floor(char.y + dir.dy);
                    
                    if (this.isWalkable(newX, newY)) {
                        char.setTarget(newX, newY);
                        break;
                    }
                }
            }
            
            char.update();
            
            const sprite = this.sprites.get(char);
            if (sprite) {
                sprite.x = char.pixelX - CHARACTER_SIZE / 2;
                sprite.y = char.pixelY - CHARACTER_SIZE / 2;
            }
        }
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
    
    getCharacters(): Character[] {
        return this.characters;
    }
}
