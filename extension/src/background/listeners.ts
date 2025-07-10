// extension/src/background/listeners.ts

// --- Import dependencies from other modules ---
// Use path alias '@' to resolve potential Linter issue
import { openSidePanelForTab } from '@/background/sidepanelManager';
// Import necessary prompt handlers
import { 
  captureSelectionAsPrompt, 
  handleSavePromptCapture, 
  searchPrompts,
  handleSearchLocalPrompts
} from '@/background/promptHandler'; // Also use alias here for consistency
import { 
  handleLoginWithGoogle, 
  handleCheckAuthState, 
  handleLogout,
  handleLoginWithEmail,
  handleRegisterUser,
  handleDeleteAccount,
  handleUpdateProfile
} from '@/background/authHandler'; // 添加新的认证操作处理函数
import { markContentScriptReady } from '@/background/contentScriptManager'; // Use alias
import { handleOptimizeSelection, handleOptimizeModalContent } from '@/background/optimizationHandler'; // Add handleOptimizeModalContent
// Import the new AI feature handler
import { handleGenerateTitle } from '@/background/aiFeaturesHandler'; // Use alias
import { createErrorResponse } from '@/services/messaging'; // Use alias
import { Message } from '@/services/messaging/types'; // Use alias
import { FullQuotaInfo } from '@/services/membership/types'; // Use alias
import { CHECK_QUOTA, INCREMENT_USAGE } from '@/types/centralState'; // Import new message types
// Import getters for central services
import { getQuotaService, getCentralStateManager } from './index'; 
import { safeLogger } from '@/utils/safeEnvironment';
import { cloudStorageService } from '../services/storage/cloudStorage'; // Import cloudStorageService
import { generateInviteCode } from '@/utils/stringUtils';
// Remove unused imports if any after refactoring
// import { PromptFilter, CreatePromptInput } from '../services/prompt/types';
// import { storageService } from '../services/storage';

// --- Define message types (matching Hooks) ---
const GET_MEMBERSHIP_STATE = 'GET_MEMBERSHIP_STATE';
const MEMBERSHIP_STATE_RESPONSE = 'MEMBERSHIP_STATE_RESPONSE';
const GET_QUOTA_STATE = 'GET_QUOTA_STATE';
const QUOTA_STATE_RESPONSE = 'QUOTA_STATE_RESPONSE';
const TRIGGER_MEMBERSHIP_REFRESH = 'TRIGGER_MEMBERSHIP_REFRESH'; // If needed by refresh logic
// Add Auth state request types
const GET_AUTH_STATE = 'GET_AUTH_STATE';
const AUTH_STATE_RESPONSE = 'AUTH_STATE_RESPONSE';
// Add Invite Code request types
const GET_INVITE_CODE = 'GET_INVITE_CODE';
const INVITE_CODE_RESPONSE = 'INVITE_CODE_RESPONSE';

// Define alarm names (import or define consistently with initialization.ts)
const PROCESS_PENDING_QUEUE_ALARM = 'processPendingQueueAlarm';
const PERIODIC_INCREMENTAL_SYNC_ALARM = 'periodicIncrementalSyncAlarm'; // Added new alarm name
const RESET_OPTIMIZATION_ALARM_NAME = 'resetDailyOptimization'; // Keep existing alarm name if used

// --- Removed Placeholder Handler Functions ---
// handleSavePromptCapture was removed
// handleGenerateTitle REMOVED
// handleLegacySearchPrompts was removed

// Handle prompt update broadcast
function handlePromptUpdatedBroadcast() {
    console.log('[Listeners] Broadcasting PROMPT_UPDATED to all tabs.');
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'PROMPT_UPDATED', from: 'background' })
                    .catch(error => console.debug(`[Listeners] Failed to send PROMPT_UPDATED to tab ${tab.id}:`, error.message));
            }
        });
    });
}

// Handle HEARTBEAT
function handleHeartbeat(payload: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    // Respond immediately to keep alive
    sendResponse({ alive: true, count: payload?.count });
}

// 添加任务检测相关的导入
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection,
  getDocs,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { FeatureType } from '@/services/featureUsage/types';
import { TaskType } from '@/types/rewards';

/**
 * 任务缓存系统 - 减少Firestore读取
 */
class TaskCache {
    private cache = new Map<string, Set<TaskType>>();
    private lastCacheUpdate = new Map<string, number>();
    private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟缓存过期

    /**
     * 检查任务是否已完成（从缓存）
     */
    isTaskCompleted(userId: string, taskType: TaskType): boolean {
        const userTasks = this.cache.get(userId);
        if (!userTasks) {
            return false; // 缓存中没有，需要查询
        }
        
        // 检查缓存是否过期
        const lastUpdate = this.lastCacheUpdate.get(userId) || 0;
        if (Date.now() - lastUpdate > this.CACHE_EXPIRY_MS) {
            this.invalidateUser(userId);
            return false; // 缓存过期，需要重新查询
        }
        
        return userTasks.has(taskType);
    }

