/**
 * 伊甸世界 - 统一物品定义系统
 *
 * 本模块统一管理所有物品的定义，包括：
 * - 物品类型
 * - 生成规则
 * - 营养属性
 * - 交互行为
 * - 季节配置
 */

/**
 * 物品类型枚举
 * 包含所有可交互物品的类型
 */
export enum ItemType {
  // ========== 自然物品 ==========
  // 可采集自然物
  TREE = 'tree',             // 树
  BUSH = 'bush',             // 灌木丛
  ROCK = 'rock',             // 岩石
  BRANCH = 'branch',         // 树枝
  STICK = 'stick',           // 木棍
  TWIG = 'twig',             // 小树枝
  STONE = 'stone',           // 石头
  FLOWER = 'flower',         // 花朵
  MUSHROOM = 'mushroom',     // 蘑菇

  // ========== 食物类 ==========
  // 可食用物品
  BERRY = 'berry',           // 浆果
  WILD_FRUIT = 'wild_fruit', // 野果
  RAW_MEAT = 'raw_meat',     // 生肉
  COOKED_MEAT = 'cooked_meat', // 熟肉
  FISH = 'fish',             // 鱼
  HERB = 'herb',             // 草药

  // ========== 饮水类 ==========
  RIVER_WATER = 'river_water',   // 河水
  CLEAN_WATER = 'clean_water',   // 净水
  RAIN_WATER = 'rain_water',     // 雨水
  COCONUT = 'coconut',           // 椰子

  // ========== 材料类 ==========
  STONE_TOOL = 'stone_tool',     // 石器
  WOOD_TOOL = 'wood_tool',       // 木器
  FIBER = 'fiber',               // 纤维
  BONE = 'bone',                 // 骨头

  // ========== 特殊物品 ==========
  BONE_TOOL = 'bone_tool',       // 骨器
  SHELL = 'shell',               // 贝壳
  FEATHER = 'feather',           // 羽毛
  EGG = 'egg',                   // 蛋
}

/**
 * 季节枚举
 */
export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  AUTUMN = 'autumn',
  WINTER = 'winter',
}

/**
 * 地形类型（与MapGenerator保持一致）
 */
export enum TileType {
  PLAINS = 'plains',
  GRASS = 'grass',
  DESERT = 'desert',
  FOREST = 'forest',
  OCEAN = 'ocean',
  LAKE = 'lake',
  RIVER = 'river',
  SWAMP = 'swamp',
  MOUNTAIN = 'mountain',
  HILL = 'hill',
  BEACH = 'beach',
  MARSH = 'marsh',
  BADLANDS = 'badlands',
}

/**
 * 物品品质等级
 */
export enum ItemQuality {
  NORMAL = 'normal',     // 普通
  PREMIUM = 'premium',   // 优质
  MUTANT = 'mutant',     // 变异
}

/**
 * 营养元素接口
 */
export interface NutritionalElements {
  calories: number;    // 热量 (kcal)
  water: number;       // 水分 (ml)
  vitamins: number;    // 维生素 (mg)
  protein: number;     // 蛋白质 (g)
  fat: number;         // 脂肪 (g)
  fiber: number;       // 纤维 (g)
}

/**
 * 风险属性接口
 */
export interface RiskAttributes {
  diseaseChance: number;     // 疾病概率 0-1
  parasiteChance: number;    // 寄生虫概率 0-1
  poisonChance: number;     // 中毒概率 0-1
}

/**
 * 生成配置接口
 */
export interface SpawnConfig {
  biomes: TileType[];      // 允许生成的地形
  probability: number;     // 生成概率 0-1
  minPerChunk: number;     // 每区块最小数量
  maxPerChunk: number;     // 每区块最大数量
  layer: ItemLayerType;    // 渲染层级
}

/**
 * 渲染层级类型
 */
export type ItemLayerType = 'ground' | 'low' | 'high';

/**
 * 资源属性接口
 */
