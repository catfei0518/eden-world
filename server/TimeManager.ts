/**
 * 伊甸世界 - 时间管理系统 v1.0
 * 
 * 宪法规定:
 * - 1 现实秒 = 1 游戏分钟（Tick基础）
 * - 1 游戏天 = 1440 游戏分钟 = 24 现实分钟
 * - 1 游戏年 = 4 季节，每季节 3 游戏天
 * - 季节: 春 → 夏 → 秋 → 冬 → 春
 */

// 季节定义
export interface SeasonInfo {
    name: string;
    color: string;
    emoji: string;
    effects: {
        plantGrowth: number;
        energyDrain: number;
        waterNeed?: number;
        harvest?: boolean;
        activityLevel: number;
    };
}

export const SEASONS: Record<string, SeasonInfo> = {
    spring: {
        name: '春',
        color: '#90EE90',
        emoji: '🌸',
        effects: {
            plantGrowth: 1.2,
            energyDrain: 0.8,
            activityLevel: 1.0
        }
    },
    summer: {
        name: '夏',
        color: '#FFD700',
        emoji: '☀️',
        effects: {
            plantGrowth: 1.5,
            energyDrain: 1.3,
            waterNeed: 1.5,
            activityLevel: 0.9
        }
    },
    autumn: {
        name: '秋',
        color: '#FF8C00',
        emoji: '🍂',
        effects: {
            plantGrowth: 1.0,
            energyDrain: 1.0,
            harvest: true,
            activityLevel: 1.0
        }
    },
    winter: {
        name: '冬',
        color: '#E0FFFF',
        emoji: '❄️',
        effects: {
            plantGrowth: 0.1,
            energyDrain: 1.5,
            activityLevel: 0.7
        }
    }
};

// 昼夜时段定义 (宪法规定)
// 白天12小时、黄昏2小时、夜晚8小时、黎明2小时
export interface DayPeriodInfo {
    name: string;
    emoji: string;
    range: [number, number];
    lightCoefficient: number;
}

export const DAY_PERIODS: Record<string, DayPeriodInfo> = {
    day: {
        name: '白天',
        emoji: '☀️',
        range: [6, 17],      // 白天 6:00-17:59 (12小时)
        lightCoefficient: 1.0
    },
    dusk: {
        name: '黄昏',
        emoji: '🌅',
        range: [18, 19],     // 黄昏 18:00-19:59 (2小时)
        lightCoefficient: 0.5
    },
    night: {
        name: '夜晚',
        emoji: '🌙',
        range: [20, 3],      // 夜晚 20:00-3:59 (8小时，跨越午夜)
        lightCoefficient: 0.2
    },
    dawn: {
        name: '黎明',
        emoji: '🌄',
        range: [4, 5],       // 黎明 4:00-5:59 (2小时)
        lightCoefficient: 0.4
    }
};

// 宪法规定的时间常量
const GAME_MINUTES_PER_REAL_SECOND = 1;  // 1现实秒 = 1游戏分钟
const GAME_MINUTES_PER_HOUR = 60;         // 1游戏小时 = 60游戏分钟
const GAME_HOURS_PER_DAY = 24;            // 1游戏天 = 24游戏小时
const GAME_MINUTES_PER_DAY = GAME_MINUTES_PER_HOUR * GAME_HOURS_PER_DAY; // 1440
const GAME_DAYS_PER_SEASON = 3;           // 每季节3游戏天
const GAME_DAYS_PER_YEAR = GAME_DAYS_PER_SEASON * 4; // 12游戏天

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// 事件回调类型
type TimeEventCallback = (data: any) => void;

export class TimeManager {
    // 游戏时间（从世界创建开始计算）
    private gameMinutes: number = 420;  // 从早上7点开始 (7 * 60)
    private gameDays: number = 1;       // 第1天
    private gameYears: number = 1;     // 第1年
    private season: Season = 'spring';  // 春季
    
    // 时间档位 (宪法规定: 60=正常, 600=10倍, 3600=60倍, 86400=1440倍, 0=暂停)
    private timeSpeed: number = 60;
    
    // 上一帧的时间（用于计算delta）
    private lastRealTime: number = Date.now();
    
    // 上一帧的游戏时间（用于检测变化）
    private lastGameHour: number = 7;
    private lastGameDay: number = 1;
    private lastSeason: Season = 'spring';
    
    // 事件回调
    private callbacks: {
        onTimeUpdate: TimeEventCallback[];
        onSeasonChange: TimeEventCallback[];
        onDayChange: TimeEventCallback[];
        onHourChange: TimeEventCallback[];
    } = {
        onTimeUpdate: [],
        onSeasonChange: [],
        onDayChange: [],
        onHourChange: []
    };
    
