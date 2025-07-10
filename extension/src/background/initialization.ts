// extension/src/background/initialization.ts

import { initializeFirebase, getFirebaseAuth } from '../services/auth/firebase';
import { safeLocalStorage, isServiceWorkerEnvironment, safeLogger } from '../utils/safeEnvironment';
import { cloudStorageService } from '../services/storage/cloudStorage'; // Verify path and export
import { storageService, migratePromptsData } from '../services/storage'; // Verify path and export
import { initializeContextMenu } from './contextMenu';
import { getQuotaService } from './index'; // Import getter for QuotaService

// Define alarm name
const RESET_OPTIMIZATION_ALARM_NAME = 'resetDailyOptimization';

// Constants for Alarm names
const PROCESS_PENDING_QUEUE_ALARM = 'processPendingQueueAlarm';
const PERIODIC_INCREMENTAL_SYNC_ALARM = 'periodicIncrementalSyncAlarm';

/**
 * 检查提示词库状态
 */
async function setupInitialData() {
  try {
    // 检查是否已有数据
    const existingPrompts = await storageService.getAllPrompts();

    // 记录提示词库状态
    if (existingPrompts.length === 0) {
      console.log('[AetherFlow] 后台: 提示词库为空，无初始数据');
      // 不再初始化示例数据，用户将使用推荐提示词功能
    } else {
      console.log('[AetherFlow] 后台: 已存在提示词数据, 共', existingPrompts.length, '条');
    }
  } catch (error) {
    console.error('[AetherFlow] 后台: 检查提示词库失败', error);
  }
}

/**
 * 初始化核心服务，如 Firebase 和云存储检查。
 */
async function initializeCoreServices() {
  try {
    // 初始化Firebase
    initializeFirebase();
    console.log('[Background] Firebase初始化成功');

    // 检查是否应使用云存储 - 使用 safeLocalStorage
    const useCloudStorageSetting = safeLocalStorage.getItem('USE_CLOUD_STORAGE');
    const useCloudStorage = useCloudStorageSetting === 'true';
    console.log('[Background] 云存储设置状态:', useCloudStorage ? '已启用' : '未启用');

    // TODO: Review this logic. Background scripts in MV3 are usually Service Workers.
    // This condition might rarely be true.
    if (!isServiceWorkerEnvironment && useCloudStorage) {
      // 只有在非SW环境且启用云存储时才执行相关逻辑
      console.log('[Background] 启用云存储服务 (非SW环境)');
      // 确保云存储服务已初始化
      if (cloudStorageService.isAuthenticated()) {
        console.log('[Background] 用户已登录，准备同步数据');
        try {
          // 执行同步
          const stats = await cloudStorageService.syncAllPrompts();
          console.log('[Background] 同步完成:', stats);
        } catch (error) {
          console.error('[Background] 同步失败:', error);
        }
      } else {
        console.log('[Background] 用户未登录，云存储处于待命状态');
      }
    } else if (isServiceWorkerEnvironment) {
      console.log('[Background] 在Service Worker中，云存储逻辑需要重新设计或确认行为。'); // Modified log
    } else {
       console.log('[Background] 使用本地存储服务 (或云存储未启用)');
    }

    // 添加详细的认证状态日志
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    console.log('[Background] 当前认证状态:', user ? '已登录' : '未登录');
    if (user) {
      console.log('[Background] 登录用户:', user.email);
    }
  } catch (error) {
    console.error('[Background] 服务初始化失败:', error);
  }
}

/**
 * 初始化每日配额重置定时器
 */
function initializeDailyQuotaResetAlarm() {
    safeLogger.log('[Background Tasks] Setting up daily quota reset alarm...');
    // 使用 alarms API 创建一个每日触发的定时器
    // periodInMinutes = 1440 意味着每 24 小时触发一次
    // delayInMinutes = 1 意味着首次触发在 1 分钟后（避免与启动过程冲突）
    //   或者，可以计算到下一个凌晨的时间差来精确设置首次触发
    //   let's start with a simple daily period for now.
    chrome.alarms.get(RESET_OPTIMIZATION_ALARM_NAME, (existingAlarm) => {
         if (!existingAlarm) {
              chrome.alarms.create(RESET_OPTIMIZATION_ALARM_NAME, { 
                  delayInMinutes: 1, // Trigger soon after setup
                  periodInMinutes: 60 * 24 // Repeat daily
              });
              safeLogger.log('[Background Tasks] Daily quota reset alarm created.');
         } else {
              safeLogger.log('[Background Tasks] Daily quota reset alarm already exists.');
         }
    });
}