export interface ResourceAttributes {
  type: 'durability' | 'quantity' | 'count';
  min: number;
  max: number;
  regrowTime?: number;     // 重生时间（秒）
}

/**
 * 交互配置接口
 */
export interface InteractionConfig {
  canHarvest: boolean;     // 可采集
  canEat: boolean;         // 可食用
  canDrink: boolean;      // 可饮用
  canEquip: boolean;       // 可装备
  canCraft: boolean;      // 可制作
  toolRequired?: ItemType; // 所需工具
}

/**
 * 季节配置接口
 */
export interface SeasonalConfig {
  spawn: Season[];        // 可生成的季节
  harvestable: Season[];  // 可采集的季节
}

/**
 * 物品尺寸配置
 */
export interface SizeConfig {
  width: number;          // 宽度（像素）
  height: number;        // 高度（像素）
}

/**
 * 贴图配置
 */
export interface TextureConfig {
  default: string;        // 默认贴图路径
  spring?: string;        // 春季贴图
  summer?: string;        // 夏季贴图
  autumn?: string;        // 秋季贴图
  winter?: string;        // 冬季贴图
}

/**
 * 物品定义接口
 */
export interface ItemDefinition {
  type: ItemType;                  // 物品类型
  displayName: string;             // 中文名称
  description: string;             // 描述文本

  // 生成配置
  spawn: SpawnConfig;

  // 资源/耐久
  resource?: ResourceAttributes;

  // 营养属性（食物类）
  nutrition?: NutritionalElements;

  // 风险属性
  risk?: RiskAttributes;

  // 交互配置
  interaction: InteractionConfig;

  // 季节配置
  seasonal: SeasonalConfig;

  // 渲染配置
  size: SizeConfig;

  // 贴图配置
  textures: TextureConfig;
}

/**
 * 物品定义表
 */
