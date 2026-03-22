/**
 * 地图生成系统 - 修复版
 */

import { createNoise2D, NoiseFunction2D } from 'simplex-noise';

// 地形类型
export enum TileType {
  PLAIN = 'plain',
  GRASS = 'grass',
  DESERT = 'desert',
  FOREST = 'forest',
  OCEAN = 'ocean',
  LAKE = 'lake',
  RIVER = 'river',
  SWAMP = 'swamp',
  MOUNTAIN = 'mountain',
  HILL = 'hill',
  CAVE = 'cave',
}

// 地形
export interface Tile {
  type: TileType;
  height: number;
  moisture: number;
  temperature: number;
}

// 地图类
export class GameMap {
  private tiles: Tile[][] = [];
  private width: number;
  private height: number;
  private noise2D: NoiseFunction2D;
  
  constructor(width: number = 100, height: number = 50, seed: number = Date.now()) {
    this.width = width;
    this.height = height;
    
    // 使用固定seed的简单随机
    const simpleRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    this.noise2D = createNoise2D(simpleRng);
  }
  
  // 生成fbm噪声
  private fbm(x: number, y: number, octaves: number, freq: number, persist: number): number {
    let value = 0;
    let amp = 1;
    let maxVal = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += amp * this.noise2D(x * freq, y * freq);
      maxVal += amp;
      amp *= persist;
      freq *= 2;
    }
    
    return (value / maxVal + 1) / 2;
  }
  
  // 生成地图
  generate(): void {
    this.tiles = [];
    
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        // 使用更低的频率获得更大的连续区域
        const height = this.fbm(x, y, 4, 0.02, 0.5);
        const moisture = this.fbm(x + 1000, y, 3, 0.015, 0.5);
        const temp = this.fbm(x + 2000, y, 2, 0.01, 0.5);
        
        const type = this.getTileType(height, moisture, temp);
        
        row.push({ type, height, moisture, temperature: temp });
      }
      this.tiles.push(row);
    }
  }
  
  // 根据高度、湿度、温度确定地形
  private getTileType(h: number, m: number, t: number): TileType {
    // 水域 (低高度)
    if (h < 0.35) return TileType.OCEAN;
    if (h < 0.4) {
      return m > 0.5 ? TileType.SWAMP : TileType.LAKE;
    }
    
    // 山地 (高高度)
    if (h > 0.75) return TileType.MOUNTAIN;
    if (h > 0.65) return TileType.HILL;
    
    // 根据温度和湿度决定其他地形
    if (t < 0.3) {
      // 寒冷地区
      return m > 0.4 ? TileType.FOREST : TileType.PLAIN;
    } else if (t > 0.7) {
      // 炎热地区
      if (m < 0.3) return TileType.DESERT;
      if (m > 0.6) return TileType.FOREST;
      return TileType.PLAIN;
    } else {
      // 温和地区
      if (m > 0.5) return TileType.FOREST;
      if (m > 0.35) return TileType.GRASS;
      return TileType.PLAIN;
    }
  }
  
  getTile(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }
  
  getSize() { return { width: this.width, height: this.height }; }
  
  printASCII(): string {
    const chars: Record<string, string> = {
      ocean: '~', lake: '~', swamp: '%', plain: '.', grass: ',',
      desert: '*', forest: 'T', mountain: '^', hill: 'n', cave: 'o', river: '='
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
