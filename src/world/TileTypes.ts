/**
 * 地形类型定义
 */

// 地形类型枚举
export enum TileType {
  // 基础地形
  PLAIN = 'plain',           // 平原
  GRASS = 'grass',           // 草地
  DESERT = 'desert',         // 沙漠
  FOREST = 'forest',         // 森林
  
  // 水域
  OCEAN = 'ocean',           // 海洋
  LAKE = 'lake',             // 湖泊
  RIVER = 'river',           // 河流
  SWAMP = 'swamp',           // 沼泽
  
  // 山地
  MOUNTAIN = 'mountain',     // 山地
  HILL = 'hill',             // 丘陵
  CLIFF = 'cliff',           // 悬崖
  
  // 特殊
  CAVE = 'cave',             // 洞穴
}

// 地形属性
export interface TileAttributes {
  type: TileType;
  walkable: boolean;        // 是否可通行
  speedFactor: number;      // 速度系数
  frictionFactor: number;   // 摩擦系数
}

// 地形属性表
export const TILE_ATTRIBUTES: { [key in TileType]: TileAttributes } = {
  [TileType.PLAIN]: { type: TileType.PLAIN, walkable: true, speedFactor: 1.0, frictionFactor: 1.0 },
  [TileType.GRASS]: { type: TileType.GRASS, walkable: true, speedFactor: 0.9, frictionFactor: 0.9 },
  [TileType.DESERT]: { type: TileType.DESERT, walkable: true, speedFactor: 0.6, frictionFactor: 0.7 },
  [TileType.FOREST]: { type: TileType.FOREST, walkable: true, speedFactor: 0.7, frictionFactor: 0.9 },
  
  [TileType.OCEAN]: { type: TileType.OCEAN, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
  [TileType.LAKE]: { type: TileType.LAKE, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
  [TileType.RIVER]: { type: TileType.RIVER, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
  [TileType.SWAMP]: { type: TileType.SWAMP, walkable: true, speedFactor: 0.5, frictionFactor: 0.6 },
  
  [TileType.MOUNTAIN]: { type: TileType.MOUNTAIN, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
  [TileType.HILL]: { type: TileType.HILL, walkable: true, speedFactor: 0.5, frictionFactor: 1.0 },
  [TileType.CLIFF]: { type: TileType.CLIFF, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
  
  [TileType.CAVE]: { type: TileType.CAVE, walkable: true, speedFactor: 0.7, frictionFactor: 1.0 },
};

export default TileType;
