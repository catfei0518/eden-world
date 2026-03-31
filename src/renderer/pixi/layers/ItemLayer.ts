/**
 * 物品层 - 使用统一物品系统
 * 已重构为使用 src/systems/items 中的统一物品定义
 */

import * as PIXI from 'pixi.js';
import { GameMap } from '../../../world/MapGenerator';
import {
  ItemType,
  Season,
  TileType,
  ITEM_DEFINITIONS,
  getItemTexture,
  getItemSize,
} from '../../../systems/items';

const TILE_SIZE = 64;

/**
 * 创建 LCG RNG（线性同余生成器）
 * 与服务器保持一致
 */
function createLCGRNG(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

export class GameItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  layer: 'ground' | 'low' | 'high';

  resource: {
    current: number;
    max: number;
    regrowTime?: number;
    regrowTimer?: number;
  } | null;

  harvested: boolean;
  lastHarvestTime?: number;

  constructor(id: string, type: ItemType, x: number, y: number, rng?: () => number) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.layer = ITEM_DEFINITIONS[type].spawn.layer;
    this.harvested = false;

    const randomFunc = rng || Math.random;
    const def = ITEM_DEFINITIONS[type];
    if (def.resource) {
      const amount = Math.floor(randomFunc() * (def.resource.max - def.resource.min + 1)) + def.resource.min;
      this.resource = {
        current: amount,
        max: amount,
        regrowTime: def.resource.regrowTime,
        regrowTimer: 0,
      };
    } else {
      this.resource = null;
    }
  }

  getName(): string {
    return ITEM_DEFINITIONS[this.type]?.displayName || '未知物品';
  }

  hasResources(): boolean {
    return this.resource !== null && this.resource.current > 0;
  }

  harvest(amount: number = 1): number {
    if (!this.resource || this.resource.current <= 0) return 0;

    const harvested = Math.min(this.resource.current, amount);
    this.resource.current -= harvested;

    if (this.resource.current <= 0) {
      this.harvested = true;
      this.lastHarvestTime = Date.now();
      if (this.resource.regrowTime) {
        this.resource.regrowTimer = 0;
      }
    }

    return harvested;
  }

  update(deltaTime: number): void {
    if (
      this.harvested &&
      this.resource &&
      this.resource.regrowTime &&
      this.resource.regrowTimer !== undefined
    ) {
      this.resource.regrowTimer += deltaTime;

      if (this.resource.regrowTimer >= this.resource.regrowTime) {
        this.harvested = false;
        this.resource.current = this.resource.max;
        this.resource.regrowTimer = 0;
        this.lastHarvestTime = undefined;
      }
    }
  }
}

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

export class ItemLayer {
  private container: PIXI.Container;
  private map: GameMap;
  private items: GameItem[] = [];
  private sprites: Map<string, PIXI.Sprite> = new Map();
  private hitboxes: Map<string, PIXI.Graphics> = new Map();
  private textureCache: Map<string, PIXI.Texture> = new Map();
  private currentSeason: Season = Season.SUMMER;
  private itemNoise: NoiseFunction2D;
  private itemRNG: () => number;

  public onItemClick: ((item: GameItem) => void) | null = null;

  constructor(map: GameMap) {
    this.map = map;
    this.container = new PIXI.Container();
    // 创建物品生成专用噪声函数（与服务器 seed + 200 一致）
    this.itemRNG = createLCGRNG(map.getSeed() + 200);
    this.itemNoise = createNoise2D(this.itemRNG);
  }

  setSeason(season: Season): void {
    const previousSeason = this.currentSeason;
    this.currentSeason = season;

    if (season === Season.SPRING && previousSeason !== Season.SPRING) {
      this.generateSeasonalItems();
    } else if (previousSeason === Season.SPRING && season !== Season.SPRING) {
      this.removeSeasonalItems();
    }

    this.updateAllSprites();
  }

  private generateSeasonalItems(): void {
    const hasFlowers = this.items.some(i => i.type === ItemType.FLOWER);
    if (hasFlowers) return;

    console.log('🌸 春天生成花朵...');
    const mapSize = this.map.getSize();
    let count = 0;

    for (let y = 0; y < mapSize.height; y++) {
      for (let x = 0; x < mapSize.width; x++) {
        const tile = this.map.getTile(x, y);
        if (!tile) continue;

        const tileType = tile.type as TileType;
        const rand = this.itemRNG();
        const def = ITEM_DEFINITIONS[ItemType.FLOWER];

        if (tileType === TileType.GRASS && rand < def.spawn.probability) {
          const item = new GameItem(`seasonal_${Date.now()}_${count}`, ItemType.FLOWER, x, y, this.itemRNG);
          this.items.push(item);
          this.createSprite(item);
          count++;
        } else if (tileType === TileType.PLAINS && rand < def.spawn.probability * 0.5) {
          const item = new GameItem(`seasonal_${Date.now()}_${count}`, ItemType.FLOWER, x, y, this.itemRNG);
          this.items.push(item);
          this.createSprite(item);
          count++;
        }
      }
    }

    console.log(`🌸 生成了 ${count} 朵花`);
  }

