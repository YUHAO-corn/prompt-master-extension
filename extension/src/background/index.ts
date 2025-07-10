// extension/src/background/index.ts
import { initializeKeepAlive } from './keepAlive';
import { initializeContentScriptTracking } from './contentScriptManager';
import { initializeContextMenu } from './contextMenu';
import { initializeLifecycleEvents } from './initialization';
import { initializeMessageListeners } from './listeners';
import { initializeSidePanel } from './sidepanelManager';
import { CentralStateManager } from './services/centralStateManager';
import { QuotaService } from './services/quotaService';
import { RewardsService } from './services/rewardsService';

console.log('[AetherFlow] Background script loading...');

// --- Instantiate Central Services Early ---
let _centralStateManagerInstance: CentralStateManager | null = null;
let _quotaServiceInstance: QuotaService | null = null;
let _rewardsServiceInstance: RewardsService | null = null;

try {
    _centralStateManagerInstance = new CentralStateManager();
    _centralStateManagerInstance.initialize();
    console.log('[AetherFlow] CentralStateManager initialized successfully.');

    _quotaServiceInstance = new QuotaService(_centralStateManagerInstance);
    _quotaServiceInstance.initialize();
    console.log('[AetherFlow] QuotaService initialized successfully.');

    _rewardsServiceInstance = new RewardsService(_centralStateManagerInstance);
    _rewardsServiceInstance.initialize();
    console.log('[AetherFlow] RewardsService initialized successfully.');

} catch (error) {
    console.error('[AetherFlow] Failed to initialize central services:', error);
    // Decide how to handle this critical failure. Maybe disable certain features?
    // If CentralStateManager fails, other services likely won't initialize either.
}

// --- Export Getter Functions for Singleton Instances ---
export function getCentralStateManager(): CentralStateManager {
    if (!_centralStateManagerInstance) {
        console.error("CentralStateManager instance requested before successful initialization or after failure!");
        throw new Error("CentralStateManager not initialized or initialization failed");
    }
    return _centralStateManagerInstance;
}

export function getQuotaService(): QuotaService {
    if (!_quotaServiceInstance) {
        console.error("QuotaService instance requested before successful initialization or after failure!");
        throw new Error("QuotaService not initialized or initialization failed");
    }
    return _quotaServiceInstance;
}

export function getRewardsService(): RewardsService {
    if (!_rewardsServiceInstance) {
        console.error("RewardsService instance requested before successful initialization or after failure!");
        throw new Error("RewardsService not initialized or initialization failed");
    }
    return _rewardsServiceInstance;
}

// --- Initialize Background Features ---

// 生命周期事件监听器应首先设置，以确保能捕获 onInstalled 等事件
initializeLifecycleEvents();       // 设置 onStartup, onInstalled 监听器

// 然后初始化其他后台功能
initializeKeepAlive();               // 设置 Service Worker 保活
initializeContentScriptTracking();   // 设置内容脚本状态跟踪
initializeContextMenu();           // 设置上下文菜单
initializeSidePanel();             // 设置侧边栏行为和图标点击
initializeMessageListeners();      // 设置统一的消息监听器

console.log('[AetherFlow] Background script initializers called.');
// TODO: Create remaining handler modules (sidepanel, auth, aiFeatures, optimization, payment)
// TODO: Update listeners.ts to import and call functions from handler modules

// TODO: Consider passing centralStateManager instance to listeners or other modules if needed
// e.g., initializeMessageListeners(centralStateManager);
