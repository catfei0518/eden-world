/**
 * 伊甸世界 - 完整PixiJS客户端 v0.12
 * 基于宪法设计，支持实时同步
 */

import * as PIXI from 'pixi.js';
import { EdenServerClient } from './EdenServerClient';
import { Camera } from './Camera';

class EdenWorldClient {
    private app!: PIXI.Application;
    private server!: EdenServerClient;
    private worldContainer!: PIXI.Container;
    private camera!: Camera;
    private characterSprites: Map<string, any> = new Map();
    private itemSprites: Map<string, any> = new Map();
    private terrainRendered: boolean = false;
    private textures: Map<string, PIXI.Texture> = new Map();
    
    async init() {
        try {
            console.log('🌍 伊甸世界客户端启动...');
            await this.setupPixi();
            await this.loadTextures();
            this.setupServerConnection();
            this.setupStatusUI();
            this.setupConsoleUI();
            
            // 内联调试面板 - 使用alert确保显示
            const debugDiv = document.createElement('div');
            debugDiv.id = 'eden-debug-panel';
            debugDiv.style.cssText = 'position:fixed;top:120px;right:10px;background:rgba(255,0,0,0.9);color:white;padding:10px;border-radius:5px;z-index:99999;font-size:12px;min-width:220px;border:2px solid yellow;pointer-events:none;';
            debugDiv.textContent = '🔧 调试面板加载中...';
            document.body.appendChild(debugDiv);
            (window as any).edenDebug = debugDiv;
            document.title = '🔧 ' + document.title;
            
            console.log('🌍 伊甸世界客户端初始化完成');
        } catch (error) {
            console.error('初始化失败:', error);
            this.updateStatus('❌ 初始化失败');
        }
    }
    
    async setupPixi() {
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
        
        // 世界容器
        this.worldContainer = new PIXI.Container();
        this.worldContainer.sortableChildren = true;
        this.app.stage.addChild(this.worldContainer);
        
        // 相机控制
        this.camera = new Camera(this.worldContainer, canvas);
        this.camera.reset();
        
        // 窗口调整
        window.addEventListener('resize', () => {
            this.app.renderer.resize(window.innerWidth, window.innerHeight);
            this.camera.clamp();
        });
    }
    
    async loadTextures() {
        console.log('🔄 加载纹理...');
        
        const sources: Record<string, string> = {
            'grass': '/img/64x64像素草平原.png',
            'adam': '/img/亚当.png',
            'eve': '/img/夏娃.png',
            'berry': '/img/灌木果.png',
            'water': '/img/河流.png',
            'bush': '/img/灌木.png',
            'meat': '/img/生肉.png',
            'cooked_meat': '/img/熟肉.png'
        };
        
        for (const [key, path] of Object.entries(sources)) {
            try {
                const tex = await PIXI.Assets.load(path);
                this.textures.set(key, tex);
                console.log(`✅ ${key}: ${path}`);
            } catch (e) {
                console.error(`❌ ${key}: ${path}`, e);
            }
        }
    }
    
    setupServerConnection() {
        this.server = new EdenServerClient();
        
        this.server.on('connect', () => {
            console.log('✅ 已连接到服务器');
            this.updateStatus('✅ 已连接 - 等待数据...');
        });
        
        this.server.on('disconnect', () => {
            this.updateStatus('❌ 断开连接');
        });
        
        this.server.on('init', (state) => {
            console.log('📊 收到初始状态:', JSON.stringify(state, null, 2).substring(0, 500));
            this.renderState(state);
            this.updateStatus('✅ 游戏运行中');
        });
        
        this.server.on('state', (state) => {
            this.renderState(state);
        });
        
        this.server.connect();
    }
    
    renderState(state: any) {
        if (!state) return;
        
        // 渲染地形（只一次）
        if (state.world?.tiles && !this.terrainRendered) {
            this.renderTerrain(state.world.tiles);
            this.terrainRendered = true;
        }
        
        // 渲染物品
        this.renderItems(state.world);
        
        // 渲染角色
        for (const char of state.characters) {
            this.renderCharacter(char);
        }
        
        // 更新状态面板
        this.updateStatusPanel(state);
    }
    
    async renderTerrain(tiles: any[][]) {
        console.log('🗺️ 渲染地形...');
        
        const grassTex = this.textures.get('grass');
        if (!grassTex) return;
        
        // 渲染角色周围区域
        const viewRadius = 25;
        const centerX = 50;
        const centerY = 25;
        
        for (let dy = -viewRadius; dy <= viewRadius; dy++) {
            for (let dx = -viewRadius; dx <= viewRadius; dx++) {
                const tx = centerX + dx;
                const ty = centerY + dy;
                
                if (tx < 0 || tx >= 100 || ty < 0 || ty >= 50) continue;
                
                const sprite = new PIXI.Sprite(grassTex);
                sprite.x = tx * 64;
                sprite.y = ty * 64;
                sprite.zIndex = 0;
                this.worldContainer.addChildAt(sprite, 0);
            }
        }
        
        console.log('✅ 地形渲染完成');
    }
    