export const ITEM_DEFINITIONS: Record<ItemType, ItemDefinition> = {
  // ========== 自然物品 ==========

  tree: {
    type: ItemType.TREE,
    displayName: '树',
    description: '高大的树木，可以砍伐获取木材',
    spawn: {
      biomes: [TileType.FOREST],
      probability: 1.0,  // 森林地形100%生成树木
      minPerChunk: 0,
      maxPerChunk: 10,
      layer: 'high',
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 64, height: 64 },
    textures: {
      default: 'img/树.png',
      winter: 'img/树冬.png',
    },
  },

  bush: {
    type: ItemType.BUSH,
    displayName: '灌木丛',
    description: '灌木丛，可以采集树枝和浆果',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS, TileType.HILL],
      probability: 0.10,
      minPerChunk: 0,
      maxPerChunk: 8,
      layer: 'low',
    },
    resource: {
      type: 'durability',
      min: 8,
      max: 20,
      regrowTime: 3600,
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 48, height: 48 },
    textures: {
      default: 'img/灌木.png',
      spring: 'img/灌木花.png',
      summer: 'img/灌木果.png',
      autumn: 'img/灌木果.png',
      winter: 'img/灌木冬.png',
    },
  },

  rock: {
    type: ItemType.ROCK,
    displayName: '岩石',
    description: '大石头，可以采集石块',
    spawn: {
      biomes: [TileType.HILL, TileType.MOUNTAIN, TileType.PLAINS],
      probability: 0.08,
      minPerChunk: 0,
      maxPerChunk: 5,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 40, height: 40 },
    textures: {
      default: 'img/石头.png',
    },
  },

  twig: {
    type: ItemType.TWIG,
    displayName: '小树枝',
    description: '小树枝，可以作为燃料或制作材料',
    spawn: {
      biomes: [TileType.GRASS, TileType.FOREST, TileType.PLAINS],
      probability: 0.03,
      minPerChunk: 0,
      maxPerChunk: 15,
      layer: 'ground',
    },
    resource: {
      type: 'quantity',
      min: 2,
      max: 4,
      regrowTime: 1800,
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/树枝.png',
    },
  },

  stone: {
    type: ItemType.STONE,
    displayName: '石头',
    description: '小石块，可以用于制作工具',
    spawn: {
      biomes: [TileType.GRASS, TileType.PLAINS, TileType.HILL, TileType.MOUNTAIN],
      probability: 0.02,
      minPerChunk: 0,
      maxPerChunk: 10,
      layer: 'ground',
    },
    resource: {
      type: 'quantity',
      min: 1,
      max: 2,
      regrowTime: 3600,
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/石头.png',
    },
  },

  branch: {
    type: ItemType.BRANCH,
    displayName: '树枝',
    description: '树枝，可以作为工具或燃料',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS, TileType.PLAINS],
      probability: 0.08,
      minPerChunk: 0,
      maxPerChunk: 15,
      layer: 'ground',
    },
    resource: {
      type: 'durability',
      min: 1,
      max: 3,
      regrowTime: 1800,
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 40, height: 40 },
    textures: {
      default: 'img/树枝.png',
    },
  },

  stick: {
    type: ItemType.STICK,
    displayName: '木棍',
    description: '细长的木棍，可以作为工具',
    spawn: {
      biomes: [TileType.PLAINS, TileType.GRASS],
      probability: 0.15,
      minPerChunk: 0,
      maxPerChunk: 20,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: true,
      canCraft: true,
      toolRequired: undefined,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 40, height: 40 },
    textures: {
      default: 'img/木棍.png',
    },
  },

  flower: {
    type: ItemType.FLOWER,
    displayName: '花朵',
    description: '美丽的花朵，春季限定',
    spawn: {
      biomes: [TileType.GRASS, TileType.PLAINS],
      probability: 0.05,
      minPerChunk: 0,
      maxPerChunk: 30,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING],
      harvestable: [Season.SPRING],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/花.png',
    },
  },

  mushroom: {
    type: ItemType.MUSHROOM,
    displayName: '蘑菇',
    description: '森林里的蘑菇，注意有些可能有毒',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS],
      probability: 0.03,
      minPerChunk: 0,
      maxPerChunk: 10,
      layer: 'ground',
    },
    nutrition: {
      calories: 20,
      water: 10,
      vitamins: 5,
      protein: 2,
      fat: 0.5,
      fiber: 1,
    },
    risk: {
      diseaseChance: 0,
      parasiteChance: 0,
      poisonChance: 0.15,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.AUTUMN],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/蘑菇.png',
    },
  },

  // ========== 食物类 ==========

  berry: {
    type: ItemType.BERRY,
    displayName: '浆果',
    description: '新鲜浆果，可恢复饱食度和水分',
    spawn: {
      biomes: [TileType.GRASS, TileType.FOREST],
      probability: 0.08,
      minPerChunk: 0,
      maxPerChunk: 10,
      layer: 'low',
    },
    nutrition: {
      calories: 30,
      water: 5,
      vitamins: 10,
      protein: 0.5,
      fat: 0.1,
      fiber: 2,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 48, height: 48 },
    textures: {
      default: 'img/灌木果.png',
      summer: 'img/灌木果.png',
      autumn: 'img/灌木果.png',
    },
  },

  wild_fruit: {
    type: ItemType.WILD_FRUIT,
    displayName: '野果',
    description: '野外生长的水果，营养丰富',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS],
      probability: 0.04,
      minPerChunk: 0,
      maxPerChunk: 8,
      layer: 'low',
    },
    nutrition: {
      calories: 50,
      water: 10,
      vitamins: 15,
      protein: 1,
      fat: 0.2,
      fiber: 3,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/野果.png',
    },
  },

  raw_meat: {
    type: ItemType.RAW_MEAT,
    displayName: '生肉',
    description: '新鲜的生肉，食用有疾病风险',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    nutrition: {
      calories: 250,
      water: 0,
      vitamins: 0,
      protein: 26,
      fat: 15,
      fiber: 0,
    },
    risk: {
      diseaseChance: 0.05,
      parasiteChance: 0.03,
      poisonChance: 0,
    },
    interaction: {
      canHarvest: false,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/生肉.png',
    },
  },

  cooked_meat: {
    type: ItemType.COOKED_MEAT,
    displayName: '熟肉',
    description: '烹饪后的肉，安全美味',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    nutrition: {
      calories: 300,
      water: 0,
      vitamins: 0,
      protein: 30,
      fat: 12,
      fiber: 0,
    },
    interaction: {
      canHarvest: false,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/熟肉.png',
    },
  },

  fish: {
    type: ItemType.FISH,
    displayName: '鱼',
    description: '新鲜的鱼，富含蛋白质',
    spawn: {
      biomes: [TileType.RIVER, TileType.LAKE],
      probability: 0.02,
      minPerChunk: 0,
      maxPerChunk: 5,
      layer: 'ground',
    },
    nutrition: {
      calories: 100,
      water: 0,
      vitamins: 5,
      protein: 20,
      fat: 3,
      fiber: 0,
    },
    risk: {
      diseaseChance: 0.02,
      parasiteChance: 0.01,
      poisonChance: 0,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/鱼.png',
    },
  },

  herb: {
    type: ItemType.HERB,
    displayName: '草药',
    description: '有药用价值的草本植物',
    spawn: {
      biomes: [TileType.GRASS, TileType.FOREST],
      probability: 0.04,
      minPerChunk: 0,
      maxPerChunk: 8,
      layer: 'ground',
    },
    nutrition: {
      calories: 20,
      water: 60,
      vitamins: 8,
      protein: 1,
      fat: 0.2,
      fiber: 2,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/草药.png',
    },
  },

  // ========== 饮水类 ==========

  river_water: {
    type: ItemType.RIVER_WATER,
    displayName: '河水',
    description: '从河流中取的水，需要煮沸后才能安全饮用',
    spawn: {
      biomes: [TileType.RIVER, TileType.LAKE],
      probability: 1.0,
      minPerChunk: 0,
      maxPerChunk: 1,
      layer: 'ground',
    },
    nutrition: {
      calories: 0,
      water: 100,
      vitamins: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
    },
    risk: {
      diseaseChance: 0.05,
      parasiteChance: 0.02,
      poisonChance: 0,
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: true,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/水.png',
    },
  },

  clean_water: {
    type: ItemType.CLEAN_WATER,
    displayName: '净水',
    description: '经过处理的干净水',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    nutrition: {
      calories: 0,
      water: 100,
      vitamins: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: true,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/净水.png',
    },
  },

  rain_water: {
    type: ItemType.RAIN_WATER,
    displayName: '雨水',
    description: '收集的雨水，需要煮沸后饮用',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    nutrition: {
      calories: 0,
      water: 80,
      vitamins: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
    },
    risk: {
      diseaseChance: 0.01,
      parasiteChance: 0,
      poisonChance: 0,
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: true,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.AUTUMN],
      harvestable: [Season.SPRING, Season.AUTUMN],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/雨水.png',
    },
  },

  coconut: {
    type: ItemType.COCONUT,
    displayName: '椰子',
    description: '海边发现的椰子，可以饮用和食用',
    spawn: {
      biomes: [TileType.BEACH],
      probability: 0.02,
      minPerChunk: 0,
      maxPerChunk: 3,
      layer: 'ground',
    },
    nutrition: {
      calories: 150,
      water: 50,
      vitamins: 5,
      protein: 3,
      fat: 15,
      fiber: 5,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: true,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/椰子.png',
    },
  },

  // ========== 材料类 ==========

  stone_tool: {
    type: ItemType.STONE_TOOL,
    displayName: '石制工具',
    description: '用石头制作的工具',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    resource: {
      type: 'durability',
      min: 30,
      max: 50,
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: false,
      canEquip: true,
      canCraft: true,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/石斧.png',
    },
  },

  wood_tool: {
    type: ItemType.WOOD_TOOL,
    displayName: '木制工具',
    description: '用木材制作的工具',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    resource: {
      type: 'durability',
      min: 20,
      max: 40,
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: false,
      canEquip: true,
      canCraft: true,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/木矛.png',
    },
  },

  fiber: {
    type: ItemType.FIBER,
    displayName: '纤维',
    description: '植物纤维，可用于制作绳索',
    spawn: {
      biomes: [TileType.GRASS, TileType.FOREST],
      probability: 0.06,
      minPerChunk: 0,
      maxPerChunk: 10,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SUMMER, Season.AUTUMN],
      harvestable: [Season.SUMMER, Season.AUTUMN],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/纤维.png',
    },
  },

  bone: {
    type: ItemType.BONE,
    displayName: '骨头',
    description: '动物骨头，可用于制作骨器',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/骨头.png',
    },
  },

  // ========== 特殊物品 ==========

  bone_tool: {
    type: ItemType.BONE_TOOL,
    displayName: '骨制工具',
    description: '用骨头制作的工具',
    spawn: {
      biomes: [],
      probability: 0,
      minPerChunk: 0,
      maxPerChunk: 0,
      layer: 'ground',
    },
    resource: {
      type: 'durability',
      min: 25,
      max: 45,
    },
    interaction: {
      canHarvest: false,
      canEat: false,
      canDrink: false,
      canEquip: true,
      canCraft: true,
    },
    seasonal: {
      spawn: [],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 32, height: 32 },
    textures: {
      default: 'img/骨针.png',
    },
  },

  shell: {
    type: ItemType.SHELL,
    displayName: '贝壳',
    description: '海边的贝壳，可用于制作工具或容器',
    spawn: {
      biomes: [TileType.BEACH],
      probability: 0.05,
      minPerChunk: 0,
      maxPerChunk: 15,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
      harvestable: [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/贝壳.png',
    },
  },

  feather: {
    type: ItemType.FEATHER,
    displayName: '羽毛',
    description: '鸟类的羽毛，可用于制作箭矢',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS],
      probability: 0.02,
      minPerChunk: 0,
      maxPerChunk: 8,
      layer: 'ground',
    },
    interaction: {
      canHarvest: true,
      canEat: false,
      canDrink: false,
      canEquip: false,
      canCraft: true,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER],
      harvestable: [Season.SPRING, Season.SUMMER],
    },
    size: { width: 16, height: 16 },
    textures: {
      default: 'img/羽毛.png',
    },
  },

  egg: {
    type: ItemType.EGG,
    displayName: '蛋',
    description: '鸟蛋，可以食用',
    spawn: {
      biomes: [TileType.FOREST, TileType.GRASS],
      probability: 0.01,
      minPerChunk: 0,
      maxPerChunk: 3,
      layer: 'ground',
    },
    nutrition: {
      calories: 140,
      water: 0,
      vitamins: 8,
      protein: 13,
      fat: 10,
      fiber: 0,
    },
    interaction: {
      canHarvest: true,
      canEat: true,
      canDrink: false,
      canEquip: false,
      canCraft: false,
    },
    seasonal: {
      spawn: [Season.SPRING, Season.SUMMER],
      harvestable: [Season.SPRING, Season.SUMMER],
    },
    size: { width: 24, height: 24 },
    textures: {
      default: 'img/蛋.png',
    },
  },
};