    /**
     * 标记任务为已完成
     */
    markTaskCompleted(userId: string, taskType: TaskType): void {
        if (!this.cache.has(userId)) {
            this.cache.set(userId, new Set());
        }
        
        const userTasks = this.cache.get(userId)!;
        userTasks.add(taskType);
        this.lastCacheUpdate.set(userId, Date.now());
        
        console.log(`[REWARDS_FLOW] Step 3b: Updated task cache for user ${userId}, task ${taskType} completed`);
    }

    /**
     * 使用户缓存失效
     */
    invalidateUser(userId: string): void {
        this.cache.delete(userId);
        this.lastCacheUpdate.delete(userId);
        console.log(`[TaskCache] Cache invalidated for user: ${userId}`);
    }

    /**
     * 清理所有缓存（用于用户登出等情况）
     */
    clearAll(): void {
        this.cache.clear();
        this.lastCacheUpdate.clear();
        console.log(`[TaskCache] All cache cleared`);
    }

    /**
     * 获取缓存统计信息（用于调试）
     */
    getCacheStats(): { totalUsers: number, totalTasks: number } {
        let totalTasks = 0;
        for (const tasks of this.cache.values()) {
            totalTasks += tasks.size;
        }
        return {
            totalUsers: this.cache.size,
            totalTasks
        };
    }

    /**
     * 检查用户是否有任何已完成的任务缓存
     */
    hasUserCache(userId: string): boolean {
        return this.cache.has(userId);
    }
}

// 全局任务缓存实例
const taskCache = new TaskCache();

/**
 * 导出缓存管理功能供其他模块使用
 */
export const TaskCacheManager = {
    /**
     * 用户登出时清理该用户的缓存
     */
    onUserLogout: (userId: string) => {
        taskCache.invalidateUser(userId);
    },
    
    /**
     * 清理所有缓存
     */
    clearAll: () => {
        taskCache.clearAll();
    },
    
    /**
     * 获取缓存统计信息
     */
    getStats: () => {
        return taskCache.getCacheStats();
    }
};

/**
 * 任务与功能的映射关系
 */
const FEATURE_TASK_MAPPING: Partial<Record<FeatureType, TaskType[]>> = {
    [FeatureType.PROMPT_CREATE]: [TaskType.FIRST_PROMPT, TaskType.ACTIVE_USER],
    [FeatureType.PROMPT_CAPTURE]: [TaskType.WEB_SAVE, TaskType.ACTIVE_USER],
    [FeatureType.PROMPT_OPTIMIZE]: [TaskType.WEB_OPTIMIZE],
    [FeatureType.PROMPT_SHORTCUT_INSERT]: [TaskType.USE_SHORTCUT]
    // 其他 FeatureType 暂不映射任务
};

/**
 * 处理任务检测逻辑 - 优化版本
 */
export async function handleTaskDetection(featureType: FeatureType, metadata: any = {}) {
    console.log(`[REWARDS_FLOW] Step 3: Starting task detection for ${featureType}`);
    try {
        // 获取当前用户状态
        const authState = getCentralStateManager().getAuthState();
        if (!authState.isAuthenticated || !authState.user) {
            // 未认证用户不处理任务
            console.log(`[REWARDS_FLOW] Step 3: User not authenticated, skipping task detection`);
            return;
        }

        const userId = authState.user.uid;
        console.log(`[REWARDS_FLOW] Step 3: Processing for authenticated user: ${userId}`);
        const db = getFirestore();
        
        safeLogger.log('[TaskDetection] Processing feature usage:', featureType, metadata);

        // 获取该功能相关的任务列表
        const relevantTasks: TaskType[] = FEATURE_TASK_MAPPING[featureType] || [];
        
        // 性能监控：记录原有逻辑需要检查的任务数
        console.log(`[PERFORMANCE] Feature ${featureType} - Total relevant tasks: ${relevantTasks.length}`);
        
        // 根据功能类型和 metadata 过滤实际需要检查的任务
        const filteredTasks: TaskType[] = relevantTasks.filter((taskType: TaskType) => {
            // 特殊条件检查
            if (taskType === TaskType.WEB_SAVE && !(metadata.sourceUrl || metadata.isToolbar)) {
                return false; // WEB_SAVE 任务需要 sourceUrl 或 isToolbar
            }
            if (taskType === TaskType.WEB_OPTIMIZE && !metadata.isToolbar) {
                return false; // WEB_OPTIMIZE 任务需要 isToolbar
            }
            return true;
        });
        
        // 检查是否有任务需要检测（排除已完成的）
        const tasksToCheck: TaskType[] = filteredTasks.filter((taskType: TaskType) => {
            const isCompleted = taskCache.isTaskCompleted(userId, taskType);
            if (isCompleted) {
                console.log(`[REWARDS_FLOW] Step 3: Task ${taskType} already completed (cached), skipping`);
            }
            return !isCompleted;
        });

        // 性能监控：显示优化效果
        const tasksSkippedByCache = filteredTasks.length - tasksToCheck.length;
        console.log(`[PERFORMANCE] Feature ${featureType} - Tasks after filtering: ${filteredTasks.length}, Tasks skipped by cache: ${tasksSkippedByCache}, Tasks to check: ${tasksToCheck.length}`);
        
        if (tasksSkippedByCache > 0) {
            console.log(`[PERFORMANCE] 🎯 OPTIMIZATION: Avoided ${tasksSkippedByCache} unnecessary Firestore reads!`);
        }

        if (tasksToCheck.length === 0) {
            console.log(`[REWARDS_FLOW] Step 3b: All relevant tasks completed for ${featureType}, skipping all checks`);
            // 显示缓存统计
            const cacheStats = taskCache.getCacheStats();
            console.log(`[PERFORMANCE] Cache stats - Users: ${cacheStats.totalUsers}, Total cached tasks: ${cacheStats.totalTasks}`);
            return; // 所有相关任务都已完成，跳过检测
        }

        console.log(`[REWARDS_FLOW] Step 3: Checking ${tasksToCheck.length} of ${relevantTasks.length} tasks for ${featureType}`);

        // 只检测未完成的任务
        for (const taskType of tasksToCheck) {
            await executeTaskDetection(taskType, db, userId, metadata);
        }

    } catch (error) {
        safeLogger.error('[TaskDetection] Error processing task detection:', error);
    }
}