    renderItems(world: any) {
        if (!world) return;
        
        // 渲染食物（浆果灌木）
        if (world.foods) {
            const berryTex = this.textures.get('berry');
            const bushTex = this.textures.get('bush');
            
            for (const food of world.foods) {
                const tex = food.type === 'berry' ? berryTex : bushTex;
                if (!tex) continue;
                
                let sprite = this.itemSprites.get(`food_${food.id}`);
                if (!sprite) {
                    sprite = new PIXI.Sprite(tex);
                    // 使用完整tile大小，但显示在tile中心
                    sprite.anchor.set(0.5);
                    this.worldContainer.addChild(sprite);
                    this.itemSprites.set(`food_${food.id}`, sprite);
                }
                // 居中在tile中心
                sprite.x = food.x * 64 + 32;
                sprite.y = food.y * 64 + 32;
                sprite.zIndex = 1;
                sprite.alpha = food.durability > 0 ? 1 : 0.3;
            }
        }
        
        // 渲染水源
        if (world.waters) {
            const waterTex = this.textures.get('water');
            if (waterTex) {
                for (const water of world.waters) {
                    let sprite = this.itemSprites.get(`water_${water.id}`);
                    if (!sprite) {
                        sprite = new PIXI.Sprite(waterTex);
                        sprite.anchor.set(0.5);
                        this.worldContainer.addChild(sprite);
                        this.itemSprites.set(`water_${water.id}`, sprite);
                    }
                    // 居中在tile中心
                    sprite.x = water.x * 64 + 32;
                    sprite.y = water.y * 64 + 32;
                    sprite.zIndex = 1;
                }
            }
        }
    }
    
    renderCharacter(charData: any) {
        let sprite = this.characterSprites.get(charData.id);
        
        if (!sprite) {
            sprite = this.createCharacterSprite(charData);
            this.worldContainer.addChild(sprite);
            this.characterSprites.set(charData.id, sprite);
        }
        
        // 更新位置 - 居中在tile中心
        if (charData.x !== null && charData.y !== null) {
            sprite.x = charData.x * 64 + 32;
            sprite.y = charData.y * 64 + 32;
        }
        sprite.zIndex = 10;
        
        // 更新名称
        sprite.label.text = charData.name;
        
        // 更新动作
        sprite.action.text = charData.action || '';
        
        // 更新状态条
        const hungerKcal = charData.hunger || 2000;
        const thirst = charData.thirst || 100;
        
        // 饥饿显示为百分比(基于2000kcal), 口渴保持百分比
        sprite.hungerBar.scale.x = Math.min(1, hungerKcal / 2000);
        sprite.thirstBar.scale.x = thirst / 100;
        
        // 更新数值显示 - 饥饿显示kcal, 口渴显示百分比
        sprite.hungerText.text = `🍖 ${Math.round(hungerKcal)}`;
        sprite.thirstText.text = `💧 ${Math.round(thirst)}%`;
        
        // 根据饥饿口渴状态改变颜色
        if (hungerKcal < 400) {  // 低于20%
            sprite.hungerBar.tint = 0xFF0000;
        } else if (hungerKcal < 1000) {  // 低于50%
            sprite.hungerBar.tint = 0xFFAA00;
        } else {
            sprite.hungerBar.tint = 0x00FF00;
        }
        
        if (thirst < 30) {
            sprite.thirstBar.tint = 0xFF0000;
        } else if (thirst < 60) {
            sprite.thirstBar.tint = 0xFFAA00;
        } else {
            sprite.thirstBar.tint = 0x00AAFF;
        }
        
        // 更新HTML调试面板
        const debugEl = document.getElementById('debug-content');
        if (debugEl) {
            let html = '';
            this.characterSprites.forEach((sp: any, id: string) => {
                const isAdam = id.includes('adam');
                html += isAdam ? '👨 亚当<br>' : '👩 夏娃<br>';
                html += `  x: ${sp.x?.toFixed(0) || 'N/A'}<br>`;
                html += `  y: ${sp.y?.toFixed(0) || 'N/A'}<br>`;
                html += `  visible: ${sp.visible}<br><br>`;
            });
            debugEl.innerHTML = html || '无角色';
        }
    }
    
