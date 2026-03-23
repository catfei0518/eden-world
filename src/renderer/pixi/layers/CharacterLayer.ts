/**
 * 角色层 - 使用AI决策系统
 */

import * as PIXI from 'pixi.js';
import { GameMap, TileType } from '../../../world/MapGenerator';
import { Character, CharacterType } from '../../../entities/Character';
import { WorldState } from '../../../systems/needs/NeedsCalculator';

const TILE_SIZE = 64;
const CHARACTER_SIZE = 32;

export class CharacterLayer {
    private container: PIXI.Container;
    private map: GameMap;
    private characters: Character[] = [];
    private sprites: Map<Character, PIXI.Sprite> = new Map();
    private labels: Map<Character, PIXI.Text> = new Map();
    private textureCache: Map<CharacterType, PIXI.Texture> = new Map();
    private worldState: WorldState;
    
    private readonly ASSETS: Record<CharacterType, string> = {
        'adam': 'img/亚当.png',
        'eve': 'img/夏娃.png',
    };
    
    constructor(map: GameMap) {
        this.map = map;
        this.container = new PIXI.Container();
        
        // 初始化世界状态
        this.worldState = {
            time: 0,
            threats: [],
            nearbyFood: this.findNearbyFood(),
            nearbyWater: this.findNearbyWater(),
            nearbyIndividuals: 0,
            temperature: 25,
            isNight: false
        };
    }
    
    async init(): Promise<void> {
        await this.loadTextures();
        this.createCharacters();
        this.render();
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
    
    private createCharacters(): void {
        const mapSize = this.map.getSize();
        const centerX = Math.floor(mapSize.width / 2);
        const centerY = Math.floor(mapSize.height / 2);
        
        // 创建亚当和夏娃
        const adam = new Character('adam', centerX, centerY);
        const eve = new Character('eve', centerX + 1, centerY);
        
        this.characters.push(adam);
        this.characters.push(eve);
    }
    
    private render(): void {
        for (const char of this.characters) {
            const texture = this.textureCache.get(char.type);
            if (!texture) continue;
            
            // 创建角色精灵
            const sprite = new PIXI.Sprite(texture);
            const pos = char.getPixelPosition();
            sprite.x = pos.x - CHARACTER_SIZE / 2;
            sprite.y = pos.y - CHARACTER_SIZE / 2;
            sprite.width = CHARACTER_SIZE;
            sprite.height = CHARACTER_SIZE;
            
            this.container.addChild(sprite);
            this.sprites.set(char, sprite);
            
            // 创建名字标签
            const label = new PIXI.Text({
                text: char.name,
                style: {
                    fontSize: 10,
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 2 }
                }
            });
            label.x = pos.x - label.width / 2;
            label.y = pos.y - CHARACTER_SIZE / 2 - 12;
            this.container.addChild(label);
            this.labels.set(char, label);
            
            // 创建状态标签（显示当前行动）
            const actionLabel = new PIXI.Text({
                text: char.getActionDescription(),
                style: {
                    fontSize: 8,
                    fill: 0xffff00,
                    stroke: { color: 0x000000, width: 1 }
                }
            });
            actionLabel.x = pos.x - actionLabel.width / 2;
            actionLabel.y = pos.y + CHARACTER_SIZE / 2 + 2;
            this.container.addChild(actionLabel);
        }
    }
    
    // 更新所有角色
    update(deltaTime: number): void {
        // 更新世界状态
        this.updateWorldState();
        
        // 更新每个角色
        for (const char of this.characters) {
            // AI决策更新
            char.update(deltaTime, this.worldState);
            
            // 更新精灵位置
            const sprite = this.sprites.get(char);
            if (sprite) {
                const pos = char.getPixelPosition();
                sprite.x = pos.x - CHARACTER_SIZE / 2;
                sprite.y = pos.y - CHARACTER_SIZE / 2;
            }
            
            // 更新标签
            const label = this.labels.get(char);
            if (label) {
                const pos = char.getPixelPosition();
                label.x = pos.x - label.width / 2;
                label.y = pos.y - CHARACTER_SIZE / 2 - 12;
            }
        }
    }
    
    // 更新世界状态
    private updateWorldState(): void {
        // 简化：每帧重新扫描附近资源
        this.worldState.nearbyFood = this.findNearbyFood();
        this.worldState.nearbyWater = this.findNearbyWater();
        this.worldState.nearbyIndividuals = this.characters.length;
        
        // 简化：随机威胁（后续完善）
        if (Math.random() < 0.001) {
            this.worldState.threats = [];
        }
    }
    
    // 查找附近的食物
    private findNearbyFood(): { type: string; position: { x: number; y: number } }[] {
        const foods: { type: string; position: { x: number; y: number } }[] = [];
        
        // 简化：随机生成食物位置
        for (let i = 0; i < 3; i++) {
            const mapSize = this.map.getSize();
            foods.push({
                type: ['berry', 'fruit'][Math.floor(Math.random() * 2)],
                position: {
                    x: Math.floor(Math.random() * mapSize.width),
                    y: Math.floor(Math.random() * mapSize.height)
                }
            });
        }
        
        return foods;
    }
    
    // 查找附近的水源
    private findNearbyWater(): { type: string; position: { x: number; y: number } }[] {
        const waters: { type: string; position: { x: number; y: number } }[] = [];
        
        // 简化：查找地图上的水域
        const mapSize = this.map.getSize();
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this.map.getTile(x, y);
                if (tile && (tile.type === TileType.RIVER || tile.type === TileType.LAKE)) {
                    waters.push({
                        type: tile.type === TileType.RIVER ? 'river' : 'lake',
                        position: { x, y }
                    });
                }
            }
        }
        
        return waters;
    }
    
    getContainer(): PIXI.Container {
        return this.container;
    }
    
    getCharacters(): Character[] {
        return this.characters;
    }
}
