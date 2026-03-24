/**
 * 伊甸世界 - 共享常量配置
 */

export const MAP_CONFIG = {
    WIDTH: 100,
    HEIGHT: 50,
    TILE_SIZE: 64,
    SCALE: 1.35,
};

export const HITBOX_CONFIG = {
    CHARACTER_SIZE: 48,
    ITEM_SIZE: 40,
};

export const UI_CONFIG = {
    STATUS_PANEL_ZINDEX: 9999,
    CAMERA_ZOOM_LEVELS: {
        FAR: 0.25,
        NORMAL: 1,
        CLOSE: 4
    }
};

export const ITEM_ICONS: Record<string, string> = {
    tree: '🌲',
    bush: '🌿',
    stone: '🪨',
    rock: '🪨',
    stick: '🪵',
    berry: '🫐',
    flower: '🌸',
    branch: '🌳'
};

export const ITEM_NAMES: Record<string, string> = {
    tree: '树',
    bush: '灌木',
    stone: '石头',
    rock: '石头',
    stick: '木棍',
    berry: '浆果丛',
    flower: '花朵',
    branch: '树枝'
};

export const LAYER_NAMES: Record<string, string> = {
    ground: '地面',
    low: '低处',
    high: '高处'
};