  private removeSeasonalItems(): void {
    const flowers = this.items.filter(i => i.type === ItemType.FLOWER);
    if (flowers.length === 0) return;

    console.log(`🍃 移除 ${flowers.length} 朵花...`);

    for (const flower of flowers) {
      const sprite = this.sprites.get(flower.id);
      if (sprite) {
        this.container.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(flower.id);
      }

      const hitbox = this.hitboxes.get(flower.id);
      if (hitbox) {
        this.container.removeChild(hitbox);
        hitbox.destroy();
        this.hitboxes.delete(flower.id);
      }

      const index = this.items.indexOf(flower);
      if (index > -1) {
        this.items.splice(index, 1);
      }
    }
  }

  async init(): Promise<void> {
    this.generateItems();
    await this.loadTextures();
    this.render();
  }

  private generateItems(): void {
    const mapSize = this.map.getSize();

    // 统计地形分布
    const terrainCounts = new Map<TileType, number>();

    for (let y = 0; y < mapSize.height; y++) {
      for (let x = 0; x < mapSize.width; x++) {
        const tile = this.map.getTile(x, y);
        if (!tile) continue;

        const tileType = tile.type as TileType;
        terrainCounts.set(tileType, (terrainCounts.get(tileType) || 0) + 1);

        // 跳过不可生成物品的地形
        if (tileType === TileType.OCEAN || tileType === TileType.LAKE || tileType === TileType.RIVER) {
          continue;
        }

        // 森林地形：每个格子都生成树（100%覆盖）
        if (tileType === TileType.FOREST) {
          // 确定性随机选择树种（1:5比例）
          const hash = (x * 12345 + y * 67890 + this.map.getSeed()) % 100;
          const treeType = hash < 17 ? ItemType.TREE : ItemType.TREE;

          const item = new GameItem(`tree_${x}_${y}`, treeType, x, y, this.itemRNG);
          this.items.push(item);
        } else if (tileType === TileType.GRASS && Math.abs(this.itemNoise(x * 0.3, y * 0.3)) < 0.05) {
          // 灌木 - 5%概率
          const item = new GameItem(`bush_${x}_${y}`, ItemType.BUSH, x, y, this.itemRNG);
          this.items.push(item);
        } else if (tileType === TileType.MOUNTAIN && Math.abs(this.itemNoise(x * 0.4, y * 0.4)) < 0.08) {
          // 石头 - 山地8%概率
          const item = new GameItem(`rock_${x}_${y}`, ItemType.ROCK, x, y, this.itemRNG);
          this.items.push(item);
        } else if (tileType === TileType.HILL && Math.abs(this.itemNoise(x * 0.4, y * 0.4)) < 0.05) {
          // 石头 - 山丘5%概率
          const item = new GameItem(`rock_${x}_${y}`, ItemType.ROCK, x, y, this.itemRNG);
          this.items.push(item);
        } else if (tileType === TileType.BEACH && Math.abs(this.itemNoise(x * 0.6, y * 0.6)) < 0.02) {
          // 贝壳 - 沙滩2%概率
          const item = new GameItem(`shell_${x}_${y}`, ItemType.SHELL, x, y, this.itemRNG);
          this.items.push(item);
        } else if (tileType === TileType.GRASS && Math.abs(this.itemNoise(x * 0.5, y * 0.5)) < 0.03) {
          // 树枝 - 草地3%概率
          const item = new GameItem(`twig_${x}_${y}`, ItemType.TWIG, x, y, this.itemRNG);
          this.items.push(item);
        } else if ((tileType === TileType.GRASS || tileType === TileType.PLAINS) && Math.abs(this.itemNoise(x * 0.8, y * 0.8)) < 0.02) {
          // 石头 - 草地/平原2%概率
          const item = new GameItem(`stone_${x}_${y}`, ItemType.STONE, x, y, this.itemRNG);
          this.items.push(item);
        }
      }
    }

    // 输出地形统计
    console.log('\n🗺️ 地形分布:');
    for (const [type, count] of terrainCounts) {
      console.log(`  ${type}: ${count}块`);
    }

    console.log(`📦 生成了 ${this.items.length} 个物品`);
    this.logItemCounts();
  }

  private logItemCounts(): void {
    const counts = new Map<ItemType, number>();

    for (const item of this.items) {
      counts.set(item.type, (counts.get(item.type) || 0) + 1);
    }

    console.log('\n📊 物品统计:');
    for (const [type, count] of counts) {
      const def = ITEM_DEFINITIONS[type];
      console.log(`  ${def.displayName}: ${count}`);
    }
  }

