/**
 * 伊甸世界 - 物品系统导出模块
 *
 * 统一导出所有物品相关的类型和函数
 */

// 导出类型和枚举
export {
  ItemType,
  Season,
  TileType,
  ItemQuality,
  ItemLayerType,
} from './ItemDefinition';

// 导出接口
export type {
  NutritionalElements,
  RiskAttributes,
  SpawnConfig,
  ResourceAttributes,
  InteractionConfig,
  SeasonalConfig,
  SizeConfig,
  TextureConfig,
  ItemDefinition,
} from './ItemDefinition';

export type {
  ItemInstance,
  ItemSpawnerConfig,
} from './ItemSpawner';

export { ItemSpawner } from './ItemSpawner';

// 导出定义表和常量
export {
  ITEM_DEFINITIONS,
} from './ItemDefinition';

// 导出辅助函数
export {
  getItemDefinition,
  canSpawnAt,
  canSpawnInSeason,
  canHarvestInSeason,
  getItemTexture,
  getRandomResourceAmount,
  getItemSize,
  isEdible,
  isDrinkable,
  isHarvestable,
  getSpawnableItems,
  getEdibleItems,
  getDrinkableItems,
} from './ItemDefinition';

// 导出创建函数
export { createItemSpawner } from './ItemSpawner';
