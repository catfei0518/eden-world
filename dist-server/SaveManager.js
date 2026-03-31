"use strict";
/**
 * 伊甸世界 - 存档管理系统 v1.0
 *
 * 宪法要求：
 * - 程序化生成，无限扩展，按需加载，不占内存
 * - AI的记忆和历史需要持久化
 * - 文明涌现机制需要连续性
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaveManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SaveManager {
    constructor(saveDir = './saves') {
        this.autoSaveInterval = 5 * 60 * 1000; // 5分钟自动存档
        this.intervalId = null;
        // 存档回调
        this.getSaveData = () => null;
        this.onLoad = () => { };
        this.saveDir = saveDir;
        this.saveFile = path.join(saveDir, 'eden_world_save.json');
    }
    /**
     * 设置存档数据获取回调
     */
    setSaveDataCallback(callback) {
        this.getSaveData = callback;
    }
    /**
     * 设置加载回调
     */
    setLoadCallback(callback) {
        this.onLoad = callback;
    }
    /**
     * 确保存档目录存在
     */
    ensureSaveDir() {
        if (!fs.existsSync(this.saveDir)) {
            fs.mkdirSync(this.saveDir, { recursive: true });
        }
    }
    /**
     * 保存游戏状态
     */
    save() {
        try {
            const saveData = this.getSaveData();
            if (!saveData) {
                console.log('⚠️ 没有数据需要保存');
                return false;
            }
            this.ensureSaveDir();
            // 添加时间戳
            saveData.timestamp = Date.now();
            // 写入临时文件，然后原子性重命名
            const tempFile = this.saveFile + '.tmp';
            fs.writeFileSync(tempFile, JSON.stringify(saveData, null, 2), 'utf8');
            fs.renameSync(tempFile, this.saveFile);
            console.log(`💾 存档已保存: ${this.saveFile} (${(JSON.stringify(saveData).length / 1024).toFixed(1)}KB)`);
            return true;
        }
        catch (error) {
            console.error('❌ 存档失败:', error);
            return false;
        }
    }
    /**
     * 加载游戏状态
     */
    load() {
        try {
            if (!fs.existsSync(this.saveFile)) {
                console.log('📁 没有找到存档，将创建新世界');
                return false;
            }
            const data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
            if (!data.version || !data.time) {
                console.log('⚠️ 存档格式无效，将创建新世界');
                return false;
            }
            console.log(`📂 读取存档: ${this.saveFile}`);
            console.log(`   版本: ${data.version}`);
            console.log(`   时间: ${new Date(data.timestamp).toLocaleString()}`);
            this.onLoad(data);
            return true;
        }
        catch (error) {
            console.error('❌ 读取存档失败:', error);
            return false;
        }
    }
    /**
     * 获取存档信息（不加载完整数据）
     */
    getSaveInfo() {
        try {
            if (!fs.existsSync(this.saveFile)) {
                return { exists: false };
            }
            const stats = fs.statSync(this.saveFile);
            const data = JSON.parse(fs.readFileSync(this.saveFile, 'utf8'));
            return {
                exists: true,
                timestamp: data.timestamp,
                version: data.version
            };
        }
        catch {
            return { exists: false };
        }
    }
    /**
     * 启动自动存档
     */
    startAutoSave() {
        if (this.intervalId) {
            console.log('⏰ 自动存档已在运行');
            return;
        }
        this.intervalId = setInterval(() => {
            console.log('⏰ 执行自动存档...');
            this.save();
        }, this.autoSaveInterval);
        console.log(`⏰ 自动存档已启动 (每${this.autoSaveInterval / 60000}分钟)`);
    }
    /**
     * 停止自动存档
     */
    stopAutoSave() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏰ 自动存档已停止');
        }
    }
    /**
     * 立即存档（用于服务器关闭时）
     */
    saveSync() {
        // 同步版本（简化版）
        try {
            const saveData = this.getSaveData();
            if (!saveData)
                return false;
            this.ensureSaveDir();
            saveData.timestamp = Date.now();
            fs.writeFileSync(this.saveFile, JSON.stringify(saveData, null, 2), 'utf8');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 删除存档
     */
    deleteSave() {
        try {
            if (fs.existsSync(this.saveFile)) {
                fs.unlinkSync(this.saveFile);
                console.log('🗑️ 存档已删除');
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('❌ 删除存档失败:', error);
            return false;
        }
    }
}
exports.SaveManager = SaveManager;
