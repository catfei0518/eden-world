/**
 * 物理系统测试
 */

import { 
  PhysicsSystem, 
  Vector2D, 
  TILE_SIZE, 
  MOVE_SPEED,
  GRAVITY,
  JUMP,
  TERRAIN_SPEED
} from '../src/core/PhysicsSystem';

console.log('=== 物理系统测试 ===\n');

// 测试1：向量运算
console.log('测试1：向量运算');
const v1 = new Vector2D(3, 4);
const v2 = new Vector2D(1, 2);
console.log('v1:', v1.toString());
console.log('v2:', v2.toString());
console.log('v1 + v2:', v1.add(v2).toString());
console.log('v1距离:', v1.magnitude());
console.log('');

// 测试2：物理系统初始化
console.log('测试2：物理系统初始化');
const physics = new PhysicsSystem(100, 100);
const state = physics.getState();
console.log('初始位置:', physics.getState().position.toString());
console.log('网格位置:', physics.getGridPosition().toString());
console.log('');

// 测试3：移动
console.log('测试3：移动');
physics.move(new Vector2D(1, 0), MOVE_SPEED.WALK, 'PLAIN', 1/60);
console.log('移动后位置:', physics.getState().position.toString());
console.log('');

// 测试4：跳跃
console.log('测试4：跳跃');
const jumpResult = physics.jump();
console.log('跳跃结果:', jumpResult ? '成功' : '失败');
console.log('跳跃中:', physics.getState().isJumping);
console.log('');

// 测试5：重力
console.log('测试5：重力应用');
const physics2 = new PhysicsSystem(0, 0);
physics2.jump();
// 模拟几帧
for (let i = 0; i < 10; i++) {
  physics2.applyGravity(1/60);
  physics2.update(1/60);
  console.log(`帧${i+1}: y=${physics2.getState().position.y.toFixed(2)}, vy=${physics2.getState().velocity.y.toFixed(2)}`);
}
console.log('');

// 测试6：地形速度影响
console.log('测试6：地形速度影响');
const terrainSpeedTest = (terrain: string) => {
  const physics3 = new PhysicsSystem(0, 0);
  const baseSpeed = MOVE_SPEED.WALK * TILE_SIZE;
  const terrainSpeed = TERRAIN_SPEED[terrain] || 1.0;
  physics3.move(new Vector2D(1, 0), MOVE_SPEED.WALK, terrain, 1);
  console.log(`${terrain}: 速度=${(physics3.getState().velocity.x / TILE_SIZE).toFixed(2)}格/秒 (系数=${terrainSpeed})`);
};
terrainSpeedTest('PLAIN');
terrainSpeedTest('SAND');
terrainSpeedTest('SWAMP');
console.log('');

// 测试7：碰撞检测
console.log('测试7：碰撞检测');
const obj1 = new PhysicsSystem(0, 0);
const obj2 = new PhysicsSystem(TILE_SIZE, 0); // 相距1格
const collision = PhysicsSystem.checkCollision(obj1, obj2, 0.5, 0.5);
console.log('碰撞(相距1格):', collision ? '是' : '否');

const obj3 = new PhysicsSystem(TILE_SIZE * 2, 0); // 相距2格
const collision2 = PhysicsSystem.checkCollision(obj1, obj3, 0.5, 0.5);
console.log('碰撞(相距2格):', collision2 ? '是' : '否');
console.log('');

console.log('=== 测试完成 ===');
