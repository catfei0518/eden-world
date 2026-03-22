# 测试示例

## 基础测试

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('TimeSystem', () => {
  let time: TimeSystem;

  beforeEach(() => {
    time = new TimeSystem();
  });

  describe('初始化', () => {
    it('初始tick为0', () => {
      expect(time.getState().tick).toBe(0);
    });
  });
});
```

## 边界条件测试

```typescript
it('小时到达24应该进位到下一天', () => {
  const state = time.getState();
  state.gameHour = 23;
  // 触发时间前进
  expect(state.gameDay).toBe(0);
});
```

## 异常测试

```typescript
it('设置无效档位应该抛出错误', () => {
  expect(() => {
    time.setSpeed(6 as any);
  }).toThrow();
});
```
