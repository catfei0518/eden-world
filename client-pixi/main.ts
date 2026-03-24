/**
 * 伊甸世界在线版入口
 */
import { GameApp, validateToken } from './GameApp';

// 防止重复初始化
let initialized = false;

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    if (initialized) return;
    initialized = true;
    
    // 验证 token
    const isValid = await validateToken();
    if (!isValid) {
        return; // validateToken 会自动跳转到登录页
    }
    
    console.log('🚀 启动伊甸世界在线版...');
    
    // 显示设置按钮
    const settingsBtn = document.getElementById('settings-btn') as HTMLElement;
    if (settingsBtn) {
        settingsBtn.style.display = 'block';
    }
    
    await new GameApp().init();
});