    createCharacterSprite(charData: any) {
        const container = new PIXI.Container();
        
        // 获取角色纹理
        const texKey = charData.type === 'adam' ? 'adam' : 'eve';
        const baseTex = this.textures.get(texKey);
        
        if (baseTex) {
            // 使用图片，居中显示
            const sprite = new PIXI.Sprite(baseTex);
            sprite.anchor.set(0.5);
            container.addChild(sprite);
        } else {
            // 回退到圆形
            const body = new PIXI.Graphics();
            body.circle(0, 0, 16);
            body.fill(charData.type === 'adam' ? 0x4169E1 : 0xFF69B4);
            body.stroke({ width: 2, color: 0x333333 });
            container.addChild(body);
        }
        
        // 名称背景 - 在角色上方
        const nameBg = new PIXI.Graphics();
        nameBg.roundRect(-30, -55, 60, 18, 4);
        nameBg.fill({ color: 0x000000, alpha: 0.7 });
        container.addChild(nameBg);
        
        // 名称标签
        const label = new PIXI.Text({
            text: charData.name,
            style: { fontSize: 11, fill: 0xFFFFFF, fontWeight: 'bold' }
        });
        label.y = -53;
        label.anchor.set(0.5, 0);
        container.addChild(label);
        container.label = label;
        
        // 动作背景 - 在角色下方
        const actionBg = new PIXI.Graphics();
        actionBg.roundRect(-35, 35, 70, 16, 4);
        actionBg.fill({ color: 0x000000, alpha: 0.5 });
        container.addChild(actionBg);
        
        // 动作标签
        const action = new PIXI.Text({
            text: charData.action || '',
            style: { fontSize: 9, fill: 0xCCCCCC }
        });
        action.y = 37;
        action.anchor.set(0.5, 0);
        container.addChild(action);
        container.action = action;
        
        // 饥饿条背景
        const hungerBg = new PIXI.Graphics();
        hungerBg.roundRect(-25, 55, 50, 6, 2);
        hungerBg.fill(0x333333);
        container.addChild(hungerBg);
        
        // 饥饿条
        const hungerBar = new PIXI.Graphics();
        hungerBar.roundRect(-25, 55, 50, 6, 2);
        hungerBar.fill(0xFF6B6B);
        container.addChild(hungerBar);
        container.hungerBar = hungerBar;
        
        // 饥饿数值
        const hungerText = new PIXI.Text({
            text: '🍖 100%',
            style: { fontSize: 8, fill: 0xFFFFFF }
        });
        hungerText.y = 63;
        hungerText.anchor.set(0.5, 0);
        container.addChild(hungerText);
        container.hungerText = hungerText;
        
        // 口渴条背景
        const thirstBg = new PIXI.Graphics();
        thirstBg.roundRect(-25, 73, 50, 6, 2);
        thirstBg.fill(0x333333);
        container.addChild(thirstBg);
        
        // 口渴条
        const thirstBar = new PIXI.Graphics();
        thirstBar.roundRect(-25, 73, 50, 6, 2);
        thirstBar.fill(0x4ECDC4);
        container.addChild(thirstBar);
        container.thirstBar = thirstBar;
        
        // 口渴数值
        const thirstText = new PIXI.Text({
            text: '💧 100%',
            style: { fontSize: 8, fill: 0xFFFFFF }
        });
        thirstText.y = 81;
        thirstText.anchor.set(0.5, 0);
        container.addChild(thirstText);
        container.thirstText = thirstText;
        
        return container;
    }
    
    setupDebugPanel() {
        // 调试面板 - 显示所有角色位置
        const debugDiv = document.createElement('div');
        debugDiv.id = 'debug-panel';
        debugDiv.style.cssText = `
            position: fixed;
            top: 120px;
            right: 10px;
            background: rgba(255,0,0,0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 11px;
            z-index: 99999;
            min-width: 200px;
            border: 2px solid yellow;
        `;
        document.body.appendChild(debugDiv);
        (this as any).debugPanel = debugDiv;
        (window as any).edenDebugPanel = debugDiv; // 全局暴露
        console.log('🔧 调试面板已创建');
    }
    
    updateDebugPanel() {
        const debugDiv = (this as any).debugPanel;
        if (!debugDiv) return;
        
        let html = '<b style="color:yellow">🔧 角色调试:</b><br>';
        this.characterSprites.forEach((sprite: any, id: string) => {
            const isAdam = id.includes('adam');
            html += `${isAdam ? '👨' : '👩'} ${isAdam ? '亚当' : '夏娃'}<br>`;
            html += `  x: ${sprite.x?.toFixed(0) || 'N/A'}<br>`;
            html += `  y: ${sprite.y?.toFixed(0) || 'N/A'}<br>`;
            html += `  visible: ${sprite.visible}<br>`;
            html += `  parent: ${sprite.parent?.constructor.name || 'none'}<br>`;
            html += `  children: ${sprite.children?.length || 0}<br>`;
            html += '<br>';
        });
        debugDiv.innerHTML = html;
    }
    