/**
 * 处理定时器触发事件
 */
function handleAlarm(alarm: chrome.alarms.Alarm) {
    if (alarm.name === RESET_OPTIMIZATION_ALARM_NAME) {
        safeLogger.log('[Background Tasks] Received daily quota reset alarm.');
        try {
             const quotaService = getQuotaService();
             if (quotaService) {
                 quotaService.resetOptimizationUsage()
                     .then(() => safeLogger.log('[Background Tasks] Quota reset check completed successfully.'))
                     .catch(error => safeLogger.error('[Background Tasks] Error during quota reset check:', error));
             } else {
                 safeLogger.error('[Background Tasks] QuotaService instance not available for reset alarm.');
             }
        } catch (error) {
             safeLogger.error('[Background Tasks] Failed to get QuotaService instance for reset alarm:', error);
        }
    }
}

/**
 * Initializes listeners for Chrome lifecycle events (onStartup, onInstalled).
 */
export function initializeLifecycleEvents() {
    // onStartup: 扩展启动时执行 (浏览器启动或扩展被启用时)
    chrome.runtime.onStartup.addListener(async () => {
        console.log('[AetherFlow] onStartup event fired.');
        // 在启动时，如果用户已登录，尝试处理待处理队列
        if (await cloudStorageService.isAuthenticated()) {
            console.log('[AetherFlow] Startup: User authenticated, attempting to process pending operations...');
            cloudStorageService.processPendingOperations().catch(error => {
                console.error('[AetherFlow] Startup: Error processing pending operations:', error);
            });
            // Potentially trigger an initial incremental sync check here as well
        }
        // Ensure alarms are set on startup
        createPeriodicAlarms();
    });

    // onInstalled: 扩展首次安装、更新或Chrome更新时执行
    chrome.runtime.onInstalled.addListener(async (details) => {
        console.log(`[AetherFlow] onInstalled event fired. Reason: ${details.reason}`);
        
        if (details.reason === 'install') {
          console.log('[AetherFlow] First installation detected.');
          
          // 🚀 Analytics埋点：追踪扩展安装事件
          try {
            const { trackExtensionInstalled } = await import('@/services/analytics');
            const version = chrome.runtime.getManifest().version;
            trackExtensionInstalled(version);
            console.log('[Analytics] Extension installation tracked:', version);
          } catch (analyticsError) {
            console.error('[Analytics] Failed to track extension installation:', analyticsError);
          }
          
          // 安装后打开官网并跳转到"Core Features in Action"部分
          // 使用环境变量获取正确的网站URL
          const baseUrl = process.env.PAYMENT_PAGE_BASE_URL || 'https://aetherflow-app.com';
          const welcomeUrl = `${baseUrl}/index.html#demo-features`;
          
          chrome.tabs.create({ 
            url: welcomeUrl,
            active: true
          });
          console.log(`[AetherFlow] Opened official website with tutorial section: ${welcomeUrl}`);
        } else if (details.reason === 'update') {
          console.log(`[AetherFlow] Extension updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}.`);
          // 可以在这里执行版本更新后的迁移逻辑
        } else if (details.reason === 'chrome_update') {
          console.log('[AetherFlow] Chrome browser updated.');
        }

        // 确保 Alarm 在安装/更新后也设置好
        createPeriodicAlarms();

        // (可选) 首次安装/更新时，如果用户已登录，也处理一下待处理队列
        // 这可以处理在扩展更新期间可能累积的操作
        if (await cloudStorageService.isAuthenticated()) {
            console.log('[AetherFlow] Install/Update: User authenticated, attempting to process pending operations...');
            cloudStorageService.processPendingOperations().catch(error => {
                console.error('[AetherFlow] Install/Update: Error processing pending operations:', error);
            });
            // Potentially trigger an initial sync check
        }

        // // 检查用户是否已登录，如果已登录，则启动同步 (现在由onLoginSuccess处理，这里可能不需要了)
        // try {
        //   const user = await chromeStorageService.get<User | null>(STORAGE_KEYS.USER);
        //   if (user?.uid) {
        //     console.log('[AetherFlow] onInstalled: User logged in, triggering cloud sync...');
        //     cloudStorageService.syncAllPrompts();
        //   } else {
        //     console.log('[AetherFlow] onInstalled: No user logged in.');
        //   }
        // } catch (error) {
        //   console.error('[AetherFlow] onInstalled: Error checking user status or syncing:', error);
        // }
    });

    // --- 重要: 确保即使 Service Worker 在后台被唤醒，告警监听器也能被附加 --- 
    // 这通常意味着监听器应该在脚本的顶层或者一个始终会执行的早期初始化函数中添加
    // 将其移到 initializeLifecycleEvents 函数外部，确保每次脚本加载时都尝试附加监听器
    // chrome.alarms.onAlarm.addListener(handleAlarm);
    // safeLogger.log('[Background Tasks] Alarm listener attached globally.');

    console.log("[AetherFlow] 生命周期事件监听器已设置。");
}

