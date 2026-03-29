/**
 * 移动端相机补丁 - 单指拖动 + 双指缩放
 * 
 * 这个脚本在主bundle加载后执行，覆盖原有的Camera类
 */

// 检查是否已经有Camera类
if (typeof Camera !== 'undefined') {
    console.log('📱 加载移动端相机补丁...');
    
    // 保存旧的Camera实现
    const OldCamera = Camera;
    
    // 新的Camera类 - 增加移动端支持
    class MobileCamera extends OldCamera {
        constructor(...args) {
            super(...args);
            
            this.isTouchDragging = false;
            this.lastTouchX = 0;
            this.lastTouchY = 0;
            this.isPinching = false;
            this.lastPinchDistance = 0;
            this.lastPinchCenterX = 0;
            this.lastPinchCenterY = 0;
            
            this.setupTouchControls();
        }
        
        setupTouchControls() {
            const canvas = document.querySelector('#game-container canvas');
            if (!canvas) return;
            
            // 阻止默认触摸行为
            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                
                if (e.touches.length === 1) {
                    this.isTouchDragging = true;
                    this.lastTouchX = e.touches[0].clientX;
                    this.lastTouchY = e.touches[0].clientY;
                } else if (e.touches.length === 2) {
                    this.isTouchDragging = false;
                    this.isPinching = true;
                    
                    const dx = e.touches[1].clientX - e.touches[0].clientX;
                    const dy = e.touches[1].clientY - e.touches[0].clientY;
                    this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
                    this.lastPinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    this.lastPinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                }
            }, { passive: false });
            
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                
                if (e.touches.length === 1 && this.isTouchDragging) {
                    const dx = e.touches[0].clientX - this.lastTouchX;
                    const dy = e.touches[0].clientY - this.lastTouchY;
                    
                    this.target.x += dx;
                    this.target.y += dy;
                    
                    this.lastTouchX = e.touches[0].clientX;
                    this.lastTouchY = e.touches[0].clientY;
                    
                    this.clamp();
                } else if (e.touches.length === 2 && this.isPinching) {
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    
                    const dx = touch2.clientX - touch1.clientX;
                    const dy = touch2.clientY - touch1.clientY;
                    const currentDistance = Math.sqrt(dx * dx + dy * dy);
                    const currentCenterX = (touch1.clientX + touch2.clientX) / 2;
                    const currentCenterY = (touch1.clientY + touch2.clientY) / 2;
                    
                    const scaleChange = currentDistance / this.lastPinchDistance;
                    const newScale = Math.max(0.15, Math.min(6, this.scale * scaleChange));
                    
                    if (newScale !== this.scale) {
                        const worldX = (currentCenterX - this.target.x) / this.scale;
                        const worldY = (currentCenterY - this.target.y) / this.scale;
                        
                        this.target.scale.set(newScale);
                        this.scale = newScale;
                        
                        this.target.x = currentCenterX - worldX * newScale;
                        this.target.y = currentCenterY - worldY * newScale;
                        
                        this.clamp();
                    }
                    
                    this.lastPinchDistance = currentDistance;
                    this.lastPinchCenterX = currentCenterX;
                    this.lastPinchCenterY = currentCenterY;
                }
            }, { passive: false });
            
            canvas.addEventListener('touchend', (e) => {
                if (e.touches.length === 0) {
                    this.isTouchDragging = false;
                    this.isPinching = false;
                } else if (e.touches.length === 1) {
                    this.isPinching = false;
                    this.isTouchDragging = true;
                    this.lastTouchX = e.touches[0].clientX;
                    this.lastTouchY = e.touches[0].clientY;
                }
            }, { passive: false });
            
            console.log('📱 移动端触摸控制已启用');
        }
    }
    
    // 覆盖全局Camera类
    window.Camera = MobileCamera;
    console.log('✅ 移动端相机补丁加载完成');
} else {
    console.warn('⚠️ 未找到Camera类，补丁跳过');
}
