/**
 * 物理系统
 * 处理2D世界的物体运动和交互
 */

// ==================== 常量 ====================

// 格子尺寸
export const TILE_SIZE = 64; // 像素
export const TILE_METERS = 1; // 1格 = 1米

// 移动速度 (格/秒)
export const MOVE_SPEED = {
  WALK: 3,      // 步行
  RUN: 6,       // 奔跑
  SLOW: 1.5     // 慢走
};

// 碰撞半径 (格)
export const COLLISION_RADIUS = {
  HUMAN: 0.5,      // 人类
  LARGE: 1.0,     // 大型物体
  SMALL: 0.3      // 小型物体
};

// 重力加速度 (m/s²)
export const GRAVITY = 9.8;
export const MAX_FALL_SPEED = 10; // 最大下落速度

// 跳跃参数
export const JUMP = {
  HEIGHT: 1,        // 高度1格
  DURATION: 0.5,    // 时长0.5秒
  COOLDOWN: 0.5     // 冷却0.5秒
};

// 地形速度系数
export const TERRAIN_SPEED: { [key: string]: number } = {
  PLAIN: 1.0,        // 平原/道路
  GRASS: 0.9,        // 草地
  FOREST: 0.7,       // 森林/灌木
  SAND: 0.6,         // 沙地
  SWAMP: 0.5,        // 沼泽/湿地
  WATER_PASS: 0.3,    // 水域(可通行)
  WATER_BLOCK: 0,     // 水域(不可通行)
  MOUNTAIN_PASS: 0.5, // 山地(可攀爬)
  MOUNTAIN_BLOCK: 0   // 山地(不可攀爬)
};

// 地形摩擦系数
export const TERRAIN_FRICTION: { [key: string]: number } = {
  DIRT: 1.0,     // 土地
  GRASS: 0.9,    // 草地
  SAND: 0.7,     // 沙地
  MUD: 0.6,      // 泥地
  ICE: 0.3,       // 冰面
  STONE: 1.0     // 石头
};

// 负重系统
export const CARRY = {
  HAND_SLOTS: 2,        // 手持位
  BACKPACK_VOLUME: 10,  // 背包体积(格)
  BACKPACK_WEIGHT: 20,  // 背包重量(kg)
  SPEED_PENALTY: 0.1   // 每超重10%速度-10%
};

// ==================== 向量 ====================

/**
 * 2D向量
 */