/**
 * 获取物品定义
 * @param type 物品类型
 * @returns 物品定义或null
 */
export function getItemDefinition(type: ItemType): ItemDefinition | null {
  return ITEM_DEFINITIONS[type] || null;
}

/**
 * 检查物品是否可在指定地形生成
 * @param type 物品类型
 * @param biome 地形类型
 * @returns 是否可以生成
 */
export function canSpawnAt(type: ItemType, biome: TileType): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.spawn.biomes.includes(biome) ?? false;
}

/**
 * 检查物品是否可在指定季节生成
 * @param type 物品类型
 * @param season 季节
 * @returns 是否可以生成
 */
export function canSpawnInSeason(type: ItemType, season: Season): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.seasonal.spawn.includes(season) ?? false;
}

/**
 * 检查物品是否可在指定季节采集
 * @param type 物品类型
 * @param season 季节
 * @returns 是否可以采集
 */
export function canHarvestInSeason(type: ItemType, season: Season): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.seasonal.harvestable.includes(season) ?? false;
}

/**
 * 获取物品的贴图路径
 * @param type 物品类型
 * @param season 当前季节
 * @returns 贴图路径
 */
export function getItemTexture(type: ItemType, season: Season): string {
  const def = ITEM_DEFINITIONS[type];
  if (!def) return '';

  const seasonalTextures = def.textures;
  switch (season) {
    case Season.SPRING:
      return seasonalTextures.spring || seasonalTextures.default;
    case Season.SUMMER:
      return seasonalTextures.summer || seasonalTextures.default;
    case Season.AUTUMN:
      return seasonalTextures.autumn || seasonalTextures.default;
    case Season.WINTER:
      return seasonalTextures.winter || seasonalTextures.default;
    default:
      return seasonalTextures.default;
  }
}

