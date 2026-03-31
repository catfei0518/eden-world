/**
 * 物品状态UI - 点击物品时显示的信息面板
 */

import { GameItem } from './pixi/layers/ItemLayer';

export class ItemStatusUI {
    private panel: HTMLElement;
    private selectedItem: GameItem | null = null;
    private lastClickTime: number = 0;
    
    constructor() {
        this.createPanel();
        this.setupClickOutside();
        this.setupEscKey();
    }
    
    private createPanel(): void {
        // 创建面板
        this.panel = document.createElement('div');
        this.panel.id = 'item-status-panel';
        this.panel.className = 'item-status-panel';
        this.panel.innerHTML = `
            <h3>
                <span id="item-panel-title">📦 物品信息</span>
                <span class="item-icon" id="item-icon">🌿</span>
            </h3>
            <div class="item-info">
                <div class="info-row">
                    <span class="label">名称：</span>
                    <span class="value" id="item-name">-</span>
                </div>
                <div class="info-row">
                    <span class="label">坐标：</span>
                    <span class="value" id="item-position">-</span>
                </div>
                <div class="info-row">
                    <span class="label">位置：</span>
                    <span class="value" id="item-layer">-</span>
                </div>
            </div>
            <div class="durability-section" id="durability-section">
                <div class="durability-title">🍇 资源状态</div>
                <div class="durability-bar-container">
                    <div class="durability-bar">
                        <div class="durability-fill" id="durability-fill"></div>
                    </div>
                    <span class="durability-text" id="durability-text">0/0</span>
                </div>
            </div>
            <div class="action-hint">靠近后自动采集</div>
        `;
        this.panel.style.display = 'none';
        document.body.appendChild(this.panel);
        
        // 添加样式
        this.addStyles();
    }
    
    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .item-status-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(10, 10, 30, 0.95);
                border: 2px solid #8b5cf6;
                border-radius: 15px;
                padding: 20px;
                min-width: 280px;
                font-size: 13px;
                box-shadow: 0 8px 32px rgba(139, 92, 246, 0.3);
                z-index: 1000;
            }
            
            .item-status-panel h3 {
                color: #a78bfa;
                margin-bottom: 15px;
                font-size: 16px;
                border-bottom: 1px solid #4c1d95;
                padding-bottom: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .item-icon {
                font-size: 28px;
            }
            
            .item-info {
                background: rgba(139, 92, 246, 0.1);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
            }
            
            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
            }
            
            .info-row .label {
                color: #888;
            }
            
            .info-row .value {
                color: #fff;
                font-weight: bold;
            }
            
            .durability-section {
                margin-bottom: 15px;
            }
            
            .durability-title {
                color: #a78bfa;
                font-size: 12px;
                margin-bottom: 8px;
                font-weight: bold;
            }
            
            .durability-bar-container {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .durability-bar {
                flex: 1;
                height: 20px;
                background: #1a1a2e;
                border-radius: 10px;
                overflow: hidden;
            }
            
            .durability-fill {
                height: 100%;
                background: linear-gradient(90deg, #8b5cf6, #a78bfa);
                border-radius: 10px;
                transition: width 0.3s ease;
            }
            
            .durability-text {
                color: #a78bfa;
                font-weight: bold;
                min-width: 50px;
                text-align: right;
            }
            
            .action-hint {
                text-align: center;
                color: #666;
                font-size: 12px;
                padding: 8px;
                background: rgba(139, 92, 246, 0.1);
                border-radius: 6px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 显示物品信息
    showItem(item: GameItem): void {
        console.log('📋 ItemStatusUI.showItem 收到:', item, 'type:', item?.type, 'x:', item?.x, 'y:', item?.y);
        this.selectedItem = item;
        this.lastClickTime = Date.now();
        this.panel.style.display = 'block';
        this.update();
    }
    
    // 关闭面板
    hide(): void {
        this.selectedItem = null;
        this.panel.style.display = 'none';
    }
    
    // 更新显示
    update(): void {
        if (!this.selectedItem) return;
        
        const item = this.selectedItem;
        
        // 图标
        const iconElem = document.getElementById('item-icon');
        const icons: Record<string, string> = {
            'tree': '🌲',
            'bush': '🌿',
            'rock': '🪨',
            'stick': '🪵',
            'berry': '🫐',
            'flower': '🌸',
            'branch': '🌳'
        };
        if (iconElem) iconElem.textContent = icons[item.type] || '📦';
        
        // 名称
        const nameElem = document.getElementById('item-name');
        if (nameElem) nameElem.textContent = item.getName();
        
        // 坐标
        const posElem = document.getElementById('item-position');
        if (posElem) posElem.textContent = `(${item.x}, ${item.y})`;
        
        // 位置层级
        const layerElem = document.getElementById('item-layer');
        const layerNames: Record<string, string> = {
            'ground': '地面',
            'low': '低处',
            'high': '高处'
        };
        if (layerElem) layerElem.textContent = layerNames[item.layer] || '-';
        
        // 显示物品数量/资源
        const durSection = document.getElementById('durability-section');
        const durFill = document.getElementById('durability-fill');
        const durText = document.getElementById('durability-text');

        if (durSection && durFill && durText) {
            // 灌木显示耐久
            if (item.type === 'bush' || item.type === 'branch') {
                durSection.style.display = 'block';
                const durTitle = durSection.querySelector('.durability-title');
                if (durTitle) {
                    durTitle.textContent = item.type === 'bush' ? '🌿 灌木耐久' : '🌳 树枝耐久';
                }

                // 使用新的 resource 属性
                const current = item.resource?.current || 0;
                const max = item.resource?.max || 1;
                durFill.style.width = `${(current / max) * 100}%`;
                durText.textContent = `${current}/${max}`;
            } else {
                durSection.style.display = 'none';
            }
        }
    }
    
    // 点击空白处关闭
    private setupClickOutside(): void {
        document.addEventListener('pointerdown', (e) => {
            const target = e.target as HTMLElement;
            
            // 如果刚选中（200ms内），不关闭
            if (Date.now() - this.lastClickTime < 200) return;
            
            // 如果点击的是面板内部，不关闭
            if (this.panel.contains(target)) return;
            
            // 关闭
            if (this.selectedItem) {
                this.hide();
            }
        });
    }
    
    // ESC键关闭
    private setupEscKey(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedItem) {
                this.hide();
            }
        });
    }
}
