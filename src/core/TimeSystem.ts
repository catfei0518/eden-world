/**
 * 时间系统
 * 控制游戏时间流逝和档位切换
 */

// 季节枚举
export enum Season {
  SPRING = 0,
  SUMMER = 1,
  AUTUMN = 2,
  WINTER = 3
}

// 季节名称
const SEASON_NAMES = ['春', '夏', '秋', '冬'];

// 时间档位倍率 (1现实秒 = GAME_MINUTES 游戏分钟)
// 宪法规定: 1:60 / 1:600 / 1:3600 / 1:86400 / 暂停
const SPEED_TIERS: { [key: number]: number } = {
  1: 60,     // 1:60 (1现实秒=60游戏分钟)
  2: 600,    // 1:600 (1现实秒=600游戏分钟)
  3: 3600,   // 1:3600 (1现实秒=3600游戏分钟)
  4: 86400,  // 1:86400 (1现实秒=1游戏天)
  5: 0       // 暂停
};

// 游戏时间常量
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 12;
const DAYS_PER_SEASON = 3; // 12天/4季节

// 昼夜时段类型
export enum DayPhase {
  DAY = 'day',       // 白天
  SUNSET = 'sunset', // 黄昏
  NIGHT = 'night',   // 夜晚
  DAWN = 'dawn'      // 黎明
}

// 昼夜时段常量 (从6:00开始计算)
const DAY_PHASE_CONFIG = {
  [DayPhase.DAY]: { start: 6, end: 17 },      // 白天 6:00-17:59 (12小时)
  [DayPhase.SUNSET]: { start: 18, end: 19 },  // 黄昏 18:00-19:59 (2小时)
  [DayPhase.NIGHT]: { start: 20, end: 3 },    // 夜晚 20:00-3:59 (8小时)
  [DayPhase.DAWN]: { start: 4, end: 5 }       // 黎明 4:00-5:59 (2小时)
};

// 光线系数 (宪法规定)
const LIGHT_COEFFICIENTS: { [key in DayPhase]: number } = {
  [DayPhase.DAY]: 1.0,    // 白天光线
  [DayPhase.SUNSET]: 0.5, // 黄昏光线
  [DayPhase.NIGHT]: 0.2,  // 夜晚光线
  [DayPhase.DAWN]: 0.4    // 黎明光线
};

// 昼夜时段名称
const DAY_PHASE_NAMES: { [key in DayPhase]: string } = {
  [DayPhase.DAY]: '白天',
  [DayPhase.SUNSET]: '黄昏',
  [DayPhase.NIGHT]: '夜晚',
  [DayPhase.DAWN]: '黎明'
};

// 时间状态接口
export interface TimeState {
  tick: number;           // 当前Tick
  gameMinute: number;     // 游戏分钟(0-59)
  gameHour: number;       // 游戏小时(0-23)
  gameDay: number;        // 游戏天(0-11)
  gameYear: number;       // 游戏年
  season: Season;         // 当前季节
  timeSpeed: number;      // 时间档位倍率
  isPaused: boolean;      // 是否暂停
  realSeconds: number;    // 现实秒数
  dayPhase: DayPhase;    // 当前昼夜时段
}

/**
 * 时间系统类
 */
export class TimeSystem {
  private state: TimeState;

  constructor() {
    this.state = this.createInitialState();
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): TimeState {
    return {
      tick: 0,
      gameMinute: 0,
      gameHour: 6, // 从早上6点开始
      gameDay: 0,
      gameYear: 1,
      season: Season.SPRING,
      timeSpeed: 1,
      isPaused: false,
      realSeconds: 0,
      dayPhase: DayPhase.DAY
    };
  }

  /**
   * 获取当前状态
   */
  getState(): TimeState {
    return { ...this.state };
  }

