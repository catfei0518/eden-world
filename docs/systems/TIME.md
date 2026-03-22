# 时间系统

## 概述

时间系统是游戏的核心驱动，控制着所有游戏逻辑的执行节奏。

## 核心定义

### Tick基础
```
1 现实秒 = 1 游戏分钟
1 游戏分钟 = 1 Tick
```

### 时间档位

| 档位 | 比例 | 1现实秒= | 用途 |
|:----:|:----:|:--------:|:----:|
| 1 | 1:60 | 1游戏分钟 | 慢速观察 |
| 2 | 1:600 | 10游戏分钟 | 日常 |
| 3 | 1:3600 | 1游戏小时 | 快速 |
| 4 | 1:86400 | 1游戏天 | 超快 |
| 5 | 暂停 | - | 观察 |

### 游戏时间换算

```
1 游戏小时 = 60 游戏分钟 = 60 现实秒
1 游戏天 = 24 游戏小时 = 1440 游戏分钟 = 1440 现实秒 = 24 现实分钟
1 游戏年 = 12 游戏天 = 17280 现实秒 = 4.8 现实小时
```

## 季节系统

```
1 游戏年 = 4 季节（春/夏/秋/冬）
每季节 = 3 游戏天
```

## 数据结构

```typescript
interface TimeState {
  tick: number;           // 当前Tick
  gameMinute: number;     // 游戏分钟
  gameHour: number;      // 游戏小时
  gameDay: number;       // 游戏天
  gameYear: number;      // 游戏年
  season: Season;        // 当前季节
  timeSpeed: number;     // 时间档位倍率
  isPaused: boolean;     // 是否暂停
}

enum Season {
  SPRING,
  SUMMER,
  AUTUMN,
  WINTER
}
```

## 接口

```typescript
class TimeSystem {
  // 获取当前时间状态
  getState(): TimeState;
  
  // 设置时间档位
  setSpeed(tier: 1|2|3|4|5): void;
  
  // 暂停/继续
  pause(): void;
  resume(): void;
  
  // 时间前进（每Tick调用）
  tick(): void;
  
  // 获取游戏内时间描述
  getTimeDescription(): string;
}
```

## 实现要点

1. **固定Tick**：不管档位，底层Tick始终1秒=1游戏分钟
2. **档位影响**：档位只影响"游戏时间"流逝速度
3. **暂停**：暂停时tick不增加