/**
 * 获取物品的随机资源数量
 * @param type 物品类型
 * @returns 资源数量
 */
export function getRandomResourceAmount(type: ItemType): number {
  const def = ITEM_DEFINITIONS[type];
  if (!def?.resource) return 1;

  const { min, max } = def.resource;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 获取物品的尺寸
 * @param type 物品类型
 * @returns 尺寸配置
 */
export function getItemSize(type: ItemType): SizeConfig {
  const def = ITEM_DEFINITIONS[type];
  return def?.size || { width: 40, height: 40 };
}

/**
 * 检查物品是否可食用
 * @param type 物品类型
 * @returns 是否可食用
 */
export function isEdible(type: ItemType): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.interaction.canEat ?? false;
}

/**
 * 检查物品是否可饮用
 * @param type 物品类型
 * @returns 是否可饮用
 */
export function isDrinkable(type: ItemType): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.interaction.canDrink ?? false;
}

/**
 * 检查物品是否可采集
 * @param type 物品类型
 * @returns 是否可采集
 */
export function isHarvestable(type: ItemType): boolean {
  const def = ITEM_DEFINITIONS[type];
  return def?.interaction.canHarvest ?? false;
}

/**
 * 获取所有可生成物品类型
 * @param biome 地形类型
 * @param season 季节
 * @returns 可生成物品类型数组
 */
export function getSpawnableItems(biome: TileType, season: Season): ItemType[] {
  const items: ItemType[] = [];

  for (const [type, def] of Object.entries(ITEM_DEFINITIONS)) {
    if (
      def.spawn.biomes.includes(biome) &&
      def.seasonal.spawn.includes(season) &&
      def.spawn.probability > 0
    ) {
      items.push(type as ItemType);
    }
  }

  return items;
}

/**
 * 获取所有可食用物品
 * @returns 可食用物品类型数组
 */
export function getEdibleItems(): ItemType[] {
  const items: ItemType[] = [];

  for (const [type, def] of Object.entries(ITEM_DEFINITIONS)) {
    if (def.interaction.canEat) {
      items.push(type as ItemType);
    }
  }

  return items;
}

/**
 * 获取所有可饮用物品
 * @returns 可饮用物品类型数组
 */
export function getDrinkableItems(): ItemType[] {
  const items: ItemType[] = [];

  for (const [type, def] of Object.entries(ITEM_DEFINITIONS)) {
    if (def.interaction.canDrink) {
      items.push(type as ItemType);
    }
  }

  return items;
}
