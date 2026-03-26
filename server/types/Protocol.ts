/**
 * 伊甸世界 - 消息协议类型定义
 */

// ============ 服务器 → 客户端 ============

export interface InitMessage {
    type: 'init';
    data: {
        tiles: TileData[];
        characters: CharacterSnapshot[];
        items: GroundItemData[];
        seed: number;
        season: Season;
        width: number;
        height: number;
    };
}

export interface StateMessage {
    type: 'state';
    data: {
        characters: CharacterSnapshot[];
        tick: number;
    };
}

export interface InputAckMessage {
    type: 'input_ack';
    seq: number;
    accepted: boolean;
    position?: { x: number; y: number };
}

export interface CharacterSelectedMessage {
    type: 'character_selected';
    characterId: string;
    data: CharacterFullData;
}

export interface SeasonChangedMessage {
    type: 'season_changed';
    season: Season;
}

// ============ 客户端 → 服务器 ============

export interface InputMessage {
    type: 'input';
    characterId: string;
    seq: number;
    input: PlayerInput;
}

export interface SelectCharacterMessage {
    type: 'select_character';
    characterId: string;
}

export interface ChangeSeasonMessage {
    type: 'season';
    season: Season;
}

export interface CommandMessage {
    type: 'command';
    command: string;
    args: any;
}

export interface AuthMessage {
    type: 'auth';
    token: string;
}

// ============ 共享类型 ============

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type CharacterType = 'adam' | 'eve';

export interface TileData {
    x: number;
    y: number;
    type: TerrainType;
}

export type TerrainType = 
    | 'grass' | 'plains' | 'forest' | 'desert'
    | 'mountain' | 'hill' | 'ocean' | 'beach'
    | 'river' | 'lake' | 'swamp';

export interface GroundItemData {
    id: string;
    type: ItemType;
    x: number;
    y: number;
    terrain: TerrainType;
}

export type ItemType = 'tree' | 'rock' | 'bush' | 'berry' | 'bush_flower' | 'well' | 'shell' | 'forest_tree';

export interface CharacterSnapshot {
    id: string;
    name: string;
    type: CharacterType;
    x: number;
    y: number;
    action: string;
    needs: {
        hunger: number;
        thirst: number;
        energy: number;
    };
}

export interface CharacterFullData extends CharacterSnapshot {
    dna: CharacterDNA | null;  // DNA数据
    phenotype: unknown;  // 表型数据
    positionHistory?: { x: number; y: number; tick: number }[];
}

/**
 * 角色DNA数据（用于AI行为影响）
 */
export interface CharacterDNA {
    // 性格特质 (0-1)
    curiosity: number;       // 好奇心：探索范围
    bravery: number;        // 胆量：危险区域容忍度
    sociability: number;     // 社交性：靠近其他角色
    aggression: number;      // 攻击性：防御/攻击倾向
    
    // 能力特质
    metabolism: number;      // 代谢：消耗速度倍率 (0.5-2.0)
    intelligence: number;    // 智力：决策质量
    speed: number;           // 移动速度
    
    // 外观（用于渲染）
    skinTone: number;        // 肤色 0-1
    height: number;          // 身高 0.7-1.3
}

export interface PlayerInput {
    action: 'move' | 'interact' | 'select' | 'idle';
    target?: { x: number; y: number };
    item?: ItemType;
}

// 联合类型用于WebSocket消息
export type ServerMessage = 
    | InitMessage 
    | StateMessage 
    | InputAckMessage 
    | CharacterSelectedMessage 
    | SeasonChangedMessage
    | { type: 'item_spawned'; data: any }
    | { type: 'error'; message: string }
    | { type: 'command_result'; result: any };

export type ClientMessage = 
    | InputMessage 
    | SelectCharacterMessage 
    | ChangeSeasonMessage
    | CommandMessage
    | AuthMessage;
