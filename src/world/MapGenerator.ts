/**
 * 地图生成系统 - 自然岛屿版 v4
 * 
 * 只相邻两边有海，海岸线不规则
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
  BEACH = 'beach',
}

export interface Tile {
  type: TileType;
  height: number;
  moisture: number;
  temperature: number;
}

export class GameMap {
  private tiles: Tile[][] = [];
  private width: number;
  private height: number;
  private noise2D: NoiseFunction2D;
  private riverTiles: Set<string> = new Set();
  
  constructor(width: number = 100, height: number = 50, seed: number = Date.now()) {
    this.width = width;
    this.height = height;
    
    const simpleRng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    this.noise2D = createNoise2D(simpleRng);
  }
  
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
  
  generate(): void {
    this.tiles = [];
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // 生成河流
    this.generateRivers(centerX, centerY);
    
    // 随机选择哪两边有海（相邻的两边）
    const oceanSides = this.selectOceanSides();
    
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        const baseNoise = this.fbm(x * 0.04, y * 0.04, 4, 1, 0.5);
        const detailNoise = this.fbm(x * 0.1, y * 0.1, 2, 1, 0.5);
        
        let height = baseNoise * 0.7 + detailNoise * 0.3;
        
        const moisture = this.fbm(x * 0.03 + 500, y * 0.03, 3, 1, 0.5);
        const temperature = this.fbm(x * 0.02 + 1000, y * 0.02, 2, 1, 0.5);
        
        // 计算到每边的距离
        const leftDist = x;
        const rightDist = this.width - 1 - x;
        const topDist = y;
        const bottomDist = this.height - 1 - y;
        
        // 计算是否是海洋
        let isOcean = false;
        const maxOceanDepth = 15; // 海洋最大深度
        
        for (const side of oceanSides) {
          let dist = 0;
          if (side === 'left') dist = leftDist;
          if (side === 'right') dist = rightDist;
          if (side === 'top') dist = topDist;
          if (side === 'bottom') dist = bottomDist;
          
          // 海洋边缘用噪声变得不规则
          const edgeNoise = this.fbm(x * 0.2, y * 0.2, 2, 2, 0.5);
          const oceanLimit = maxOceanDepth + edgeNoise * 5;
          
          if (dist < oceanLimit) {
            isOcean = true;
          }
        }
        
        if (isOcean) {
          height = 0.1;
        }
        
        const type = this.getTileType(height, moisture, temperature, x, y);
        
        row.push({ type, height, moisture, temperature });
      }
      this.tiles.push(row);
    }
    
    this.addBeachBorder();
  }
  
  // 随机选择相邻的两边
  private selectOceanSides(): string[] {
    // 相邻边的组合
    const adjacentPairs = [
      ['left', 'top'],
      ['left', 'bottom'],
      ['right', 'top'],
      ['right', 'bottom'],
      ['top', 'bottom'], // 上下也是相邻的
      ['left', 'right'], // 左右也是相邻的（形成左海+右海）
    ];
    
    const index = Math.floor(this.fbm(Date.now(), 0, 1, 1, 1) * adjacentPairs.length);
    return adjacentPairs[index % adjacentPairs.length];
  }
  
  private generateRivers(cx: number, cy: number): void {
    const numRivers = 2;
    
    for (let i = 0; i < numRivers; i++) {
      let x = cx;
      let y = cy;
      const dir = i === 0 ? 1 : -1;
      
      for (let step = 0; step < 50; step++) {
        this.riverTiles.add(`${Math.floor(x)},${Math.floor(y)}`);
        
        const noiseVal = this.noise2D(x * 0.2, y * 0.2);
        
        if (noiseVal > 0.2) {
          x += dir * 0.7;
          y += 0.6;
        } else if (noiseVal < -0.2) {
          x -= dir * 0.3;
          y += 0.8;
        } else {
          y += 1;
        }
        
        if (x < 10 || x > this.width - 10 || y > this.height - 10) {
          break;
        }
      }
    }
  }
  
  private addBeachBorder(): void {
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const tile = this.tiles[y][x];
        
        if (tile.type === TileType.OCEAN) {
          const neighbors = [[x-1, y], [x+1, y], [x, y-1], [x, y+1]];
          
          for (const [nx, ny] of neighbors) {
            if (this.tiles[ny][nx].type !== TileType.OCEAN) {
              this.tiles[ny][nx].type = TileType.BEACH;
            }
          }
        }
      }
    }
  }
  
  private getTileType(h: number, m: number, t: number, x: number, y: number): TileType {
    if (this.riverTiles.has(`${x},${y}`)) {
      return TileType.RIVER;
    }
    
    if (h < 0.2) {
      return TileType.OCEAN;
    }
    
    if (h < 0.3) {
      return TileType.LAKE;
    }
    
    if (h > 0.78) {
      return TileType.MOUNTAIN;
    }
    
    if (h > 0.65) {
      return TileType.HILL;
    }
    
    if (t > 0.75 && m < 0.3) {
      return TileType.DESERT;
    }
    
    if (m > 0.6 && t > 0.25 && t < 0.7) {
      return TileType.FOREST;
    }
    
    if (h < 0.35 && m > 0.7) {
      return TileType.SWAMP;
    }
    
    if (m > 0.4) {
      return TileType.GRASS;
    }
    
    return TileType.PLAIN;
  }
  
  getTile(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.tiles[y][x];
  }
  
  getSize() { return { width: this.width, height: this.height }; }
  
  printASCII(): string {
    const chars: Record<string, string> = {
      ocean: '~', lake: '~', swamp: '%', plain: '.', grass: ',',
      desert: '*', forest: 'T', mountain: '^', hill: 'n', cave: 'o', 
      river: '=', beach: '|'
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