  private async loadTextures(): Promise<void> {
    const toLoad: string[] = [];

    for (const def of Object.values(ITEM_DEFINITIONS)) {
      const textures = def.textures;
      for (const texture of Object.values(textures)) {
        if (texture && !toLoad.includes(texture)) {
          toLoad.push(texture);
        }
      }
    }

    for (const path of toLoad) {
      try {
        const texture = await PIXI.Assets.load(path);
        this.textureCache.set(path, texture);
      } catch (e) {
        console.warn(`Failed to load: ${path}`);
      }
    }

    console.log(`✅ 加载了 ${this.textureCache.size} 个物品纹理`);
  }

  private getTexture(item: GameItem): PIXI.Texture | null {
    const path = getItemTexture(item.type, this.currentSeason);
    if (!path) return null;

    if (item.type === ItemType.BUSH && item.resource) {
      if (this.currentSeason === Season.WINTER) {
        return this.textureCache.get(ITEM_DEFINITIONS[ItemType.BUSH].textures.winter || path) || null;
      }
      if (this.currentSeason === Season.SPRING) {
        return this.textureCache.get(ITEM_DEFINITIONS[ItemType.BUSH].textures.spring || path) || null;
      }
      if (item.resource.current <= 0) {
        return this.textureCache.get('img/灌木.png') || null;
      }
    }

    if (item.type === ItemType.FLOWER) {
      if (this.currentSeason !== Season.SPRING) {
        return null;
      }
    }

    return this.textureCache.get(path) || null;
  }

  private render(): void {
    for (const layer of ['ground', 'low', 'high'] as const) {
      for (const item of this.items.filter(i => i.layer === layer)) {
        this.createSprite(item);
      }
    }
  }

  private createSprite(item: GameItem): void {
    const texture = this.getTexture(item);
    if (!texture) return;

    const def = ITEM_DEFINITIONS[item.type];
    const sizeConfig = getItemSize(item.type);
    const size = sizeConfig.width;

    const sprite = new PIXI.Sprite(texture);
    const pixelX = item.x * TILE_SIZE + TILE_SIZE / 2;
    const pixelY = item.y * TILE_SIZE + TILE_SIZE / 2;

    sprite.x = pixelX - size / 2;
    sprite.y = pixelY - size / 2;
    sprite.width = size;
    sprite.height = size;

    this.container.addChild(sprite);
    this.sprites.set(item.id, sprite);

    // 所有可交互物品都创建点击区域
    if (def.interaction.canHarvest || def.interaction.canEat || def.interaction.canDrink) {
      const hitbox = new PIXI.Graphics();
      // 点击区域使用整个格子大小，更容易点击
      hitbox.beginFill(0xffffff, 0.001);
      hitbox.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
      hitbox.endFill();
      // 居中放置在格子中心
      hitbox.x = item.x * TILE_SIZE;
      hitbox.y = item.y * TILE_SIZE;
      hitbox.eventMode = 'static';
      hitbox.cursor = 'pointer';
      hitbox.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        console.log('🖱️ 点击物品:', item.id, item.type, item.x, item.y, item.getName());
        if (this.onItemClick) {
          this.onItemClick(item);
        }
      });
      this.container.addChild(hitbox);
      this.hitboxes.set(item.id, hitbox);
    }
  }

  private updateAllSprites(): void {
    for (const [id, sprite] of this.sprites) {
      const item = this.items.find(i => i.id === id);
      if (!item) continue;

      const texture = this.getTexture(item);
      if (texture) {
        sprite.texture = texture;
        sprite.visible = true;
      } else {
        sprite.visible = false;
      }
    }
  }

  updateItem(item: GameItem): void {
    const sprite = this.sprites.get(item.id);
    const hitbox = this.hitboxes.get(item.id);
    if (!sprite) return;

    const texture = this.getTexture(item);
    if (texture) {
      sprite.texture = texture;
      sprite.visible = true;
    } else {
      sprite.visible = false;
    }

    // hitbox 始终保持可见（只要 sprite 可见）
    if (hitbox) {
      hitbox.visible = sprite.visible;
    }
  }

  update(deltaTime: number): void {
    for (const item of this.items) {
      if (item.harvested) {
        item.update(deltaTime);
        this.updateItem(item);
      }
    }
  }

  getItems(): GameItem[] {
    return this.items;
  }

  getItemsByType(type: ItemType): GameItem[] {
    return this.items.filter(i => i.type === type);
  }

  getContainer(): PIXI.Container {
    return this.container;
  }

  harvestItem(itemId: string, amount: number = 1): { success: boolean; harvested: number; message: string } {
    const item = this.items.find(i => i.id === itemId);
    if (!item) {
      return { success: false, harvested: 0, message: '物品不存在' };
    }

    if (!item.hasResources()) {
      return { success: false, harvested: 0, message: '物品已被采集完' };
    }

    const harvested = item.harvest(amount);
    this.updateItem(item);

    const def = ITEM_DEFINITIONS[item.type];
    return {
      success: true,
      harvested,
      message: `采集了 ${harvested} 个${def.displayName}`,
    };
  }
}
