/**
 * 伊甸世界 - Web客户端
 * 连接服务器WebSocket，接收游戏状态并渲染
 */

import * as PIXI from 'pixi.js';
import { EdenServerClient } from './EdenServerClient';

export class EdenWorldClient {
    constructor() {
        this.app = new PIXI.Application();
        this.server = new EdenServerClient();
        this.characters = new Map();
        this.worldContainer = new PIXI.Container();
        this.characterSprites = new Map();
        this.terrainRendered = false;
        
        this.init();
    }
    
    async init() {
        try {
            await this.setupPixi();
            this.setupServerConnection();
        } catch (error) {
            console.error('初始化失败:', error);
            this.updateStatus('❌ 初始化失败');
        }
    }
    
    async setupPixi() {
        // PixiJS v8 方式
        const container = document.getElementById('game-container')!;
        
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);
        
        this.app = new PIXI.Application();
        await this.app.init({
            canvas: canvas,
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0x87CEEB,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });
        
        // 创建世界容器
        this.app.stage.addChild(this.worldContainer);
        
        // 缩放 - 让地图变小一点能看到全貌
        this.worldContainer.scale.set(0.5);
        
        // 居中
        this.worldContainer.x = 0;
        this.worldContainer.y = 0;
        
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
        });
        
        // 添加相机控制
        this.setupCameraControls();
    }
    
    setupCameraControls() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        
        // 鼠标拖动
        this.app.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            this.app.canvas.style.cursor = 'grabbing';
        });
        
        window.addEventListener('mouseup', () => {
            isDragging = false;
            this.app.canvas.style.cursor = 'grab';
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            
            this.worldContainer.x += dx;
            this.worldContainer.y += dy;
            
            lastX = e.clientX;
            lastY = e.clientY;
        });
        
        // 鼠标滚轮缩放
        this.app.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = this.worldContainer.scale.x * scaleFactor;
            
            // 限制缩放范围
            if (newScale > 0.1 && newScale < 5) {
                this.worldContainer.scale.set(newScale);
            }
        });
        
        // 设置鼠标样式
        this.app.canvas.style.cursor = 'grab';
    }
    
    async renderTerrain(tiles) {
        console.log('renderTerrain called, tiles:', tiles.length);
        
        // 加载草地图片
        const texture = await PIXI.Assets.load('/img/64x64像素草平原.png');
        
        // 只渲染角色周围的一小块区域
        const viewRadius = 10;  // 10 tile范围
        const centerX = 50;
        const centerY = 25;
        
        for (let dy = -viewRadius; dy <= viewRadius; dy++) {
            for (let dx = -viewRadius; dx <= viewRadius; dx++) {
                const tileX = centerX + dx;
                const tileY = centerY + dy;
                
                // 确保在地图范围内
                if (tileX < 0 || tileX >= 100 || tileY < 0 || tileY >= 50) continue;
                
                const tile = tiles[tileY]?.[tileX];
                if (!tile) continue;
                
                const sprite = new PIXI.Sprite(texture);
                sprite.x = tileX * 64;
                sprite.y = tileY * 64;
                this.worldContainer.addChildAt(sprite, 0);
            }
        }
        
        console.log('添加草地纹理');
    }
    
    setupServerConnection() {
        // 连接服务器
        this.server.on('connect', () => {
            console.log('✅ 已连接到服务器');
            this.updateStatus('✅ 已连接');
        });
        
        this.server.on('disconnect', (info) => {
            console.log('❌ 断开连接:', info);
            this.updateStatus('❌ 断开连接');
        });
        
        this.server.on('error', (error) => {
            console.error('连接错误:', error);
            this.showError('连接错误: ' + JSON.stringify(error));
        });
        
        this.server.on('state', (state) => {
            this.renderState(state);
        });
        
        this.server.on('init', (state) => {
            console.log('📊 收到初始状态:', state.characters.length, '个角色');
            this.updateStatus('✅ 已连接 - ' + state.characters.length + '个角色');
            this.renderState(state);
        });
        
        this.server.on('error', (err) => {
            this.showError('错误: ' + err);
        });
        
        this.server.connect();
    }
    
    renderState(state) {
        if (!state) {
            console.log('⚠️ state为空');
            return;
        }
        
        console.log('🎨 开始渲染, 角色数:', state.characters?.length);
        
        // 渲染地形（只渲染一次）
        if (state.world?.tiles && !this.terrainRendered) {
            this.renderTerrain(state.world.tiles).then(() => {
                this.terrainRendered = true;
            });
        }
        
        // 渲染角色
        for (const char of state.characters) {
            console.log('渲染角色:', char.name, char.x, char.y);
            this.renderCharacter(char);
        }
        
        console.log('✅ 渲染完成');
    }
    
    renderCharacter(charData) {
        console.log('renderCharacter:', charData.id, charData.x, charData.y);
        let sprite = this.characterSprites.get(charData.id);
        
        if (!sprite) {
            // 创建新角色精灵
            sprite = this.createCharacterSprite(charData);
            this.worldContainer.addChild(sprite);
            this.characterSprites.set(charData.id, sprite);
            console.log('创建精灵成功, 世界容器子元素:', this.worldContainer.children.length);
        }
        
        // 更新位置
        if (charData.x !== null && charData.y !== null) {
            sprite.x = charData.x * 64;  // tile size = 64
            sprite.y = charData.y * 64;
        }
        
        // 更新名称
        sprite.label.text = charData.name;
        
        // 更新动作
        sprite.action.text = charData.action;
        
        // 根据动作改变颜色
        const colors = {
            '寻找食物': 0xFF6B6B,
            '寻找水源': 0x4ECDC4,
            '吃东西': 0xFFE66D,
            '喝水': 0x4DABF7,
            '休息': 0x9775FA,
            '探索': 0x69DB7C,
            '闲置': 0xADB5BD,
        };
        sprite.body.tint = colors[charData.action] || 0xFFFFFF;
        
        // 更新状态条
        sprite.hungerBar.scale.x = (charData.hunger || 100) / 100;
        sprite.thirstBar.scale.x = (charData.thirst || 100) / 100;
    }
    
    createCharacterSprite(charData) {
        const container = new PIXI.Container();
        
        // 身体（圆形）
        const body = new PIXI.Graphics();
        body.circle(0, 0, 12);
        body.fill(0xFF6B6B);
        body.stroke({ width: 2, color: 0x333333 });
        container.addChild(body);
        container.body = body;
        
        // 名称标签
        const label = new PIXI.Text({
            text: charData.name,
            style: {
                fontSize: 10,
                fill: 0xFFFFFF,
                fontWeight: 'bold',
            }
        });
        label.y = -22;
        label.anchor.set(0.5, 0);
        container.addChild(label);
        container.label = label;
        
        // 动作标签
        const action = new PIXI.Text({
            text: charData.action || '',
            style: { fontSize: 8, fill: 0xCCCCCC }
        });
        action.y = 18;
        action.anchor.set(0.5, 0);
        container.addChild(action);
        container.action = action;
        
        // 饥饿条
        const hungerBg = new PIXI.Graphics();
        hungerBg.rect(-15, 25, 30, 3);
        hungerBg.fill(0x333333);
        container.addChild(hungerBg);
        
        const hungerBar = new PIXI.Graphics();
        hungerBar.rect(-15, 25, 30, 3);
        hungerBar.fill(0xFF6B6B);
        container.addChild(hungerBar);
        container.hungerBar = hungerBar;
        
        // 口渴条
        const thirstBg = new PIXI.Graphics();
        thirstBg.rect(-15, 30, 30, 3);
        thirstBg.fill(0x333333);
        container.addChild(thirstBg);
        
        const thirstBar = new PIXI.Graphics();
        thirstBar.rect(-15, 30, 30, 3);
        thirstBar.fill(0x4ECDC4);
        container.addChild(thirstBar);
        container.thirstBar = thirstBar;
        
        return container;
    }
    
    updateStatus(text) {
        let status = document.getElementById('status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'status';
            status.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:10px;border-radius:5px;z-index:1000;';
            document.body.appendChild(status);
        }
        status.textContent = text;
    }
    
    showError(text) {
        let error = document.getElementById('error');
        if (!error) {
            error = document.createElement('div');
            error.id = 'error';
            error.style.cssText = 'position:fixed;top:50px;left:10px;background:rgba(255,0,0,0.7);color:white;padding:10px;border-radius:5px;z-index:1000;font-family:Arial,sans-serif;font-size:12px;';
            document.body.appendChild(error);
        }
        error.textContent = text;
        error.style.display = 'block';
    }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    console.log('🌍 伊甸世界客户端启动中...');
    new EdenWorldClient();
});
