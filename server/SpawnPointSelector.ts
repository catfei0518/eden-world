/**
 * 伊甸世界 - 智能出生点选择系统
 *
 * 按照宪法要求，选择最佳AI出生位置：
 * - 100格内有水源
 * - 50格内有食物来源
 * - 50格内有建材
 * - 200格内无危险地形
 */

export interface Point {
  x: number;
  y: number;
}

export interface SpawnCriteria {
  waterDistance: number;
  foodNearby: number;
  shelterNearby: number;
  dangerLevel: number;
  terrainScore: number;
  totalScore: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  criteria: SpawnCriteria;
}

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
  BUSH = 'bush',
}

export interface GameMap {
  getSize(): { width: number; height: number };
  getTile(x: number, y: number): { type: TileType } | null;
}

export class SpawnPointSelector {
  private map: GameMap;
  private mapWidth: number;
  private mapHeight: number;

  private readonly FOOD_SEARCH_RADIUS = 50;
  private readonly WATER_SEARCH_RADIUS = 100;
  private readonly SHELTER_SEARCH_RADIUS = 50;
  private readonly DANGER_SEARCH_RADIUS = 20;

  private readonly WEIGHTS = {
    water: 0.35,
    food: 0.25,
    shelter: 0.20,
    terrain: 0.15,
    danger: 0.05,
  };

  constructor(map: GameMap) {
    this.map = map;
    const size = map.getSize();
    this.mapWidth = size.width;
    this.mapHeight = size.height;
  }

  selectSpawnPoint(count: number = 2): SpawnPoint[] {
    const candidates = this.generateCandidates(count * 3);
    const evaluated = candidates.map((c) => ({
      ...c,
      criteria: this.evaluatePoint(c.x, c.y),
    }));

    evaluated.sort((a, b) => b.criteria.totalScore - a.criteria.totalScore);

    return this.selectDistributedPoints(evaluated, count);
  }

  private generateCandidates(count: number): Point[] {
    const candidates: Point[] = [];
    const centerX = this.mapWidth / 2;
    const centerY = this.mapHeight / 2;
    const maxRadius = Math.min(centerX, centerY) * 0.6;

    let attempts = 0;
    const maxAttempts = count * 10;

    while (candidates.length < count && attempts < maxAttempts) {
      attempts++;

      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * maxRadius;

      const x = Math.floor(centerX + Math.cos(angle) * distance);
      const y = Math.floor(centerY + Math.sin(angle) * distance);

      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
        continue;
      }

      const tile = this.map.getTile(x, y);
      if (tile && this.isSuitableTerrain(tile.type)) {
        const exists = candidates.some((c) => c.x === x && c.y === y);
        if (!exists) {
          candidates.push({ x, y });
        }
      }
    }