export class Vector2D {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  add(v: Vector2D): Vector2D {
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  subtract(v: Vector2D): Vector2D {
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2D {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2D(0, 0);
    return new Vector2D(this.x / mag, this.y / mag);
  }

  distanceTo(v: Vector2D): number {
    return this.subtract(v).magnitude();
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  toString(): string {
    return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}

// ==================== 物理体 ====================

/**
 * 物理体状态
 */
export interface PhysicalState {
  position: Vector2D;      // 位置(像素)
  velocity: Vector2D;      // 速度(像素/秒)
  acceleration: Vector2D;   // 加速度(m/s²)
  onGround: boolean;       // 是否在地面上
  isJumping: boolean;      // 是否在跳跃中
  jumpCooldown: number;    // 跳跃冷却时间
}

// ==================== 物理系统 ====================

/**
 * 物理系统
 */
export class PhysicsSystem {
  private state: PhysicalState;

  constructor(x: number = 0, y: number = 0) {
    this.state = {
      position: new Vector2D(x, y),
      velocity: new Vector2D(0, 0),
      acceleration: new Vector2D(0, 0),
      onGround: true,
      isJumping: false,
      jumpCooldown: 0
    };
  }

  /**
   * 获取当前状态
   */
  getState(): PhysicalState {
    return { ...this.state };
  }

  /**
   * 获取位置(格)
   */
  getGridPosition(): Vector2D {
    return new Vector2D(
      this.state.position.x / TILE_SIZE,
      this.state.position.y / TILE_SIZE
    );
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this.state.position.x = x;
    this.state.position.y = y;
  }

  /**
   * 应用力
   */
  applyForce(forceX: number, forceY: number): void {
    this.state.acceleration.x += forceX;
    this.state.acceleration.y += forceY;
  }

  /**
   * 应用重力
   */
  applyGravity(deltaTime: number): void {
    if (!this.state.onGround) {
      // 重力加速度
      const gravityForce = GRAVITY * TILE_SIZE; // 转换为像素
      this.state.velocity.y += gravityForce * deltaTime;
      
      // 限制最大下落速度
      if (this.state.velocity.y > MAX_FALL_SPEED * TILE_SIZE) {
        this.state.velocity.y = MAX_FALL_SPEED * TILE_SIZE;
      }
    }
  }

  /**
   * 跳跃
   */
  jump(): boolean {
    if (this.state.onGround && this.state.jumpCooldown <= 0 && !this.state.isJumping) {
      // 计算跳跃初速度
      // h = v²/2g => v = sqrt(2gh)
      const jumpHeight = JUMP.HEIGHT * TILE_SIZE;
      const jumpVelocity = Math.sqrt(2 * GRAVITY * TILE_SIZE * jumpHeight);
      
      this.state.velocity.y = -jumpVelocity; // 向上为负
      this.state.isJumping = true;
      this.state.onGround = false;
      this.state.jumpCooldown = JUMP.COOLDOWN;
      
      return true;
    }
    return false;
  }

  /**
   * 移动(考虑地形)
   */
  move(direction: Vector2D, speed: number, terrain: string, deltaTime: number): void {
    // 获取地形速度系数
    const terrainSpeed = TERRAIN_SPEED[terrain] || 1.0;
    const effectiveSpeed = speed * terrainSpeed;
    
    // 设置速度
    this.state.velocity.x = direction.x * effectiveSpeed * TILE_SIZE;
    
    // 如果在地面上，应用摩擦力
    if (this.state.onGround) {
      const friction = TERRAIN_FRICTION[terrain] || 1.0;
      // 摩擦力会逐渐减慢速度
      // 简化处理：直接乘以摩擦系数
      // 实际应该用摩擦力公式
    }
  }

  /**
   * 更新物理状态
   */
  update(deltaTime: number): void {
    // 更新加速度(简化处理)
    // F = ma => a = F/m (假设质量为1)
    
    // 更新位置
    // x = x0 + v*dt + 0.5*a*dt²
    this.state.position.x += this.state.velocity.x * deltaTime;
    this.state.position.y += this.state.velocity.y * deltaTime;
    
    // 更新速度
    // v = v0 + a*dt
    this.state.velocity.x += this.state.acceleration.x * deltaTime;
    this.state.velocity.y += this.state.acceleration.y * deltaTime;
    
    // 更新跳跃冷却
    if (this.state.jumpCooldown > 0) {
      this.state.jumpCooldown -= deltaTime;
    }
    
    // 重置加速度
    this.state.acceleration = new Vector2D(0, 0);
  }

  /**
   * 检测碰撞(两个物理体)
   */
  static checkCollision(
    obj1: PhysicsSystem,
    obj2: PhysicsSystem,
    radius1: number,
    radius2: number
  ): boolean {
    const pos1 = obj1.getState().position;
    const pos2 = obj2.getState().position;
    
    const distance = pos1.distanceTo(pos2);
    const minDistance = (radius1 + radius2) * TILE_SIZE;
    
    return distance < minDistance;
  }

  /**
   * 地面碰撞检测
   */
  checkGround(groundLevel: number): boolean {
    const posY = this.state.position.y;
    return posY >= groundLevel;
  }

  /**
   * 着地
   */
  land(groundY: number): void {
    this.state.position.y = groundY;
    this.state.velocity.y = 0;
    this.state.onGround = true;
    this.state.isJumping = false;
  }
}

// ==================== 导出 ====================

export default PhysicsSystem;