    setupStatusUI() {
        // 状态面板HTML
        const panel = document.createElement('div');
        panel.id = 'status-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 15px;
            border-radius: 10px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            min-width: 200px;
            z-index: 1000;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        panel.innerHTML = `
            <div style="font-size:16px;font-weight:bold;margin-bottom:10px;">📊 游戏状态</div>
            <div id="char-list">等待连接...</div>
        `;
        document.body.appendChild(panel);
    }
    
    updateStatusPanel(state: any) {
        const charList = document.getElementById('char-list');
        if (!charList || !state.characters) return;
        
        charList.innerHTML = state.characters.map((char: any) => {
            // 状态文字（与单机版一致）
            const hunger = Math.round(char.hunger || 0);
            const thirst = Math.round(char.thirst || 0);
            let status = char.action || '🧘待机';
            if (char.action === '闲置') status = '🧘待机';
            else if (char.action === '饮水中') status = '💧饮水';
            else if (char.action === '进食中') status = '🍖进食';
            else if (char.action === '休息中') status = '💤休息';
            else if (char.action?.includes('寻找')) status = '🔍探索';
            else if (thirst < 30) status = '💧很渴';
            else if (hunger < 30) status = '🍖很饿';
            else if (thirst < 50) status = '💧口渴';
            else if (hunger < 50) status = '🍖饥饿';
            else status = '🚶移动';
            
            return `
            <div style="margin:8px 0;padding:8px;background:rgba(255,255,255,0.1);border-radius:5px;">
                <div style="font-weight:bold;color:${char.id === 'adam' ? '#6495ED' : '#FFB6C1'}">
                    ${char.name}
                </div>
                <div style="color:#aaa;margin-top:4px;">
                    位置: (${char.x}, ${char.y})<br/>
                    状态: ${status}<br/>
                    饥饿: ${hunger}%<br/>
                    口渴: ${thirst}%
                </div>
            </div>
        `}).join('');
    }
    
    setupConsoleUI() {
        // 创建控制台
        const console = document.createElement('div');
        console.id = 'game-console';
        console.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.9);
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            display: none;
        `;
        
        const input = document.createElement('input');
        input.id = 'console-input';
        input.type = 'text';
        input.placeholder = '输入命令 (help 查看命令列表)';
        input.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #222;
            color: #0f0;
            border: 1px solid #444;
            border-radius: 4px;
            font-family: monospace;
        `;
        
        console.appendChild(input);
        document.body.appendChild(console);
        
        // 控制台切换
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === '~') {
                e.preventDefault();
                console.style.display = console.style.display === 'none' ? 'block' : 'none';
                if (console.style.display === 'block') {
                    input.focus();
                }
            }
        });
        
        // 命令处理
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = input.value.trim();
                if (cmd) {
                    this.executeCommand(cmd);
                    input.value = '';
                }
            }
        });
    }
    
    executeCommand(cmd: string) {
        console.log('命令:', cmd);
        
        const [command, ...args] = cmd.split(' ');
        
        switch (command.toLowerCase()) {
            case 'help':
                alert('命令列表:\n- help: 显示帮助\n- season [spring/summer/autumn/winter]: 切换季节\n- reset: 重置视角\n- debug: 调试信息');
                break;
            case 'season':
                if (args[0]) {
                    this.server.send({ type: 'season', season: args[0] });
                    this.updateStatus(`季节切换: ${args[0]}`);
                }
                break;
            case 'reset':
                this.camera.reset();
                break;
            case 'debug':
                console.log('调试信息:', {
                    characters: this.characterSprites.size,
                    items: this.itemSprites.size,
                    textures: this.textures.size
                });
                break;
            default:
                console.log('未知命令:', command);
        }
    }
    
    updateStatus(text: string) {
        let status = document.getElementById('status');
        if (!status) {
            status = document.createElement('div');
            status.id = 'status';
            status.style.cssText = 'position:fixed;bottom:60px;left:10px;background:rgba(0,0,0,0.7);color:white;padding:8px 12px;border-radius:5px;z-index:1000;font-family:Arial,sans-serif;font-size:12px;';
            document.body.appendChild(status);
        }
        status.textContent = text;
    }
}

// 启动
window.addEventListener('DOMContentLoaded', () => {
    new EdenWorldClient().init();
});