/**
 * 执行单个任务的检测逻辑
 */
async function executeTaskDetection(taskType: TaskType, db: any, userId: string, metadata: any) {
    switch (taskType) {
        case TaskType.FIRST_PROMPT:
            await handleFirstPromptTaskOptimized(db, userId);
            break;
        case TaskType.ACTIVE_USER:
            await handleActiveUserTaskOptimized(db, userId);
            break;
        case TaskType.WEB_SAVE:
            await handleWebSaveTaskOptimized(db, userId);
            break;
        case TaskType.WEB_OPTIMIZE:
            await handleWebOptimizeTaskOptimized(db, userId);
            break;
        case TaskType.USE_SHORTCUT:
            await handleShortcutTaskOptimized(db, userId);
            break;
        default:
            console.warn(`[TaskDetection] Unknown task type: ${taskType}`);
            break;
    }
}

/**
 * 处理首次创建提示词任务 - 优化版本
 */
async function handleFirstPromptTaskOptimized(db: any, userId: string) {
    console.log(`[REWARDS_FLOW] Step 4a: Checking first prompt task for user ${userId}`);
    try {
        // 检查任务是否已完成
        const taskRef = doc(db, 'users', userId, 'rewards_tasks', TaskType.FIRST_PROMPT);
        const taskDoc = await getDoc(taskRef);
        
        console.log(`[REWARDS_FLOW] Step 4a: Task doc exists: ${taskDoc.exists()}, completed: ${taskDoc.exists() ? taskDoc.data()?.completed : 'N/A'}`);
        
        if (taskDoc.exists() && taskDoc.data().completed) {
            console.log(`[REWARDS_FLOW] Step 4a: First prompt task already completed for user ${userId}`);
            // 同步缓存（数据库中已完成但缓存中没有）
            taskCache.markTaskCompleted(userId, TaskType.FIRST_PROMPT);
            return; // 任务已完成
        }

        // 检查用户提示词总数
        const promptsRef = collection(db, 'users', userId, 'prompts');
        const promptsSnapshot = await getDocs(promptsRef);
        const promptCount = promptsSnapshot.size;
        
        console.log(`[REWARDS_FLOW] Step 4a: User ${userId} has ${promptCount} prompts`);

        if (promptCount >= 1) {
            console.log(`[REWARDS_FLOW] Step 4a: Writing first prompt task completion for user ${userId}`);
            
            // 完成首次创建任务
            await setDoc(taskRef, {
                taskId: TaskType.FIRST_PROMPT,
                completed: true,
                progress: 1,
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                metadata: {
                    promptCount,
                    detectedBy: 'feature_usage_service'
                }
            }, { merge: true });
            
            // 更新缓存
            taskCache.markTaskCompleted(userId, TaskType.FIRST_PROMPT);
            
            console.log(`[REWARDS_FLOW] Step 4a: First prompt task COMPLETED and written to Firestore for user ${userId}`);
            safeLogger.log('[TaskDetection] First prompt task completed for user:', userId);
        } else {
            console.log(`[REWARDS_FLOW] Step 4a: First prompt task NOT completed (${promptCount} < 1) for user ${userId}`);
        }
    } catch (error) {
        console.error(`[REWARDS_FLOW] Step 4a: ERROR handling first prompt task for user ${userId}`, error);
        safeLogger.error('[TaskDetection] Error handling first prompt task:', error);
    }
}

/**
 * 处理活跃用户任务（5个提示词）- 优化版本
 */
