# 测试指南

## 概述

本项目使用Vitest作为测试框架，采用标准覆盖率（60-80%）。

## 测试结构

```
/eden-world
  /tests              # 测试文件（统一放这里）
    /core/
      TimeSystem.test.ts
    /systems/
    /ai/
```

## 命名规范

```
测试文件：*.test.ts
测试函数：test('描述', () => { ... })
```

## 测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { TimeSystem } from '../../src/core/TimeSystem';

describe('时间系统', () => {
  it('应该正确初始化', () => {
    const time = new TimeSystem();
    expect(time.getState().tick).toBe(0);
  });

  it('应该正确前进Tick', () => {
    const time = new TimeSystem();
    time.tick();
    expect(time.getState().tick).toBe(1);
  });
});
```

## 测试时机

- 提交前：本地运行所有测试
- CI/CD：每次push自动运行
