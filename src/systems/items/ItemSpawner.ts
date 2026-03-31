/**
 * 伊甸世界 - 物品生成系统
 *
 * 本模块负责根据地形和季节生成物品实例
 */

import {
  ItemType,
  Season,
  TileType,
  ItemDefinition,
  ITEM_DEFINITIONS,
  getSpawnableItems,
  getRandomResourceAmount,
} from './ItemDefinition';

/**
 * 物品实例接口
 */
export interface ItemInstance {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  layer: 'ground' | 'low' | 'high';

  // 资源/耐久
  resource?: {
    current: number;
    max: number;
    regrowTime?: number;
    regrowTimer?: number;
  };

  // 位置状态
  harvested: boolean;
  lastHarvestTime?: number;
}

/**
 * 物品生成器配置
 */
export interface ItemSpawnerConfig {
  mapWidth: number;
  mapHeight: number;
  seed?: number;
}

/**
 * 物品生成器类
 */
export class ItemSpawner {
  private config: ItemSpawnerConfig;
  private items: ItemInstance[] = [];
  private itemIdCounter: number = 0;

  constructor(config: ItemSpawnerConfig) {
    this.config = config;
  }

  /**
   * 生成所有物品
   * @param getTileType 获取指定坐标的地形类型
   * @param currentSeason 当前季节
   */
  generateItems(
    getTileType: (x: number, y: number) => TileType,
    currentSeason: Season
  ): ItemInstance[] {
    this.items = [];
    this.itemIdCounter = 0;

    const { mapWidth, mapHeight } = this.config;

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const biome = getTileType(x, y);
        this.generateItemsAtPosition(x, y, biome, currentSeason);
      }
    }

    console.log(`📦 生成了 ${this.items.length} 个物品`);
    this.logItemCounts();

    return this.items;
  }

  /**
   * 在指定位置生成物品
   */
  private generateItemsAtPosition(
    x: number,
    y: number,
    biome: TileType,
    season: Season
  ): void {
    const spawnableItems = getSpawnableItems(biome, season);

    for (const itemType of spawnableItems) {
      const def = ITEM_DEFINITIONS[itemType];

      if (def.spawn.probability <= 0) continue;

      const rand = this.random();

      if (rand < def.spawn.probability) {
        const item = this.createItemInstance(itemType, x, y, def);
        this.items.push(item);
      }
    }
  }

  /**
   * 创建物品实例
   */
  private createItemInstance(
    type: ItemType,
    x: number,
    y: number,
    def: ItemDefinition
  ): ItemInstance {
    const id = this.generateItemId();

    const instance: ItemInstance = {
      id,
      type,
      x,
      y,
      layer: def.spawn.layer,
      harvested: false,
    };

    if (def.resource) {
      const amount = getRandomResourceAmount(type);
      instance.resource = {
        current: amount,
        max: amount,
        regrowTime: def.resource.regrowTime,
        regrowTimer: 0,
      };
    }

    return instance;
  }

  /**
   * 生成物品ID
   */
  private generateItemId(): string {
    return `item_${this.itemIdCounter++}_${Date.now()}`;
  }

  /**
   * 简单随机数生成器
   */
  private random(): number {
    return Math.random();
  }

  /**
   * 更新物品状态（重生逻辑）
   * @param deltaTime 距离上次更新的时间（秒）
   */
  update(deltaTime: number): void {
    for (const item of this.items) {
      if (
        item.harvested &&
        item.resource &&
        item.resource.regrowTime &&
        item.resource.regrowTimer !== undefined
      ) {
        item.resource.regrowTimer += deltaTime;

        if (item.resource.regrowTimer >= item.resource.regrowTime) {
          item.harvested = false;
          item.resource.current = item.resource.max;
          item.resource.regrowTimer = 0;
          item.lastHarvestTime = undefined;
        }
      }
    }
  }

  /**
   * 采集物品
   */
  harvest(itemId: string, amount: number = 1): { success: boolean; remaining: number; message: string } {
    const item = this.items.find(i => i.id === itemId);

    if (!item) {
      return { success: false, remaining: 0, message: '物品不存在' };
    }

    if (item.harvested) {
      return { success: false, remaining: 0, message: '物品已被采集完' };
    }

    if (!item.resource || item.resource.current <= 0) {
      return { success: false, remaining: 0, message: '物品没有资源' };
    }

    const harvestAmount = Math.min(amount, item.resource.current);
    item.resource.current -= harvestAmount;
    item.lastHarvestTime = Date.now();

    if (item.resource.current <= 0) {
      item.harvested = true;

      if (item.resource.regrowTime) {
        item.resource.regrowTimer = 0;
      }

      return {
        success: true,
        remaining: 0,
        message: `采集了 ${harvestAmount} 个物品`,
      };
    }

    return {
      success: true,
      remaining: item.resource.current,
      message: `采集了 ${harvestAmount} 个物品，剩余 ${item.resource.current} 个`,
    };
  }

  /**
   * 获取所有物品
   */
  getItems(): ItemInstance[] {
    return this.items;
  }

  /**
   * 获取特定类型的物品
   */
  getItemsByType(type: ItemType): ItemInstance[] {
    return this.items.filter(i => i.type === type);
  }

  /**
   * 获取指定范围内的物品
   */
  getItemsInRange(x: number, y: number, radius: number): ItemInstance[] {
    return this.items.filter(item => {
      const dx = item.x - x;
      const dy = item.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /**
   * 获取指定坐标的物品
   */
  getItemsAtPosition(x: number, y: number): ItemInstance[] {
    return this.items.filter(item => item.x === x && item.y === y);
  }

  /**
   * 检查物品是否可以采集
   */
  canHarvest(itemId: string): boolean {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;

    if (item.harvested) return false;

    if (item.resource && item.resource.current <= 0) return false;

    return true;
  }

  /**
   * 获取可采集的物品
   */
  getHarvestableItems(x: number, y: number, maxDistance: number = 2): ItemInstance[] {
    return this.items.filter(item => {
      if (item.harvested) return false;
      if (!item.resource || item.resource.current <= 0) return false;

      const dx = item.x - x;
      const dy = item.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return distance <= maxDistance;
    });
  }

  /**
   * 移除物品
   */
  removeItem(itemId: string): boolean {
    const index = this.items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    this.items.splice(index, 1);
    return true;
  }

  /**
   * 清除所有物品
   */
  clear(): void {
    this.items = [];
    this.itemIdCounter = 0;
  }

  /**
   * 获取物品数量统计
   */
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

  /**
   * 获取物品数量统计
   */
  getItemCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const item of this.items) {
      const def = ITEM_DEFINITIONS[item.type];
      const name = def?.displayName || item.type;
      counts[name] = (counts[name] || 0) + 1;
    }

    return counts;
  }

  /**
   * 序列化物品数据
   */
  toJSON(): any {
    return {
      items: this.items,
      itemIdCounter: this.itemIdCounter,
    };
  }

  /**
   * 从序列化数据恢复
   */
  fromJSON(data: any): void {
    if (data.items) {
      this.items = data.items;
      this.itemIdCounter = data.itemIdCounter || 0;
    }
  }
}

/**
 * 创建物品生成器
 */
export function createItemSpawner(config: ItemSpawnerConfig): ItemSpawner {
  return new ItemSpawner(config);
}
