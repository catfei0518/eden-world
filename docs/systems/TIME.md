# 时间系统

> 版本：v0.15.3
> 更新：2026-04-01

## 概述

时间系统是游戏的核心驱动，控制着所有游戏逻辑的执行节奏。

## 核心定义

### Tick基础
```
1 现实秒 = 1 游戏分钟 (宪法规定)
1 游戏分钟 = 1 Tick
```

### 时间档位 (宪法规定)

| 档位 | 比例 | 1现实秒= | 用途 |
|:----:|:----:|:--------:|:----:|
| 1 | 1:60 | 60游戏分钟 | 慢速观察 |
| 2 | 1:600 | 600游戏分钟 | 日常 |
| 3 | 1:3600 | 3600游戏分钟 | 快速 |
| 4 | 1:86400 | 86400游戏分钟 | 超快 |
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

### 季节效果

| 季节 | 植物生长 | 精力消耗 | 活动水平 | 特殊效果 |
|:----:|:--------:|:--------:|:--------:|:---------:|
| 春 🌸 | 1.2x | 0.8x | 1.0 | - |
| 夏 ☀️ | 1.5x | 1.3x | 0.9 | 口渴需求+50% |
| 秋 🍂 | 1.0x | 1.0x | 1.0 | 丰收 |
| 冬 ❄️ | 0.1x | 1.5x | 0.7 | - |

## 昼夜系统 (宪法规定)

```
白天: 12小时 (6:00-17:59) 光线×1.0
黄昏: 2小时 (18:00-19:59) 光线×0.5
夜晚: 8小时 (20:00-3:59) 光线×0.2
黎明: 2小时 (4:00-5:59) 光线×0.4
```

### 昼夜时段

| 时段 | 时长 | 光线系数 | 说明 |
|:----:|:----:|:--------:|:-----:|
| 白天 ☀️ | 12小时 | ×1.0 | 正常视野 |
| 黄昏 🌅 | 2小时 | ×0.5 | 视野降低 |
| 夜晚 🌙 | 8小时 | ×0.2 | 视野大幅降低 |
| 黎明 🌄 | 2小时 | ×0.4 | 视野逐渐恢复 |

## 数据结构

### 前端 (src/core/TimeSystem.ts)

```typescript
// 季节枚举
enum Season {
  SPRING = 0,  // 春
  SUMMER = 1,  // 夏
  AUTUMN = 2,  // 秋
  WINTER = 3   // 冬
}

// 昼夜时段枚举
enum DayPhase {
  DAY = 'day',       // 白天
  SUNSET = 'sunset', // 黄昏
  NIGHT = 'night',   // 夜晚
  DAWN = 'dawn'      // 黎明
}

// 时间状态接口
interface TimeState {
  tick: number;           // 当前Tick
  gameMinute: number;     // 游戏分钟(0-59)
  gameHour: number;       // 游戏小时(0-23)
  gameDay: number;        // 游戏天(0-11)
  gameYear: number;       // 游戏年
  season: Season;         // 当前季节
  timeSpeed: number;      // 时间档位倍率
  isPaused: boolean;      // 是否暂停
  realSeconds: number;    // 现实秒数
  dayPhase: DayPhase;     // 当前昼夜时段
}

// 时间档位 (宪法规定)
const SPEED_TIERS = {
  1: 60,      // 1:60 (1现实秒=60游戏分钟)
  2: 600,     // 1:600 (1现实秒=600游戏分钟)
  3: 3600,    // 1:3600 (1现实秒=3600游戏分钟)
  4: 86400,   // 1:86400 (1现实秒=1游戏天)
  5: 0        // 暂停
};
```

### 服务器 (server/TimeManager.ts)

```typescript
// 季节定义
interface SeasonInfo {
    name: string;
    color: string;
    emoji: string;
    effects: {
        plantGrowth: number;   // 植物生长倍率
        energyDrain: number;   // 精力消耗倍率
        waterNeed?: number;     // 口渴需求倍率
        harvest?: boolean;     // 是否丰收
        activityLevel: number; // 活动水平
    };
}

// 昼夜时段定义
interface DayPeriodInfo {
    name: string;           // 时段名称
    emoji: string;         // 表情符号
    range: [number, number]; // 小时范围
    lightCoefficient: number; // 光线系数
}
```

## 接口

### 前端 (TimeSystem类)

```typescript
class TimeSystem {
  // 状态管理
  getState(): TimeState;              // 获取当前状态
  setSpeed(tier: 1|2|3|4|5): void;  // 设置时间档位

  // 暂停/继续
  pause(): void;
  resume(): void;

  // 时间前进
  tick(): void;  // 每1现实秒调用一次

  // 季节信息
  getSeasonName(): string;  // 获取季节名称

  // 昼夜信息
  getDayPhase(): DayPhase;           // 获取当前昼夜时段
  getLightCoefficient(): number;      // 获取光线系数
  getDayPhaseName(): string;         // 获取昼夜时段名称

  // 时间描述
  getTimeDescription(): string;  // 获取游戏内时间描述
  getCurrentTier(): number;      // 获取当前档位
}
```

### 服务器 (TimeManager类)

```typescript
class TimeManager {
  // 时间控制
  advance(deltaMs: number): void;  // 前进游戏时间
  setTimeSpeed(speed: number): void;  // 设置时间档位
  getTimeSpeed(): number;

  // 时间信息
  getGameHour(): number;   // 获取当前游戏小时(0-23)
  getGameMinute(): number; // 获取当前游戏分钟(0-59)
  getTimeString(): string; // 获取时间字符串(HH:MM)

  // 昼夜信息
  getDayPeriod(): string;         // 获取当前昼夜时段
  getLightCoefficient(): number;  // 获取光线系数

  // 季节信息
  getSeason(): Season;             // 获取当前季节
  getSeasonName(season?: string): string;  // 获取季节名称
  getSeasonInfo(): SeasonInfo;    // 获取季节详细信息
  setSeason(season: Season): void;  // 设置季节

  // 视野计算
  calculateVision(baseVision: number, terrain?: string): number;

  // 事件系统
  on(event: string, callback: TimeEventCallback): void;

  // 存档
  toJSON(): any;
  fromJSON(data: any): void;
}
```

## 实现要点

1. **固定Tick**: 底层Tick始终1秒=1游戏分钟
2. **档位影响**: 档位只影响游戏时间流逝速度
3. **暂停**: 暂停时tick不增加
4. **昼夜跨越**: 夜晚时段跨越午夜(20:00-3:59)
5. **季节循环**: 春→夏→秋→冬→春自动循环
6. **视野计算**: AI视野 = 基础视野 × 光线系数 × 地形系数

## 事件系统

### 前端事件

| 事件 | 触发条件 | 说明 |
|------|----------|------|
| time_update | 每现实秒 | 时间更新 |
| season_changed | 季节变化 | 季节切换 |

### 服务器事件

| 事件 | 触发条件 | 数据 |
|------|----------|------|
| onTimeUpdate | 每帧 | 时间更新 |
| onHourChange | 小时变化 | { hour, period } |
| onDayChange | 天变化 | { day, season } |
| onSeasonChange | 季节变化 | { season, seasonInfo } |

## 版本历史

| 版本 | 日期 | 修改内容 |
|:----:|:----:|:---------|
| v1.1 | 2026-03-30 | 修复时间档位比例和昼夜时段，符合宪法规定 |
| v1.0 | 2026-03-22 | 初始版本 |
