/**
 * 时间系统测试
 */

import { TimeSystem, Season } from '../src/core/TimeSystem';

console.log('=== 时间系统测试 ===\n');

// 创建时间系统
const time = new TimeSystem();

// 测试1：初始状态
console.log('测试1：初始状态');
console.log('时间描述:', time.getTimeDescription());
console.log('');

// 测试2：Tick前进
console.log('测试2：Tick前进(模拟60秒)');
for (let i = 0; i < 60; i++) {
  time.tick();
}
console.log('60Tick后:', time.getTimeDescription());
console.log('');

// 测试3：档位切换
console.log('测试3：档位切换');
time.setSpeed(2); // 1:10
console.log('切换到档位2:', time.getCurrentTier(), '1现实秒=10游戏分钟');
for (let i = 0; i < 6; i++) {
  time.tick();
}
console.log('6Tick后(档位2):', time.getTimeDescription());
console.log('');

// 测试4：暂停
console.log('测试4：暂停');
time.setSpeed(5);
console.log('暂停状态:', time.getState().isPaused);
for (let i = 0; i < 10; i++) {
  time.tick();
}
console.log('暂停10Tick后:', time.getTimeDescription());
console.log('');

// 测试5：加速到超快
console.log('测试5：档位4(超快)');
time.setSpeed(4); // 1:1440, 1现实秒=1游戏天
console.log('切换到档位4:', time.getCurrentTier(), '1现实秒=1游戏天');
time.tick();
console.log('1Tick后:', time.getTimeDescription());
console.log('');

console.log('=== 测试完成 ===');