async function handleActiveUserTaskOptimized(db: any, userId: string) {
    try {
        // 检查任务是否已完成
        const taskRef = doc(db, 'users', userId, 'rewards_tasks', TaskType.ACTIVE_USER);
        const taskDoc = await getDoc(taskRef);
        
        if (taskDoc.exists() && taskDoc.data().completed) {
            // 同步缓存
            taskCache.markTaskCompleted(userId, TaskType.ACTIVE_USER);
            return; // 任务已完成
        }

        // 检查用户提示词总数
        const promptsRef = collection(db, 'users', userId, 'prompts');
        const promptsSnapshot = await getDocs(promptsRef);
        const promptCount = promptsSnapshot.size;

        const progress = Math.min(promptCount, 5);
        const completed = promptCount >= 5;

        // 更新任务进度
        await setDoc(taskRef, {
            taskId: TaskType.ACTIVE_USER,
            completed,
            progress,
            completedAt: completed ? serverTimestamp() : null,
            updatedAt: serverTimestamp(),
            metadata: {
                promptCount,
                detectedBy: 'feature_usage_service'
            }
        }, { merge: true });
        
        if (completed) {
            // 更新缓存
            taskCache.markTaskCompleted(userId, TaskType.ACTIVE_USER);
            console.log(`[REWARDS_FLOW] Step 3b: Updated task cache for user ${userId}, all core tasks completed: ${taskCache.isTaskCompleted(userId, TaskType.FIRST_PROMPT) && taskCache.isTaskCompleted(userId, TaskType.ACTIVE_USER)}`);
            safeLogger.log('[TaskDetection] Active user task completed for user:', userId);
        } else {
            safeLogger.log('[TaskDetection] Active user task progress updated:', progress, '/', 5);
        }
    } catch (error) {
        safeLogger.error('[TaskDetection] Error handling active user task:', error);
    }
}

/**
 * 处理网页保存任务 - 优化版本
 */
async function handleWebSaveTaskOptimized(db: any, userId: string) {
    try {
        const taskRef = doc(db, 'users', userId, 'rewards_tasks', TaskType.WEB_SAVE);
        const taskDoc = await getDoc(taskRef);
        
        if (taskDoc.exists() && taskDoc.data().completed) {
            // 同步缓存
            taskCache.markTaskCompleted(userId, TaskType.WEB_SAVE);
            return; // 任务已完成
        }

        // 完成网页保存任务
        await setDoc(taskRef, {
            taskId: TaskType.WEB_SAVE,
            completed: true,
            progress: 1,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            metadata: {
                detectedBy: 'feature_usage_service'
            }
        }, { merge: true });
        
        // 更新缓存
        taskCache.markTaskCompleted(userId, TaskType.WEB_SAVE);
        
        safeLogger.log('[TaskDetection] Web save task completed for user:', userId);
    } catch (error) {
        safeLogger.error('[TaskDetection] Error handling web save task:', error);
    }
}

/**
 * 处理网页优化任务 - 优化版本
 */
async function handleWebOptimizeTaskOptimized(db: any, userId: string) {
    try {
        const taskRef = doc(db, 'users', userId, 'rewards_tasks', TaskType.WEB_OPTIMIZE);
        const taskDoc = await getDoc(taskRef);
        
        if (taskDoc.exists() && taskDoc.data().completed) {
            // 同步缓存
            taskCache.markTaskCompleted(userId, TaskType.WEB_OPTIMIZE);
            return; // 任务已完成
        }

        // 完成网页优化任务
        await setDoc(taskRef, {
            taskId: TaskType.WEB_OPTIMIZE,
            completed: true,
            progress: 1,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            metadata: {
                detectedBy: 'feature_usage_service'
            }
        }, { merge: true });
        
        // 更新缓存
        taskCache.markTaskCompleted(userId, TaskType.WEB_OPTIMIZE);
        
        safeLogger.log('[TaskDetection] Web optimize task completed for user:', userId);
    } catch (error) {
        safeLogger.error('[TaskDetection] Error handling web optimize task:', error);
    }
}

/**
 * 处理快捷输入任务 - 优化版本
 */
async function handleShortcutTaskOptimized(db: any, userId: string) {
    try {
        const taskRef = doc(db, 'users', userId, 'rewards_tasks', TaskType.USE_SHORTCUT);
        const taskDoc = await getDoc(taskRef);
        
        if (taskDoc.exists() && taskDoc.data().completed) {
            // 同步缓存
            taskCache.markTaskCompleted(userId, TaskType.USE_SHORTCUT);
            return; // 任务已完成
        }

        // 完成快捷输入任务
        await setDoc(taskRef, {
            taskId: TaskType.USE_SHORTCUT,
            completed: true,
            progress: 1,
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            metadata: {
                detectedBy: 'feature_usage_service'
            }
        }, { merge: true });
        
        // 更新缓存
        taskCache.markTaskCompleted(userId, TaskType.USE_SHORTCUT);
        
        safeLogger.log('[TaskDetection] Shortcut task completed for user:', userId);
    } catch (error) {
        safeLogger.error('[TaskDetection] Error handling shortcut task:', error);
    }
}