    constructor() {
        this.lastRealTime = Date.now();
    }
    
    /**
     * 前进游戏时间
     * @param deltaMs - 真实流逝的毫秒数
     */
    advance(deltaMs: number): void {
        if (this.timeSpeed === 0) {
            this.lastRealTime = Date.now();
            return; // 暂停状态
        }
        
        // 计算真实秒数
        const realSeconds = deltaMs / 1000;
        
        // 计算游戏分钟增量 (1现实秒 = 1游戏分钟 * 时间档位)
        const gameMinutes增量 = realSeconds * GAME_MINUTES_PER_REAL_SECOND * this.timeSpeed;
        
        // 更新游戏时间
        this.gameMinutes += gameMinutes增量;
        
        // 溢出处理：计算新的天和年
        this.handleOverflow();
        
        // 检查事件
        this.checkEvents();
        
        this.lastRealTime = Date.now();
    }
    
    /**
     * 处理时间溢出，计算天数和季节
     */
    private handleOverflow(): void {
        // 计算总游戏天数
        const totalGameDays = Math.floor(this.gameMinutes / GAME_MINUTES_PER_DAY);
        
        if (totalGameDays >= this.gameDays) {
            this.gameDays = totalGameDays + 1; // 从1开始
        }
        
        // 计算游戏年
        const totalGameYears = Math.floor((this.gameDays - 1) / GAME_DAYS_PER_YEAR);
        this.gameYears = totalGameYears + 1;
        
        // 计算当前季节 (每3天一个季节)
        const dayInYear = (this.gameDays - 1) % GAME_DAYS_PER_YEAR;
        const seasonIndex = Math.floor(dayInYear / GAME_DAYS_PER_SEASON);
        const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
        this.season = seasons[seasonIndex];
    }
    
    /**
     * 检查并触发时间事件
     */
    private checkEvents(): void {
        const currentGameHour = this.getGameHour();
        const currentSeason = this.season;
        const currentDay = this.gameDays;
        
        // 小时变化
        if (currentGameHour !== this.lastGameHour) {
            this.emit('onHourChange', { hour: currentGameHour, period: this.getDayPeriod() });
            this.lastGameHour = currentGameHour;
        }
        
        // 天变化
        if (currentDay !== this.lastGameDay) {
            this.emit('onDayChange', { day: currentDay, season: currentSeason });
            this.lastGameDay = currentDay;
        }
        
        // 季节变化
        if (currentSeason !== this.lastSeason) {
            console.log(`🍃 季节变化: ${this.getSeasonName(this.lastSeason)} → ${this.getSeasonName(currentSeason)}`);
            this.emit('onSeasonChange', { 
                season: currentSeason, 
                seasonInfo: this.getSeasonInfo() 
            });
            this.lastSeason = currentSeason;
        }
    }
    
    /**
     * 获取当前游戏小时 (0-23)
     */
    getGameHour(): number {
        return Math.floor((this.gameMinutes % GAME_MINUTES_PER_DAY) / GAME_MINUTES_PER_HOUR);
    }
    
    /**
     * 获取当前游戏分钟 (0-59)
     */
    getGameMinute(): number {
        return Math.floor(this.gameMinutes % GAME_MINUTES_PER_HOUR);
    }
    
    /**
     * 获取当前昼夜时段
     * 特殊处理跨越午夜的夜晚时段
     */
    getDayPeriod(): string {
        const hour = this.getGameHour();

        // 夜晚跨越午夜 (20:00-3:59)
        if (hour >= 20 || hour < 4) {
            return 'night';
        }
        // 黎明 (4:00-5:59)
        if (hour >= 4 && hour < 6) {
            return 'dawn';
        }
        // 白天 (6:00-17:59)
        if (hour >= 6 && hour < 18) {
            return 'day';
        }
        // 黄昏 (18:00-19:59)
        return 'dusk';
    }
    
    /**
     * 获取当前光线系数
     */
    getLightCoefficient(): number {
        const period = this.getDayPeriod();
        return DAY_PERIODS[period]?.lightCoefficient || 1.0;
    }
    
    /**
     * 获取季节信息
     */
    getSeasonInfo(): SeasonInfo {
        return SEASONS[this.season];
    }
    
    /**
     * 获取季节名称
     */
    getSeasonName(season?: string): string {
        if (!season) season = this.season;
        return SEASONS[season]?.name || season;
    }
    
    /**
     * 获取当前季节
     */
    getSeason(): Season {
        return this.season;
    }
    
    /**
     * 设置季节（手动切换）
     */
    setSeason(season: Season): void {
        this.season = season;
        this.lastSeason = season;
    }
    
