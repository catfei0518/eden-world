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
    dna: unknown;  // DNA数据
    phenotype: unknown;  // 表型数据
    positionHistory?: { x: number; y: number; tick: number }[];
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
    | SeasonChangedMessage;

export type ClientMessage = 
    | InputMessage 
    | SelectCharacterMessage 
    | ChangeSeasonMessage;
