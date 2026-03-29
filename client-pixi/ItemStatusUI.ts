/**
 * 物品状态UI - 点击物品时显示的信息面板
 */

// 物品数据接口
export interface ItemData {
    type: string;
    x: number;
    y: number;
    layer: 'ground' | 'low' | 'high';
    durability?: number;
    maxDurability?: number;
    berryCount?: number;      // 浆果数量
    maxBerries?: number;     // 最大浆果数
    hasBerries?: boolean;    // 是否有浆果
}

export class ItemStatusUI {
    private panel: HTMLElement;
    private selectedItem: ItemData | null = null;
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
    showItem(item: ItemData): void {
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
        console.log('🔄 ItemStatusUI.update() 被调用');
        if (!this.selectedItem) {
            console.log('❌ selectedItem is null');
            return;
        }
        
        const item = this.selectedItem;
        console.log('🔄 更新物品:', item);
        
        // 图标和名称映射
        const icons: Record<string, string> = {
            'tree': '🌲',
            'bush': '🌿',
            'stone': '🪨',
            'rock': '🪨',
            'stick': '🪵',
            'berry': '🫐',
            'flower': '🌸',
            'branch': '🌳'
        };
        const names: Record<string, string> = {
            'tree': '树',
            'bush': '灌木',
            'stone': '石头',
            'rock': '石头',
            'stick': '木棍',
            'berry': '浆果丛',
            'flower': '花朵',
            'branch': '树枝'
        };
        const layerNames: Record<string, string> = {
            'ground': '地面',
            'low': '低处',
            'high': '高处'
        };
        
        // 更新图标
        const iconElem = document.getElementById('item-icon');
        if (iconElem) iconElem.textContent = icons[item.type] || '📦';
        
        // 更新名称
        const nameElem = document.getElementById('item-name');
        if (nameElem) nameElem.textContent = names[item.type] || '未知物品';
        
        // 更新坐标
        const posElem = document.getElementById('item-position');
        if (posElem) posElem.textContent = `(${item.x}, ${item.y})`;
        
        // 更新位置层级
        const layerElem = document.getElementById('item-layer');
        if (layerElem) layerElem.textContent = layerNames[item.layer] || '-';
        
        // 资源条（灌木显示浆果，其他显示耐久）
        const durSection = document.getElementById('durability-section');
        const durFill = document.getElementById('durability-fill');
        const durText = document.getElementById('durability-text');
        const durTitle = durSection?.querySelector('.durability-title');
        
        // 调试
        console.log(`📦 物品显示: ${item.type} berryCount=${item.berryCount} maxBerries=${item.maxBerries} hasBerries=${item.hasBerries}`);
        
        if (item.type === 'bush' && item.berryCount !== undefined && item.maxBerries) {
            // 灌木显示浆果数量
            durSection.style.display = 'block';
            if (durTitle) durTitle.textContent = '🍇 浆果数量';
            const pct = item.hasBerries ? (item.berryCount / item.maxBerries * 100) : 0;
            durFill.style.width = `${pct}%`;
            durFill.style.background = item.hasBerries ? 'linear-gradient(90deg, #e74c3c, #f39c12)' : '#555';
            durText.textContent = item.hasBerries ? `${item.berryCount}/${item.maxBerries}` : '无浆果';
        } else if (item.maxDurability && item.maxDurability > 0 && durSection && durFill && durText) {
            // 其他物品显示耐久度
            durSection.style.display = 'block';
            if (durTitle) durTitle.textContent = '🍇 资源状态';
            const pct = (item.durability || 0) / item.maxDurability * 100;
            durFill.style.width = `${pct}%`;
            durFill.style.background = 'linear-gradient(90deg, #e74c3c, #f39c12)';
            durText.textContent = `${item.durability || 0}/${item.maxDurability}`;
        } else if (durSection) {
            durSection.style.display = 'none';
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