    return candidates;
  }

  private evaluatePoint(x: number, y: number): SpawnCriteria {
    const waterDistance = this.findNearestWater(x, y);
    const foodNearby = this.countNearbyFood(x, y);
    const shelterNearby = this.countNearbyShelter(x, y);
    const dangerLevel = this.assessDanger(x, y);
    const terrainScore = this.assessTerrain(x, y);

    const waterScore = Math.max(0, 1 - waterDistance / this.WATER_SEARCH_RADIUS);
    const foodScore = Math.min(1, foodNearby / 100);
    const shelterScore = Math.min(1, shelterNearby / 50);
    const dangerScore = 1 - dangerLevel;

    const totalScore =
      waterScore * this.WEIGHTS.water +
      foodScore * this.WEIGHTS.food +
      shelterScore * this.WEIGHTS.shelter +
      terrainScore * this.WEIGHTS.terrain +
      dangerScore * this.WEIGHTS.danger;

    return {
      waterDistance,
      foodNearby,
      shelterNearby,
      dangerLevel,
      terrainScore,
      totalScore,
    };
  }

  private findNearestWater(x: number, y: number): number {
    for (let radius = 1; radius <= this.WATER_SEARCH_RADIUS; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const tx = x + dx;
          const ty = y + dy;

          if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
            continue;
          }

          const tile = this.map.getTile(tx, ty);
          if (tile && this.isWaterSource(tile.type)) {
            return radius;
          }
        }
      }
    }

    return this.WATER_SEARCH_RADIUS;
  }

  private countNearbyFood(x: number, y: number): number {
    let count = 0;

    for (let dy = -this.FOOD_SEARCH_RADIUS; dy <= this.FOOD_SEARCH_RADIUS; dy++) {
      for (let dx = -this.FOOD_SEARCH_RADIUS; dx <= this.FOOD_SEARCH_RADIUS; dx++) {
        const tx = x + dx;
        const ty = y + dy;

        if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
          continue;
        }

        const tile = this.map.getTile(tx, ty);
        if (tile) {
          count += this.getTerrainFoodValue(tile.type);
        }
      }
    }

    return count;
  }

  private countNearbyShelter(x: number, y: number): number {
    let count = 0;

    for (let dy = -this.SHELTER_SEARCH_RADIUS; dy <= this.SHELTER_SEARCH_RADIUS; dy++) {
      for (let dx = -this.SHELTER_SEARCH_RADIUS; dx <= this.SHELTER_SEARCH_RADIUS; dx++) {
        const tx = x + dx;
        const ty = y + dy;

        if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
          continue;
        }

        const tile = this.map.getTile(tx, ty);
        if (tile && this.isShelterMaterial(tile.type)) {
          count++;
        }
      }
    }

    return count;
  }

  private assessDanger(x: number, y: number): number {
    const dangers = [TileType.OCEAN, TileType.MOUNTAIN, TileType.SWAMP];
    let dangerLevel = 0;

    for (let dy = -this.DANGER_SEARCH_RADIUS; dy <= this.DANGER_SEARCH_RADIUS; dy++) {
      for (let dx = -this.DANGER_SEARCH_RADIUS; dx <= this.DANGER_SEARCH_RADIUS; dx++) {
        const tx = x + dx;
        const ty = y + dy;

        if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
          continue;
        }

        const tile = this.map.getTile(tx, ty);
        if (tile && dangers.includes(tile.type)) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          dangerLevel += 1 / (distance + 1);
        }
      }
    }

    return Math.min(1, dangerLevel / 10);
  }

  private assessTerrain(x: number, y: number): number {
    const tile = this.map.getTile(x, y);
    if (!tile) return 0;

    const terrainScores: Record<string, number> = {
      [TileType.PLAIN]: 1.0,
      [TileType.GRASS]: 0.9,
      [TileType.BEACH]: 0.7,
      [TileType.HILL]: 0.5,
      [TileType.FOREST]: 0.4,
    };

    return terrainScores[tile.type] ?? 0;
  }

  private selectDistributedPoints(candidates: SpawnPoint[], count: number): SpawnPoint[] {
    const selected: SpawnPoint[] = [];
    const minDistance = 30;

    for (const candidate of candidates) {
      if (selected.length >= count) break;

      let tooClose = false;
      for (const s of selected) {
        const dist = Math.sqrt(Math.pow(candidate.x - s.x, 2) + Math.pow(candidate.y - s.y, 2));
        if (dist < minDistance) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        selected.push(candidate);
      }
    }

    if (selected.length < count) {
      for (const candidate of candidates) {
        if (selected.length >= count) break;
        if (!selected.some((s) => s.x === candidate.x && s.y === candidate.y)) {
          selected.push(candidate);
        }
      }
    }

    return selected;
  }

  private isSuitableTerrain(type: TileType): boolean {
    return [TileType.PLAIN, TileType.GRASS, TileType.BEACH, TileType.HILL].includes(type);
  }

  private isWaterSource(type: TileType): boolean {
    return [TileType.RIVER, TileType.LAKE].includes(type);
  }

  private isShelterMaterial(type: TileType): boolean {
    return [TileType.FOREST, TileType.HILL, TileType.BUSH].includes(type);
  }

  private getTerrainFoodValue(type: TileType): number {
    const foodValues: Record<string, number> = {
      [TileType.FOREST]: 3,
      [TileType.GRASS]: 2,
      [TileType.PLAIN]: 1,
      [TileType.HILL]: 1,
      [TileType.BEACH]: 0.5,
      [TileType.SWAMP]: 1,
    };
    return foodValues[type] ?? 0;
  }
}

export function createSpawnPointSelector(map: GameMap): SpawnPointSelector {
  return new SpawnPointSelector(map);
}