/**
 * Creates or updates the periodic alarms needed by the extension.
 */
function createPeriodicAlarms() {
    console.log('[AetherFlow] Setting up periodic alarms...');
    
    // Alarm for processing the pending upload/delete queue (every 2 mins)
    chrome.alarms.get(PROCESS_PENDING_QUEUE_ALARM, (existingAlarm) => {
        if (!existingAlarm) {
            chrome.alarms.create(PROCESS_PENDING_QUEUE_ALARM, {
                delayInMinutes: 1, // Start after 1 minute
                periodInMinutes: 2  // Run every 2 minutes
            });
            console.log(`[AetherFlow] Created alarm: ${PROCESS_PENDING_QUEUE_ALARM} (every 2 mins)`);
        } else {
            console.log(`[AetherFlow] Alarm ${PROCESS_PENDING_QUEUE_ALARM} already exists.`);
            // Optional: Ensure the period is correct if logic changes
            if (existingAlarm.periodInMinutes !== 2) {
                chrome.alarms.create(PROCESS_PENDING_QUEUE_ALARM, { periodInMinutes: 2 });
                console.log(`[AetherFlow] Updated period for alarm: ${PROCESS_PENDING_QUEUE_ALARM}`);
            }
        }
    });

    // Alarm for periodic incremental downloads (every 10 mins)
    chrome.alarms.get(PERIODIC_INCREMENTAL_SYNC_ALARM, (existingAlarm) => {
        if (!existingAlarm) {
            chrome.alarms.create(PERIODIC_INCREMENTAL_SYNC_ALARM, {
                delayInMinutes: 5,  // Start after 5 minutes
                periodInMinutes: 10 // Run every 10 minutes
            });
            console.log(`[AetherFlow] Created alarm: ${PERIODIC_INCREMENTAL_SYNC_ALARM} (every 10 mins)`);
        } else {
             console.log(`[AetherFlow] Alarm ${PERIODIC_INCREMENTAL_SYNC_ALARM} already exists.`);
             // Optional: Ensure the period is correct
            if (existingAlarm.periodInMinutes !== 10) {
                chrome.alarms.create(PERIODIC_INCREMENTAL_SYNC_ALARM, { periodInMinutes: 10 });
                console.log(`[AetherFlow] Updated period for alarm: ${PERIODIC_INCREMENTAL_SYNC_ALARM}`);
            }
        }
    });

    // ... (Keep other existing alarms like RESET_OPTIMIZATION_ALARM_NAME if needed)
}

// --- 全局附加告警监听器 --- 
// 将监听器附加放在顶层，确保每次脚本启动时都会运行
chrome.alarms.onAlarm.addListener(handleAlarm);
safeLogger.log('[Background Tasks] Alarm listener attached globally.');