    /**
     * 设置时间档位
     * 宪法规定: 60=正常, 600=10倍, 3600=60倍, 86400=1440倍, 0=暂停
     * @param speed - 时间倍率
     */
    setTimeSpeed(speed: number): void {
        const oldSpeed = this.timeSpeed;
        this.timeSpeed = speed;

        if (speed === 0) {
            console.log('⏸️ 时间已暂停');
        } else if (speed === 60) {
            console.log('▶️ 时间恢复正常 (60x)');
        } else {
            console.log(`⏩ 时间加速 (${speed}x)`);
        }

        this.lastRealTime = Date.now();
    }
    
    /**
     * 获取时间档位
     */
    getTimeSpeed(): number {
        return this.timeSpeed;
    }
    
    /**
     * 获取当前游戏时间格式化字符串
     */
    getTimeString(): string {
        const hour = this.getGameHour().toString().padStart(2, '0');
        const minute = this.getGameMinute().toString().padStart(2, '0');
        return `${hour}:${minute}`;
    }
    
    /**
     * 获取完整时间描述
     */
    getFullTimeInfo(): {
        season: Season;
        seasonName: string;
        seasonEmoji: string;
        year: number;
        day: number;
        hour: number;
        minute: number;
        timeString: string;
        period: string;
        periodName: string;
        periodEmoji: string;
        lightCoefficient: number;
        timeSpeed: number;
        gameMinutesPerRealSecond: number;
    } {
        const seasonInfo = this.getSeasonInfo();
        const period = this.getDayPeriod();
        const periodInfo = DAY_PERIODS[period];
        
        return {
            season: this.season,
            seasonName: seasonInfo.name,
            seasonEmoji: seasonInfo.emoji,
            year: this.gameYears,
            day: this.gameDays,
            hour: this.getGameHour(),
            minute: this.getGameMinute(),
            timeString: this.getTimeString(),
            period: period,
            periodName: periodInfo.name,
            periodEmoji: periodInfo.emoji,
            lightCoefficient: this.getLightCoefficient(),
            timeSpeed: this.timeSpeed,
            gameMinutesPerRealSecond: GAME_MINUTES_PER_REAL_SECOND * this.timeSpeed
        };
    }
    
    /**
     * 注册事件回调
     */
    on(event: string, callback: TimeEventCallback): void {
        if (this.callbacks[event as keyof typeof this.callbacks]) {
            this.callbacks[event as keyof typeof this.callbacks].push(callback);
        }
    }
    
    /**
     * 触发事件
     */
    private emit(event: string, data: any): void {
        const callbacks = this.callbacks[event as keyof typeof this.callbacks];
        if (callbacks) {
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`TimeManager事件错误 (${event}):`, e);
                }
            }
        }
    }
    
    /**
     * 获取视野系数（用于AI感知）
     * @param baseVision - 基础视野
     * @param terrain - 地形类型
     */
    calculateVision(baseVision: number, terrain: string = 'plain'): number {
        const lightCoeff = this.getLightCoefficient();
        
        // 地形视野系数
        const terrainCoeff: Record<string, number> = {
            plain: 1.0,
            forest: 0.3,
            mountain: 0.8,
            desert: 0.9,
            river: 0.8,
            lake: 0.8,
            ocean: 0.5,
            cave: 0.1
        };
        
        return Math.floor(baseVision * lightCoeff * (terrainCoeff[terrain] || 1.0));
    }
    
    /**
     * 获取存档数据
     */
    toJSON(): any {
        return {
            gameMinutes: this.gameMinutes,
            gameDays: this.gameDays,
            gameYears: this.gameYears,
            season: this.season,
            timeSpeed: this.timeSpeed
        };
    }
    
    /**
     * 加载存档数据
     */
    fromJSON(data: any): void {
        if (data.gameMinutes !== undefined) this.gameMinutes = data.gameMinutes;
        if (data.gameDays !== undefined) this.gameDays = data.gameDays;
        if (data.gameYears !== undefined) this.gameYears = data.gameYears;
        if (data.season !== undefined) this.season = data.season;
        if (data.timeSpeed !== undefined) this.timeSpeed = data.timeSpeed;
        this.lastRealTime = Date.now();
        
        // 同步last值
        this.lastGameHour = this.getGameHour();
        this.lastGameDay = this.gameDays;
        this.lastSeason = this.season;
    }
}

// 导出常量
export const TIME_CONSTANTS = {
    GAME_MINUTES_PER_REAL_SECOND,
    GAME_MINUTES_PER_HOUR,
    GAME_HOURS_PER_DAY,
    GAME_MINUTES_PER_DAY,
    GAME_DAYS_PER_SEASON,
    GAME_DAYS_PER_YEAR
};