  /**
   * 设置时间档位
   * @param tier 档位(1-5)
   */
  setSpeed(tier: 1 | 2 | 3 | 4 | 5): void {
    if (tier < 1 || tier > 5) {
      throw new Error('档位必须在1-5之间');
    }
    this.state.timeSpeed = SPEED_TIERS[tier];
    this.state.isPaused = (tier === 5);
  }

  /**
   * 暂停
   */
  pause(): void {
    this.state.isPaused = true;
  }

  /**
   * 继续
   */
  resume(): void {
    if (this.state.isPaused) {
      this.state.isPaused = false;
    }
  }

  /**
   * 时间前进(Tick)
   * 每1现实秒调用一次
   */
  tick(): void {
    if (this.state.isPaused) {
      return;
    }

    this.state.realSeconds++;
    this.state.tick++;

    // 游戏分钟增加
    this.state.gameMinute += this.state.timeSpeed;

    // 溢出处理
    while (this.state.gameMinute >= MINUTES_PER_HOUR) {
      this.state.gameMinute -= MINUTES_PER_HOUR;
      this.state.gameHour++;
    }

    // 小时溢出
    while (this.state.gameHour >= HOURS_PER_DAY) {
      this.state.gameHour -= HOURS_PER_DAY;
      this.state.gameDay++;
    }

    // 天溢出
    while (this.state.gameDay >= DAYS_PER_YEAR) {
      this.state.gameDay -= DAYS_PER_YEAR;
      this.state.gameYear++;
    }

    // 季节计算
    this.state.season = Math.floor(this.state.gameDay / DAYS_PER_SEASON) as Season;

    // 更新昼夜时段
    this.state.dayPhase = this.calculateDayPhase();
  }

  /**
   * 计算当前昼夜时段
   */
  private calculateDayPhase(): DayPhase {
    const hour = this.state.gameHour;

    // 夜晚跨越午夜 (20:00-3:59)
    if (hour >= 20 || hour < 4) {
      return DayPhase.NIGHT;
    }
    // 黎明 (4:00-5:59)
    if (hour >= 4 && hour < 6) {
      return DayPhase.DAWN;
    }
    // 白天 (6:00-17:59)
    if (hour >= 6 && hour < 18) {
      return DayPhase.DAY;
    }
    // 黄昏 (18:00-19:59)
    return DayPhase.SUNSET;
  }

  /**
   * 获取季节名称
   */
  getSeasonName(): string {
    return SEASON_NAMES[this.state.season];
  }

  /**
   * 获取游戏内时间描述
   */
  getTimeDescription(): string {
    const hour = String(this.state.gameHour).padStart(2, '0');
    const minute = String(this.state.gameMinute).padStart(2, '0');
    const day = this.state.gameDay + 1;
    const season = this.getSeasonName();
    const year = this.state.gameYear;
    const dayPhase = this.getDayPhaseName();

    return `${year}年第${day}天 ${season}季 ${dayPhase} ${hour}:${minute}`;
  }

  /**
   * 获取当前档位
   */
  getCurrentTier(): number {
    if (this.state.isPaused) return 5;
    const speed = this.state.timeSpeed;
    for (const [tier, value] of Object.entries(SPEED_TIERS)) {
      if (value === speed) return parseInt(tier);
    }
    return 1;
  }

  /**
   * 获取当前昼夜时段
   */
  getDayPhase(): DayPhase {
    return this.state.dayPhase;
  }

  /**
   * 获取当前光线系数
   */
  getLightCoefficient(): number {
    return LIGHT_COEFFICIENTS[this.state.dayPhase];
  }

  /**
   * 获取昼夜时段名称
   */
  getDayPhaseName(): string {
    return DAY_PHASE_NAMES[this.state.dayPhase];
  }
}

// 导出常量供其他模块使用
export const TIME_CONSTANTS = {
  MINUTES_PER_HOUR,
  HOURS_PER_DAY,
  DAYS_PER_YEAR,
  DAYS_PER_SEASON,
  SPEED_TIERS,
  DAY_PHASE_CONFIG,
  LIGHT_COEFFICIENTS
};