/**
 * 处理获取邀请码请求 - 容错设计
 * 首次生成时：生成码 → 立即响应 → 异步保存到Firestore
 * 已存在时：直接从Firestore返回
 */
async function handleGetInviteCode(userId: string, sendResponse: (response: any) => void) {
    try {
        const db = getFirestore();
        const userDocRef = doc(db, 'users', userId);
        
        // 检查用户文档中是否已有邀请码
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().inviteCode) {
            // 已有邀请码，直接返回
            const existingCode = userDoc.data().inviteCode;
            safeLogger.log(`[handleGetInviteCode] Found existing invite code for user ${userId}: ${existingCode}`);
            sendResponse({ 
                type: INVITE_CODE_RESPONSE, 
                payload: { inviteCode: existingCode } 
            });
            return;
        }

        // 生成新的邀请码
        const newInviteCode = generateInviteCode();
        safeLogger.log(`[handleGetInviteCode] Generated new invite code for user ${userId}: ${newInviteCode}`);
        
        // 立即响应前端，然后异步保存
        sendResponse({ 
            type: INVITE_CODE_RESPONSE, 
            payload: { inviteCode: newInviteCode } 
        });

        // 异步保存到Firestore（不阻塞响应）
        setDoc(userDocRef, { inviteCode: newInviteCode }, { merge: true })
            .then(() => {
                safeLogger.log(`[handleGetInviteCode] Invite code saved to Firestore for user ${userId}`);
            })
            .catch((error) => {
                safeLogger.error(`[handleGetInviteCode] Failed to save invite code for user ${userId}:`, error);
                // 注意：此时前端已经收到响应，这里的错误不影响用户体验
                // 可以考虑添加重试逻辑或本地缓存机制
            });

    } catch (error) {
        safeLogger.error(`[handleGetInviteCode] Error handling invite code request for user ${userId}:`, error);
        sendResponse({ 
            type: INVITE_CODE_RESPONSE, 
            payload: null, 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
}

// --- Unified Message Listener ---

export function initializeMessageListeners() {
  // 检查是否在 Service Worker 上下文中
  // Service Worker 没有 'window' 对象，而侧边栏等窗口环境有。
  if (typeof window !== 'undefined') {
    console.warn(`[Listeners] initializeMessageListeners called in a window-like context (e.g., sidepanel, content script). Aborting initialization for this context to prevent duplicate listeners.`);
    return; // 阻止在非背景脚本上下文中初始化
  }

    // safeLogger.log('[Listeners] Initializing runtime.onMessage listener.'); // Can add if needed
    chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
        // --- Log ALL incoming messages before filtering ---
        // Log the raw message object to see everything
        safeLogger.log('[Listeners] Raw message received:', JSON.stringify(message || {})); 

        let isAsync = false; // Flag to indicate if sendResponse will be called asynchronously
        
        // --- Explicitly ignore CentralStateManager PUSH messages in this generic listener ---
        // Hooks will listen for these directly.
        if (message.type === 'CENTRAL_AUTH_STATE_UPDATED' || 
            message.type === 'CENTRAL_MEMBERSHIP_STATE_UPDATED' ||
            message.type === 'QUOTA_STATE_UPDATED') {
            // console.debug('[Listeners] Ignoring PUSH message type meant for Hooks:', message.type);
            return false; // Allow other listeners (like UI hooks) to handle this
        }
        
        // --- Log messages handled by this listener ---
        console.log('[Listeners] Processing message:', message.type); // Changed from 'Received message'
        
        try {
            switch (message.type) {

                // --- NEW: Handle Initial State Requests --- 
                case GET_MEMBERSHIP_STATE:
                    safeLogger.log('[Listeners] Received GET_MEMBERSHIP_STATE request.');
                    try {
                        const state = getCentralStateManager().getMembershipState();
                        safeLogger.log('[Listeners] Responding with current MembershipState:', state);
                        sendResponse({ type: MEMBERSHIP_STATE_RESPONSE, payload: state });
                    } catch (error: any) {
                         safeLogger.error('[Listeners] Error getting MembershipState:', error);
                         sendResponse({ type: MEMBERSHIP_STATE_RESPONSE, payload: null, error: error.message });
                    }
                    // No need for isAsync=true as sendResponse is called synchronously here.
                    break; // Important: break here!

                case GET_QUOTA_STATE:
                    safeLogger.log('[Listeners] Received GET_QUOTA_STATE request.');
                    try {
                        const fullQuotaInfo = getQuotaService().getFullQuotaInfo();
                        safeLogger.log('[Listeners] Responding with current FullQuotaInfo:', fullQuotaInfo);
                        sendResponse({ type: QUOTA_STATE_RESPONSE, payload: fullQuotaInfo });
                    } catch (error: any) {
                        safeLogger.error('[Listeners] Error getting FullQuotaInfo:', error);
                        sendResponse({ type: QUOTA_STATE_RESPONSE, payload: null, error: error.message });
                    }
                     // No need for isAsync=true as sendResponse is called synchronously here.
                    break; // Important: break here!
                
                // --- ADDED: Handle Auth State Request ---
                case GET_AUTH_STATE:
                    safeLogger.log('[Listeners] Received GET_AUTH_STATE request.');
                    try {
                        const state = getCentralStateManager().getAuthState(); // Get current auth state
                        safeLogger.log('[Listeners] Responding with current AuthState:', state);
                        sendResponse({ type: AUTH_STATE_RESPONSE, payload: state });
                    } catch (error: any) {
                        safeLogger.error('[Listeners] Error getting AuthState:', error);
                        // Send back null state on error
                        sendResponse({ type: AUTH_STATE_RESPONSE, payload: { isAuthenticated: false, userId: null, user: null, token: null, isReady: false }, error: error.message }); 
                    }
                    // No need for isAsync=true as getAuthState is synchronous.
                    break; // Important: break here!

                // --- ADDED: Handle Invite Code Request ---
                case GET_INVITE_CODE:
                    safeLogger.log('[Listeners] Received GET_INVITE_CODE request.');
                    try {
                        const authState = getCentralStateManager().getAuthState();
                        if (!authState.isAuthenticated || !authState.user) {
                            sendResponse({ type: INVITE_CODE_RESPONSE, payload: null, error: 'User not authenticated' });
                            break;
                        }
                        
                        handleGetInviteCode(authState.user.uid, sendResponse);
                        isAsync = true; // Firestore operations are async
                    } catch (error: any) {
                        safeLogger.error('[Listeners] Error getting invite code:', error);
                        sendResponse({ type: INVITE_CODE_RESPONSE, payload: null, error: error.message });
                    }
                    break;

                // --- Handle Refresh Trigger (Optional, based on Hook's refresh impl) ---
                case TRIGGER_MEMBERSHIP_REFRESH:
                    safeLogger.log('[Listeners] Received TRIGGER_MEMBERSHIP_REFRESH request.');
                    // This is just an example. The actual refresh logic might involve:
                    // 1. Re-checking auth token validity.
                    // 2. Forcing a re-fetch from Firestore (though onSnapshot should handle most cases).
                    // 3. Re-calculating quota based on potentially updated membership.
                    // Depending on the action, it might be async.
                    try {
                        // Example: Maybe trigger a re-check within CentralStateManager if implemented
                        // await getCentralStateManager().verifyCurrentState(); 
                        // Example: Or trigger quota re-calculation
                        // getQuotaService().recalculateBasedOnCurrentMembership();
                        
                        // For now, just acknowledge. Actual implementation depends on services.
                        safeLogger.warn('[Listeners] TRIGGER_MEMBERSHIP_REFRESH handler needs implementation based on desired refresh logic.');
                        sendResponse({ success: true, message: 'Refresh trigger acknowledged.' });
                    } catch (error: any) {
                         safeLogger.error('[Listeners] Error handling TRIGGER_MEMBERSHIP_REFRESH:', error);
                         sendResponse({ success: false, error: error.message });
                    }
                    // isAsync = true; // Set to true if refresh logic involves async operations.
                    break; 

                // --- Existing Handlers ... ---
                case 'OPEN_SIDEBAR':
                    if (sender.tab) {
                        const promptLogin = message.payload?.promptLogin === true; // Get promptLogin flag
                        // Use the imported function from sidepanelManager
                        openSidePanelForTab(sender.tab, promptLogin).then(() => { // Pass promptLogin
                            sendResponse({ success: true, message: 'Sidebar opened or focused.' });
                        }).catch((error: Error) => {
                            console.error('[Listeners] Error handling OPEN_SIDEBAR:', error);
                            sendResponse({ success: false, error: error.message });
                        });
                        isAsync = true;
                    } else {
                         console.error('[Listeners] OPEN_SIDEBAR request missing sender tab info.');
                         sendResponse({ success: false, error: 'Sender tab information missing.' });
                    }
                    break;

                case 'SAVE_PROMPT_CAPTURE':
                    // Call the imported handler
                    handleSavePromptCapture(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;

                case 'GENERATE_TITLE':
                    // Call the imported handler from aiFeaturesHandler
                    handleGenerateTitle(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;

                 case 'OPTIMIZE_SELECTION':
                     // Now calls the imported function from optimizationHandler
                     handleOptimizeSelection(message.payload, sender, sendResponse);
                     isAsync = true; // API call is async
                     break;

                case 'OPTIMIZE_MODAL_CONTENT':
                    // Call the new handler from optimizationHandler
                    handleOptimizeModalContent(message.payload, sender, sendResponse);
                    isAsync = true; // API call is async
                    break;

                // --- Message previously in second onMessage listener ---
                case 'PROMPT_UPDATED':
                    // This message might originate from background itself OR other parts.
                    // If it's just for broadcasting, maybe handle it differently?
                    // For now, assume it means "broadcast this update".
                    handlePromptUpdatedBroadcast();
                    sendResponse({ success: true }); // Acknowledge receipt
                    isAsync = true; // Broadcasting involves async tab queries/sends
                    break;

                // --- Message previously in keepAlive's onMessage listener ---
                case 'HEARTBEAT':
                    handleHeartbeat(message.payload, sender, sendResponse);
                    // sendResponse is called synchronously inside handleHeartbeat
                    break; // Not async

                // --- Messages previously in addMessageListener ---
                case 'CONTENT_SCRIPT_READY':
                    if (sender.tab?.id) {
                        markContentScriptReady(sender.tab.id, message.data?.url); // Call imported function
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Missing sender tab ID'});
                    }
                     // Technically sync, but let's return true just in case markContentScriptReady becomes async
                     isAsync = true;
                    break;

                // --- Authentication ---
                case 'LOGIN_WITH_EMAIL':
                    handleLoginWithEmail(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;
                case 'REGISTER_USER':
                    handleRegisterUser(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;
                case 'DELETE_ACCOUNT':
                    handleDeleteAccount(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;
                case 'UPDATE_PROFILE':
                    handleUpdateProfile(message.payload, sender, sendResponse);
                    isAsync = true;
                    break;
                case 'CHECK_AUTH_STATE':
                    // Call the synchronous handler
                    handleCheckAuthState(message.payload, sender, sendResponse);
                    // isAsync remains false
                    break;
                case 'LOGIN_WITH_GOOGLE':
                    handleLoginWithGoogle(message.payload, sender, sendResponse);
                    isAsync = true; // Google login involves async chrome.identity
                    break;
                case 'LOGOUT':
                    // Add log here
                    console.log('[Listeners] LOGOUT message received, calling handleLogout...'); 
                    // Call the asynchronous handler
                    handleLogout(message.payload, sender, sendResponse);
                    isAsync = true; 
                    break;

                 case 'LEGACY_SEARCH_PROMPTS':
                     // Call the imported handler. Assumes payload { keyword, limit } is compatible
                     // with the PromptFilter expected by searchPrompts.
                     searchPrompts(message.payload, sender, sendResponse);
                     isAsync = true;
                     break;

                 case 'ADD_CONTEXT_MENU_ITEM':
                     // Original logic was just sendResponse({ success: true });
                     sendResponse({ success: true });
                     // Not async
                     break;

                 case 'CAPTURE_SELECTION_AS_PROMPT':
                     const content = message.data?.content || '';
                     if (!content) {
                         sendResponse({ success: false, error: '选中内容为空' });
                     } else {
                         // 构建源上下文信息
                         const sourceContext = {
                             sourceUrl: sender.tab?.url,
                             isToolbar: message.data?.isToolbar || false,
                             source: message.data?.source || 'web_capture'
                         };
                         
                         // Call the imported handler with source context
                         captureSelectionAsPrompt(content, sourceContext)
                             .then(success => sendResponse({ success })) // Simplified response sending
                             .catch(error => {
                                 console.error('[Listeners] Error handling CAPTURE_SELECTION_AS_PROMPT:', error);
                                 sendResponse({ success: false, error: String(error) });
                             });
                         isAsync = true;
                     }
                     break;

                // --- Quota Handling --- 
                case CHECK_QUOTA:
                    const featureToCheck = message.payload?.feature; // Expect { feature: 'storage' | 'optimization' }
                    if (!featureToCheck || (featureToCheck !== 'storage' && featureToCheck !== 'optimization')) {
                        sendResponse({ allowed: false, error: 'Invalid feature specified for quota check.'});
                    } else {
                        isAsync = true; // Indicate async response
                        getQuotaService().canUseFeature(featureToCheck)
                            .then(allowed => {
                                sendResponse({ allowed: allowed });
                            })
                            .catch(error => {
                                safeLogger.error(`[Listeners] Error checking quota for feature ${featureToCheck}:`, error);
                                // Send back disallowed on error for safety
                                sendResponse({ allowed: false, error: 'Error checking quota.' }); 
                            });
                    }
                    break;
                
                case INCREMENT_USAGE:
                     const featureToIncrement = message.payload?.feature; // Expect { feature: 'storage' | 'optimization' }
                     if (!featureToIncrement || (featureToIncrement !== 'storage' && featureToIncrement !== 'optimization')) {
                         // Log error but maybe don't send back error response, just ignore?
                         safeLogger.error('[Listeners] Invalid feature specified for increment usage:', featureToIncrement);
                         // Optionally sendResponse({ success: false, error: 'Invalid feature' });
                     } else {
                         isAsync = true; // Increment is async (writes to DB)
                         getQuotaService().incrementUsage(featureToIncrement)
                             .then(() => {
                                 // We might not need to send a response back for increment
                                 // Or just send a simple success ack
                                 sendResponse({ success: true }); 
                             })
                             .catch(error => {
                                 safeLogger.error(`[Listeners] Error incrementing usage for feature ${featureToIncrement}:`, error);
                                 // Optionally send back error
                                 // sendResponse({ success: false, error: 'Error incrementing usage.' });
                             });
                     }
                     break;

                // 增加对'SEARCH_LOCAL_PROMPTS'消息类型的处理
                case 'SEARCH_LOCAL_PROMPTS':
                    console.log("收到提示词搜索请求:", message.payload?.query);
                    // 调用promptHandler中的函数处理搜索请求
                    handleSearchLocalPrompts(message.payload, sender, sendResponse);
                    return true; // 保持消息通道开放以进行异步响应

                // --- 功能使用日志处理 (开发版本) ---
                case 'FEATURE_USAGE_LOG' as any:
                    try {
                        const payload = message.payload || {};
                        const { timestamp, featureType, metadata } = payload;
                        console.log(`[REWARDS_FLOW] Step 2: SW received FEATURE_USAGE_LOG for ${featureType}`);
                        console.log(`[SW][FeatureUsage] ${timestamp} - ${featureType}:`, JSON.stringify(metadata));
                        
                        // 处理任务检测逻辑（异步处理，不阻塞响应）
                        handleTaskDetection(featureType, metadata).catch(error => {
                            safeLogger.error('[SW][FeatureUsage] Task detection failed:', error);
                            console.error(`[REWARDS_FLOW] Step 3: Task detection FAILED for ${featureType}`, error);
                        });
                        
                        sendResponse({ success: true });
                    } catch (error: any) {
                        console.error('[SW][FeatureUsage] Log处理失败:', error);
                        console.error(`[REWARDS_FLOW] Step 2: SW processing FAILED`, error);
                        sendResponse({ success: false, error: error.message });
                    }
                    // 同步响应，任务检测在后台异步运行
                    break;

                default:
                    console.warn(`[Listeners] Unhandled message type: ${message.type}`);
                    // Indicate that we are not handling this message and won't call sendResponse
                    return false; // Explicitly return false for unhandled types
            }
        } catch (error: any) {
             console.error(`[Listeners] Error processing message type ${message.type}:`, error);
             try {
                 // Try to send an error response if possible
                 sendResponse(createErrorResponse(error));
                 // If sendResponse worked, we should indicate async handling
                 // isAsync = true; // <-- This might be wrong, sendResponse is sync here
             } catch (responseError) {
                 console.error(`[Listeners] Failed to send error response:`, responseError);
             }
             // If an error happened during processing, but we couldn't send an error response,
             // it's likely best to return false and let Chrome report the error.
             return false;
        }

        // Return true if sendResponse will be called asynchronously, otherwise let Chrome handle it (implicitly false).
        // If sendResponse was called synchronously within the switch, we should NOT return true.
        // Based on the new handlers for GET states, isAsync remains false for them.
        return isAsync;
    });

    // Listener for chrome.alarms
    chrome.alarms.onAlarm.addListener(handleAlarm);

    console.log('[AetherFlow] Unified message listener initialized (conditionally in Service Worker).');
}

/**
 * Handles incoming alarms.
 * @param alarm The alarm that fired.
 */
function handleAlarm(alarm: chrome.alarms.Alarm) {
    safeLogger.log(`[Background Tasks] Alarm received: ${alarm.name}`);

    if (alarm.name === RESET_OPTIMIZATION_ALARM_NAME) {
        safeLogger.log('[Background Tasks] Handling daily optimization reset alarm.');
        // Call function to reset optimization quota
        // resetDailyOptimizationCount(); 
        // Placeholder - implement the actual reset logic
    } else if (alarm.name === PROCESS_PENDING_QUEUE_ALARM) {
        safeLogger.log(`[Background Tasks] Handling alarm: ${PROCESS_PENDING_QUEUE_ALARM}. Triggering pending queue processing.`);
        cloudStorageService.processPendingOperations().catch(error => {
            safeLogger.error(`[Background Tasks] Error processing pending queue via alarm ${alarm.name}:`, error);
        });
    } else if (alarm.name === PERIODIC_INCREMENTAL_SYNC_ALARM) { // Added handler for new alarm
        safeLogger.log(`[Background Tasks] Handling alarm: ${PERIODIC_INCREMENTAL_SYNC_ALARM}. Triggering incremental download check.`);
        cloudStorageService.syncIncrementalDownloads().catch(error => {
            safeLogger.error(`[Background Tasks] Error during incremental download sync via alarm ${alarm.name}:`, error);
        });
    }
    // Add more else if blocks for other alarms as needed
    else {
        safeLogger.warn(`[Background Tasks] Received unknown alarm: ${alarm.name}`);
    }
}