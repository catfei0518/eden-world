/**
 * 地图生成系统 - 与服务器保持一致
 * 
 * 使用与服务器相同的地形生成算法
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

// 地形类型
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

export interface Tile {
  type: TileType;
  height: number;
  moisture: number;
  temperature: number;
}

/**
 * 创建与服务器一致的 RNG
 * 使用与 simplex-noise 相同的线性同余生成器
 */
function createRNG(seed: number): () => number {
    return function() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}

export class GameMap {
  private tiles: Tile[][] = [];
  private width: number;
  private height: number;
  private seed: number;
  private elevationNoise: NoiseFunction2D;
  private moistureNoise: NoiseFunction2D;
  private riverNoise: NoiseFunction2D;
  private lakeNoise: NoiseFunction2D;
  private regionNoise: NoiseFunction2D;
  private detailNoise: NoiseFunction2D;

  constructor(width: number = 300, height: number = 150, seed: number = 12345) {
    this.width = width;
    this.height = height;
    this.seed = seed;

    // 使用与服务器一致的 RNG 创建噪声函数
    const elevationRNG = createRNG(seed);
    const moistureRNG = createRNG(seed + 100);
    const riverRNG = createRNG(seed + 500);
    const lakeRNG = createRNG(seed + 600);
    const regionRNG = createRNG(seed + 700);
    const detailRNG = createRNG(seed + 800);

    this.elevationNoise = createNoise2D(elevationRNG);
    this.moistureNoise = createNoise2D(moistureRNG);
    this.riverNoise = createNoise2D(riverRNG);
    this.lakeNoise = createNoise2D(lakeRNG);
    this.regionNoise = createNoise2D(regionRNG);
    this.detailNoise = createNoise2D(detailRNG);
  }

  /**
   * 获取地图种子
   */
  getSeed(): number {
    return this.seed;
  }
  
  /**
   * 简化版多层噪声 - 性能优化
   */
  private fbm(x: number, y: number, noise: NoiseFunction2D): number {
    // 2层噪声叠加，平衡质量和性能
    return noise(x, y) * 0.7 + noise(x * 2, y * 2) * 0.3;
  }
  
  generate(): void {
    this.tiles = [];
    
    // 第一遍：生成所有水体
    this.generateWaterBodies();
    
    // 第二遍：生成陆地地形
    this.generateLandTerrain();
  }
  
