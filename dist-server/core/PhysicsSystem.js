"use strict";
/**
 * 物理系统
 * 处理2D世界的物体运动和交互
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsSystem = exports.Vector2D = exports.CARRY = exports.TERRAIN_FRICTION = exports.TERRAIN_SPEED = exports.JUMP = exports.MAX_FALL_SPEED = exports.GRAVITY = exports.COLLISION_RADIUS = exports.MOVE_SPEED = exports.TILE_METERS = exports.TILE_SIZE = void 0;
// ==================== 常量 ====================
// 格子尺寸
exports.TILE_SIZE = 64; // 像素
exports.TILE_METERS = 1; // 1格 = 1米
// 移动速度 (格/秒)
exports.MOVE_SPEED = {
    WALK: 3, // 步行
    RUN: 6, // 奔跑
    SLOW: 1.5 // 慢走
};
// 碰撞半径 (格)
exports.COLLISION_RADIUS = {
    HUMAN: 0.5, // 人类
    LARGE: 1.0, // 大型物体
    SMALL: 0.3 // 小型物体
};
// 重力加速度 (m/s²)
exports.GRAVITY = 9.8;
exports.MAX_FALL_SPEED = 10; // 最大下落速度
// 跳跃参数
exports.JUMP = {
    HEIGHT: 1, // 高度1格
    DURATION: 0.5, // 时长0.5秒
    COOLDOWN: 0.5 // 冷却0.5秒
};
// 地形速度系数
exports.TERRAIN_SPEED = {
    PLAIN: 1.0, // 平原/道路
    GRASS: 0.9, // 草地
    FOREST: 0.7, // 森林/灌木
    SAND: 0.6, // 沙地
    SWAMP: 0.5, // 沼泽/湿地
    WATER_PASS: 0.3, // 水域(可通行)
    WATER_BLOCK: 0, // 水域(不可通行)
    MOUNTAIN_PASS: 0.5, // 山地(可攀爬)
    MOUNTAIN_BLOCK: 0 // 山地(不可攀爬)
};
// 地形摩擦系数
exports.TERRAIN_FRICTION = {
    DIRT: 1.0, // 土地
    GRASS: 0.9, // 草地
    SAND: 0.7, // 沙地
    MUD: 0.6, // 泥地
    ICE: 0.3, // 冰面
    STONE: 1.0 // 石头
};
// 负重系统
exports.CARRY = {
    HAND_SLOTS: 2, // 手持位
    BACKPACK_VOLUME: 10, // 背包体积(格)
    BACKPACK_WEIGHT: 20, // 背包重量(kg)
    SPEED_PENALTY: 0.1 // 每超重10%速度-10%
};
// ==================== 向量 ====================
/**
 * 2D向量
 */
class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) {
        return new Vector2D(this.x + v.x, this.y + v.y);
    }
    subtract(v) {
        return new Vector2D(this.x - v.x, this.y - v.y);
    }
    multiply(scalar) {
        return new Vector2D(this.x * scalar, this.y * scalar);
    }
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    normalize() {
        const mag = this.magnitude();
        if (mag === 0)
            return new Vector2D(0, 0);
        return new Vector2D(this.x / mag, this.y / mag);
    }
    distanceTo(v) {
        return this.subtract(v).magnitude();
    }
    clone() {
        return new Vector2D(this.x, this.y);
    }
    toString() {
        return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
    }
}
exports.Vector2D = Vector2D;
// ==================== 物理系统 ====================
/**
 * 物理系统
 */
class PhysicsSystem {
    constructor(x = 0, y = 0) {
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
    getState() {
        return { ...this.state };
    }
    /**
     * 获取位置(格)
     */
    getGridPosition() {
        return new Vector2D(this.state.position.x / exports.TILE_SIZE, this.state.position.y / exports.TILE_SIZE);
    }
    /**
     * 设置位置
     */
    setPosition(x, y) {
        this.state.position.x = x;
        this.state.position.y = y;
    }
    /**
     * 应用力
     */
    applyForce(forceX, forceY) {
        this.state.acceleration.x += forceX;
        this.state.acceleration.y += forceY;
    }
    /**
     * 应用重力
     */
    applyGravity(deltaTime) {
        if (!this.state.onGround) {
            // 重力加速度
            const gravityForce = exports.GRAVITY * exports.TILE_SIZE; // 转换为像素
            this.state.velocity.y += gravityForce * deltaTime;
            // 限制最大下落速度
            if (this.state.velocity.y > exports.MAX_FALL_SPEED * exports.TILE_SIZE) {
                this.state.velocity.y = exports.MAX_FALL_SPEED * exports.TILE_SIZE;
            }
        }
    }
    /**
     * 跳跃
     */
    jump() {
        if (this.state.onGround && this.state.jumpCooldown <= 0 && !this.state.isJumping) {
            // 计算跳跃初速度
            // h = v²/2g => v = sqrt(2gh)
            const jumpHeight = exports.JUMP.HEIGHT * exports.TILE_SIZE;
            const jumpVelocity = Math.sqrt(2 * exports.GRAVITY * exports.TILE_SIZE * jumpHeight);
            this.state.velocity.y = -jumpVelocity; // 向上为负
            this.state.isJumping = true;
            this.state.onGround = false;
            this.state.jumpCooldown = exports.JUMP.COOLDOWN;
            return true;
        }
        return false;
    }
    /**
     * 移动(考虑地形)
     */
    move(direction, speed, terrain, deltaTime) {
        // 获取地形速度系数
        const terrainSpeed = exports.TERRAIN_SPEED[terrain] || 1.0;
        const effectiveSpeed = speed * terrainSpeed;
        // 设置速度
        this.state.velocity.x = direction.x * effectiveSpeed * exports.TILE_SIZE;
        // 如果在地面上，应用摩擦力
        if (this.state.onGround) {
            const friction = exports.TERRAIN_FRICTION[terrain] || 1.0;
            // 摩擦力会逐渐减慢速度
            // 简化处理：直接乘以摩擦系数
            // 实际应该用摩擦力公式
        }
    }
    /**
     * 更新物理状态
     */
    update(deltaTime) {
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
    static checkCollision(obj1, obj2, radius1, radius2) {
        const pos1 = obj1.getState().position;
        const pos2 = obj2.getState().position;
        const distance = pos1.distanceTo(pos2);
        const minDistance = (radius1 + radius2) * exports.TILE_SIZE;
        return distance < minDistance;
    }
    /**
     * 地面碰撞检测
     */
    checkGround(groundLevel) {
        const posY = this.state.position.y;
        return posY >= groundLevel;
    }
    /**
     * 着地
     */
    land(groundY) {
        this.state.position.y = groundY;
        this.state.velocity.y = 0;
        this.state.onGround = true;
        this.state.isJumping = false;
    }
}
exports.PhysicsSystem = PhysicsSystem;
// ==================== 导出 ====================
exports.default = PhysicsSystem;