  // 第一遍：生成所有水体
  private generateWaterBodies(): void {
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        // 垂直海拔偏差：北部高，南部低
        const verticalBias = (1 - y / this.height) * 0.35;
        
        // 1. 海洋 - 底部固定3格 + 不规则噪声
        const coastlineNoise = this.regionNoise(x * 0.08, 0);
        const normalizedNoise = (coastlineNoise + 1) / 2; // 归一化到 0-1
        const coastlineVariation = Math.floor(normalizedNoise * 3); // 0 到 3 格变化
        const coastlineHeight = this.height - 3 + coastlineVariation;
        if (y >= coastlineHeight) {
          row.push({ type: TileType.OCEAN, height: 0, moisture: 1, temperature: 0.5 });
          continue;
        }
        
        // 2. 河流 - 扩大范围
        const riverTile = this.isRiverTile(x, y);
        if (riverTile && y > 5 && y < this.height - 5) {
          row.push({ type: TileType.RIVER, height: 0.1, moisture: 1, temperature: 0.5 });
          continue;
        }
        
        // 3. 湖泊 - 扩大范围，增加数量
        const lakeTile = this.isLakeAreaNew(x, y);
        if (lakeTile && y > 8 && y < this.height - 8) {
          row.push({ type: TileType.LAKE, height: 0.1, moisture: 1, temperature: 0.5 });
          continue;
        }
        
        // 非水体格子，先用占位符
        row.push({ type: TileType.GRASS, height: 0.5, moisture: 0.5, temperature: 0.5 });
      }
      this.tiles.push(row);
    }
  }
  
  // 第二遍：生成陆地地形（使用第一遍的水体数据）
  private generateLandTerrain(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];
        
        // 跳过水体
        if (tile.type === TileType.OCEAN || tile.type === TileType.RIVER || tile.type === TileType.LAKE) {
          continue;
        }
        
        // 垂直海拔偏差：北部高，南部低
        const verticalBias = (1 - y / this.height) * 0.35;
        
        // 计算噪声值
        const regionValue = this.regionNoise(x * 0.015, y * 0.015);
        const elevation = this.fbm(x * 0.03, y * 0.03, this.elevationNoise);
        const moisture = this.fbm(x * 0.04, y * 0.04, this.moistureNoise);
        const detail = this.detailNoise(x * 0.1, y * 0.1);
        
        // 合并噪声并加入垂直海拔梯度
        const combinedElevation = elevation * 0.6 + regionValue * 0.2 + detail * 0.2 + verticalBias;
        const combinedMoisture = moisture * 0.7 + regionValue * 0.3;
        
        // 沙滩 - 只在海洋正上方1-2格生成
        if (this.isBeachTile(x, y)) {
          this.tiles[y][x].type = TileType.BEACH;
          continue;
        }
        
        // 根据地形规则决定地形类型
        const terrain = this.getTerrainTypeNew(combinedElevation, combinedMoisture, regionValue, detail, x, y);
        this.tiles[y][x].type = terrain;
        this.tiles[y][x].height = (combinedElevation + 1) / 2;
        this.tiles[y][x].moisture = (combinedMoisture + 1) / 2;
      }
    }
  }
  
  // 检查是否为沙滩格子（只在海洋正上方）
  private isBeachTile(x: number, y: number): boolean {
    // 检查正下方是否是海洋
    if (y + 1 < this.height) {
      const belowTile = this.tiles[y + 1][x];
      if (belowTile && belowTile.type === TileType.OCEAN) {
        return true;
      }
    }
    
    // 检查左下方是否是海洋
    if (y + 1 < this.height && x - 1 >= 0) {
      const belowLeftTile = this.tiles[y + 1][x - 1];
      if (belowLeftTile && belowLeftTile.type === TileType.OCEAN) {
        return true;
      }
    }
    
    // 检查右下方是否是海洋
    if (y + 1 < this.height && x + 1 < this.width) {
      const belowRightTile = this.tiles[y + 1][x + 1];
      if (belowRightTile && belowRightTile.type === TileType.OCEAN) {
        return true;
      }
    }
    
    return false;
  }
  
  // 检测是否为河流格子
  private isRiverTile(x: number, y: number): boolean {
    // 从顶部到底部的河流，稍微窄一点
    const riverX = 0.5 + this.riverNoise(y * 0.05, 0) * 0.2 - 0.1;
    const dist = Math.abs(x / this.width - riverX);
    return dist < 0.015;
  }

  // 新湖泊检测 - 使用区域噪声
  private isLakeAreaNew(x: number, y: number): boolean {
    // 使用区域噪声创建更自然的湖泊
    const lakeCenter1 = this.regionNoise(50, 50) * 0.3 + 0.35;
    const lakeCenter2 = this.regionNoise(150, 80) * 0.3 + 0.65;
    
    const dx1 = x / this.width - lakeCenter1;
    const dy1 = y / this.height - 0.5;
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    const dx2 = x / this.width - lakeCenter2;
    const dy2 = y / this.height - 0.6;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    return dist1 < 0.04 || dist2 < 0.03;
  }

  // 新的地形类型决定函数 - 基于宪法规则
  private getTerrainTypeNew(elevation: number, moisture: number, region: number, detail: number, x: number, y: number): TileType {
    // 归一化到0-1
    const e = (elevation + 1) / 2;
    const m = (moisture + 1) / 2;
    const r = (region + 1) / 2;
    const d = (detail + 1) / 2;
    
    // 根据区域调整湿度
    const regionMoisture = m + (r - 0.5) * 0.3;
    
    // 地形优先级（从高到低）
    // 1. 沙漠 - 低海拔 + 低湿度
        if (e < 0.3 && regionMoisture < 0.3) {
          return TileType.DESERT;
        }
        
        // 2. 平原 - 低海拔 + 较低湿度（扩大范围）
        if (e < 0.5 && regionMoisture < 0.5 && regionMoisture >= 0.2) {
          return TileType.PLAINS;
        }
        
        // 3. 草地 - 低-中海拔 + 中等湿度
        if (e >= 0.35 && e < 0.55 && regionMoisture >= 0.4 && regionMoisture < 0.6) {
          return TileType.GRASS;
        }
    
    // 4. 沼泽 - 低海拔 + 高湿度 + 靠近水体
    if (e < 0.4 && regionMoisture > 0.75 && this.isNearWater(x, y)) {
      return TileType.SWAMP;
    }
    
    // 5. 湿地 - 水体边缘 + 高湿度
    if (this.isNearWater(x, y) && regionMoisture > 0.7) {
      return TileType.MARSH;
    }
    
    // 6. 荒原 - 高海拔 + 低湿度 + 地图上部
        if (y < this.height * 0.5 && e > 0.65 && regionMoisture < 0.4) {
          return TileType.BADLANDS;
        }
        
        // 7. 山地 - 高海拔 + 地图上部（降低阈值）
        if (y < this.height * 0.5 && e > 0.75) {
          return TileType.MOUNTAIN;
        }
        
        // 8. 丘陵 - 中高海拔 + 地图上部（降低阈值）
        if (y < this.height * 0.6 && e > 0.55 && e <= 0.75 && regionMoisture >= 0.35 && regionMoisture < 0.7) {
          return TileType.HILL;
        }
    
    // 9. 森林 - 中高海拔 + 高湿度
    if (e >= 0.45 && e <= 0.75 && regionMoisture > 0.65) {
      return TileType.FOREST;
    }
    
    // 10. 沼泽 - 低海拔 + 高湿度（备用规则）
    if (e < 0.4 && regionMoisture > 0.75) {
      return TileType.SWAMP;
    }
    
    // 11. 草地 - 中等海拔 + 中等湿度
    if (e >= 0.4 && e < 0.6 && regionMoisture >= 0.45 && regionMoisture < 0.65) {
      return TileType.GRASS;
    }
    
    // 12. 平原 - 中低海拔 + 中等湿度
    if (e < 0.5 && regionMoisture >= 0.4 && regionMoisture < 0.6) {
      return TileType.PLAINS;
    }
    
    // 13. 沙漠 - 低海拔干燥
    if (e < 0.4 && regionMoisture < 0.4) {
      return TileType.DESERT;
    }
    
    // 默认返回草地
    return TileType.GRASS;
  }
  
  // 检查是否靠近水体
  private isNearWater(x: number, y: number): boolean {
    // 检查周围5个格子是否有水
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
        
        const tile = this.tiles[ny][nx];
        if (tile && (tile.type === TileType.LAKE || tile.type === TileType.RIVER || tile.type === TileType.OCEAN)) {
          return true;
        }
      }
    }
    return false;
  }
  
  getTile(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }
  
  getSize() { return { width: this.width, height: this.height }; }
  
  printASCII(): string {
    const chars: Record<string, string> = {
      ocean: '~', lake: '~', swamp: '%', plains: '.', grass: ',',
      desert: '*', forest: 'T', mountain: '^', hill: 'n', 
      river: '=', beach: '|', marsh: '~', badlands: 'x'
    };
    
    let out = '';
    for (let y = 0; y < Math.min(50, this.height); y++) {
      for (let x = 0; x < Math.min(100, this.width); x++) {
        out += chars[this.tiles[y][x].type] || '?';
      }
      out += '\n';
    }
    return out;
  }
}
