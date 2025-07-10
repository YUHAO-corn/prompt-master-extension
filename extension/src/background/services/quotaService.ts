// extension/src/background/services/quotaService.ts
import { CentralStateManager } from './centralStateManager'; // 假设在同一目录下
import { MembershipState, QUOTA_STATE_UPDATED, QuotaUsage } from '@/types/centralState'; // QUOTA_STATE_UPDATED 需要后续添加
import { safeLogger } from '@/utils/safeEnvironment';
// 明确导入实际的 MembershipQuota 类型
import { MembershipQuota, FullQuotaInfo } from '@/services/membership/types';
import { getFirestore, doc, getDoc, setDoc, Timestamp, Firestore, SetOptions, collection, getDocs, query, where } from 'firebase/firestore'; // Import Firestore methods
import { getFirebaseAuth } from '@/services/auth/firebase'; // Assuming firebase auth instance getter exists
import { Auth } from 'firebase/auth';

// 定义默认配额常量
const DEFAULT_FREE_QUOTA: MembershipQuota = {
    maxPrompts: 5,
    dailyOptimizations: 3,
    canExport: false,
    hasPrioritySupport: false,
};

const DEFAULT_PRO_QUOTA: MembershipQuota = {
    maxPrompts: 100,
    dailyOptimizations: 50,
    canExport: true,
    hasPrioritySupport: true,
};

// 默认用量
const DEFAULT_USAGE: QuotaUsage = {
    dailyOptimizationCount: 0,
    lastOptimizationReset: null,
    storedPromptsCount: 0,
};

export class QuotaService {
    private centralStateManager: CentralStateManager;
    private db: Firestore;
    private auth: Auth;
    private currentUserId: string | null = null;
    private currentQuota: MembershipQuota = DEFAULT_FREE_QUOTA; // 初始默认为免费配额
    private currentUsage: QuotaUsage | null = null; // Cache for usage data
    private usageLoading: boolean = false;
    private unsubscribeMembership: (() => void) | null = null;
    private unsubscribeAuth: (() => void) | null = null; // To track user changes

    constructor(centralStateManager: CentralStateManager) {
        safeLogger.log('[QuotaService] Initializing...');
        this.centralStateManager = centralStateManager;
        // Get Firestore and Auth instances (assuming initialized elsewhere or handle initialization)
        try {
            this.db = getFirestore(); // Get default instance
            this.auth = getFirebaseAuth(); // Get auth instance
        } catch (error) {
            safeLogger.error('[QuotaService] Failed to get Firestore/Auth instance:', error);
            // Handle this critical failure
            this.db = {} as Firestore;
            this.auth = {} as Auth;
            throw new Error("QuotaService failed to get Firebase instances.");
        }
    }

    /**
     * 初始化服务，订阅会员状态变化
     */
    public initialize(): void {
        safeLogger.log('[QuotaService] Starting initialization...');
        // Listen to Auth changes first to get userId
        this.unsubscribeAuth = this.auth.onAuthStateChanged((user) => {
            const newUserId = user?.uid || null;
            safeLogger.log(`[QuotaService] Auth state changed. New User ID: ${newUserId}, Previous User ID: ${this.currentUserId}`);
            if (newUserId !== this.currentUserId) {
                this.currentUserId = newUserId;
                this.resetLocalState(); // Reset quota/usage cache on user change
                if (newUserId) {
                    // Subscribe to membership state *after* getting userId
                    this.subscribeToMembership();
                    // Load usage data for the new user
                    this._loadUsage(); 
                } else {
                    // User logged out, ensure subscription is cleaned up
                    this.cleanupMembershipSubscription();
                }
            }
        });
         safeLogger.log('[QuotaService] Auth state listener initialized.');
         // Initial membership subscription is now triggered by auth state change
    }

    /**
     * 处理会员状态变化的内部回调
     * @param membershipState 最新的会员状态
     */
    private handleMembershipChange(membershipState: MembershipState): void {
        // --- Auth Flow Debugging ---
        console.log('[AUTH_FLOW_DEBUG] QuotaService received membership state update:', JSON.stringify(membershipState, null, 2));

        safeLogger.log('[QuotaService] Received membership state update:', membershipState);
        this.calculateAndBroadcastQuota(membershipState);
        // Reload usage data in case limits affect how usage is interpreted or stored (optional)
        // Or assume usage data is independent of limits unless specific logic requires reload
        if (!this.currentUsage && this.currentUserId && !this.usageLoading) {
             safeLogger.log('[QuotaService] Membership changed and usage not loaded yet, triggering usage load.');
             this._loadUsage();
         }
    }

    /**
     * 根据会员状态计算配额
     * @param membershipState 会员状态
     * @returns 计算得出的配额对象
     */
    private calculateQuota(membershipState: MembershipState): MembershipQuota {
        // 检查是否为有效Pro会员 (状态为pro且未过期)
        const isPro = membershipState.status === 'pro' && !(membershipState.expiresAt && membershipState.expiresAt < Date.now());

        if (isPro) {
             return DEFAULT_PRO_QUOTA;
        } else {
             return DEFAULT_FREE_QUOTA;
        }
        // 未来可以根据 membershipState.plan 等字段扩展更复杂的配额规则
    }

    /**
     * 计算配额，并在配额发生变化时广播更新消息
     * @param membershipState 会员状态
     */
    private calculateAndBroadcastQuota(membershipState: MembershipState): void {
        const newQuota = this.calculateQuota(membershipState);

        // 使用简单比较检查配额是否实际发生变化 (未来可用 deep-equal 库优化)
        if (JSON.stringify(this.currentQuota) !== JSON.stringify(newQuota)) {
             safeLogger.log('[QuotaService] Quota changed. Broadcasting QUOTA_STATE_UPDATED:', newQuota);
             this.currentQuota = newQuota;
             // 调用广播方法将新配额通知给 UI 层
             this.broadcastQuotaUpdate(this.currentQuota);
        } else {
             safeLogger.log('[QuotaService] Quota calculation resulted in no change. Skipping broadcast.');
        }
    }

    /**
     * 广播配额更新消息给 UI 层
     * 注意：此方法直接调用 chrome.runtime.sendMessage，未来可能考虑通过 CentralStateManager 统一发送。
     * @param quota 最新的配额数据
     */
    private broadcastQuotaUpdate(quota: MembershipQuota): void {
        // !! 修改: 广播整合后的 FullQuotaInfo !!
        const fullInfo: FullQuotaInfo = {
            limits: quota, // 使用传入的最新上限
            usage: this.currentUsage // 使用当前缓存的用量
        };
        safeLogger.log('[QuotaService] Broadcasting QUOTA_STATE_UPDATED with full info:', fullInfo);
        chrome.runtime.sendMessage({ type: QUOTA_STATE_UPDATED, payload: fullInfo })
            .catch((error: unknown) => {
                // 忽略接收端不存在的错误 (例如UI未打开)
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!errorMessage.includes('Receiving end does not exist')) {
                    safeLogger.error(`[QuotaService] Error sending QUOTA_STATE_UPDATED message: ${errorMessage}`, error);
                }
            });
    }

    /**
     * 供其他后台服务获取当前计算出的配额 (如果需要)
     * @returns 当前配额对象
     */
    public getCurrentQuota(): MembershipQuota {
        // 注意：这个值只在 handleMembershipChange 触发后更新，不是实时从 Firestore 读取
        return this.currentQuota;
    }

    /**
     * 新增: 获取包含上限和用量的完整配额信息
     * @returns 包含上限和用量的完整配额信息对象
     */
    public getFullQuotaInfo(): FullQuotaInfo {
        return {
            limits: this.currentQuota,
            usage: this.currentUsage
        };
    }

    // Separated subscription logic
    private subscribeToMembership(): void {
         if (this.unsubscribeMembership) {
             return; // Avoid duplicate subscriptions
         }
         if (!this.currentUserId) {
             safeLogger.error('[QuotaService] Cannot subscribe to membership without userId.');
             return;
         }
         safeLogger.log(`[QuotaService] Attaching membership listener for user ${this.currentUserId}.`);
         this.unsubscribeMembership = this.centralStateManager.subscribeToMembershipState(
             (membershipState) => {
                 this.handleMembershipChange(membershipState);
             }
         );
         // Fetch initial state immediately after subscribing if needed
         const initialState = this.centralStateManager.getMembershipState();
         if (initialState && initialState.status) { // Check if state is already available
             this.handleMembershipChange(initialState);
         }
    }
    
    // Cleanup membership subscription
    private cleanupMembershipSubscription(): void {
         if (this.unsubscribeMembership) {
             this.unsubscribeMembership();
             this.unsubscribeMembership = null;
         }
    }

    // Reset local cache
    private resetLocalState(): void {
         safeLogger.log('[QuotaService] Resetting local quota and usage cache.');
         this.currentQuota = DEFAULT_FREE_QUOTA;
         this.currentUsage = null; // Clear usage cache
         this.usageLoading = false; 
         // Optionally broadcast a quota update with default values if needed
         // this.broadcastQuotaUpdate(this.currentQuota);
    }

    // --- Usage Data Handling --- 

    private getUsageDocRef(userId: string) {
        if (!userId) return null;
        return doc(this.db, 'users', userId, 'quota', 'usage');
    }

    // Reads usage data from Firestore
    private async _readUsage(userId: string): Promise<QuotaUsage | null> {
         const docRef = this.getUsageDocRef(userId);
         if (!docRef) return null;

         try {
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                 const data = docSnap.data();
                 // Basic validation or transformation if needed
                 const usage: QuotaUsage = {
                     dailyOptimizationCount: data.dailyOptimizationCount ?? 0,
                     lastOptimizationReset: data.lastOptimizationReset?.toMillis() ?? null, // Convert Timestamp
                     storedPromptsCount: data.storedPromptsCount // 假设 Firestore 中也存储了这个值（如果需要持久化）
                 };
                 safeLogger.log(`[QuotaService] Usage data read successfully for user ${userId}.`);
                 return usage;
             } else {
                 safeLogger.log(`[QuotaService] No usage document found for user ${userId}. Returning default.`);
                 // Return default usage, but don't write it here yet.
                 // Writing happens on first increment or reset, or explicitly if needed.
                 return DEFAULT_USAGE;
             }
         } catch (error) {
             safeLogger.error(`[QuotaService] Error reading usage for user ${userId}:`, error);
             return null; // Indicate error reading
         }
     }
     
    // Writes usage data to Firestore
    private async _writeUsage(userId: string, usageData: Partial<QuotaUsage>): Promise<void> {
         safeLogger.log(`[QuotaService] Writing usage for user ${userId}:`, usageData);
         const docRef = this.getUsageDocRef(userId);
         if (!docRef) return;

         // Convert timestamp back to Firestore Timestamp if present
         const dataToWrite: any = { ...usageData };
         if (usageData.lastOptimizationReset) {
             dataToWrite.lastOptimizationReset = Timestamp.fromMillis(usageData.lastOptimizationReset);
         }

         try {
             // Use setDoc with merge: true to create or update parts of the document
             await setDoc(docRef, dataToWrite, { merge: true });
             safeLogger.log(`[QuotaService] Usage data written successfully for user ${userId}.`);
         } catch (error) {
             safeLogger.error(`[QuotaService] Error writing usage for user ${userId}:`, error);
         }
     }
     
    // Loads usage data and handles initialization
    private async _loadUsage(): Promise<void> {
         if (!this.currentUserId || this.usageLoading) {
             safeLogger.log(`[QuotaService] Skipping usage load. UserId: ${this.currentUserId}, Loading: ${this.usageLoading}`);
             return;
         }
         this.usageLoading = true;
         this.currentUsage = null; // Clear cache before loading
         safeLogger.log(`[QuotaService] Starting to load usage for user ${this.currentUserId}`);
         
         // !! 修改: 分开读取优化用量和存储用量 !!
         const optimizationUsagePart = await this._readUsage(this.currentUserId);
         const storedPromptsCount = await this._getStoredPromptsCount(this.currentUserId);
         
         if (optimizationUsagePart) {
             // 合并从 Firestore 读取的优化用量和实时查询的存储用量
             this.currentUsage = {
                 ...optimizationUsagePart,
                 storedPromptsCount: storedPromptsCount
             };
             safeLogger.log(`[QuotaService] Usage loaded and cached for user ${this.currentUserId}`);
             // Check if reset is needed upon load
             this.checkAndResetDailyUsageIfNeeded();
         } else {
             // Handle read error or non-existent doc - maybe set default usage?
             safeLogger.warn(`[QuotaService] Failed to load optimization usage for user ${this.currentUserId}, using default optimization counts.`);
             // 即使优化用量读取失败，也要设置存储用量
             this.currentUsage = {
                 ...DEFAULT_USAGE, // 使用默认优化用量
                 storedPromptsCount: storedPromptsCount // 使用查询到的存储用量
             };
             // Consider writing default usage to Firestore here if necessary
             // await this._writeUsage(this.currentUserId, this.currentUsage); 
         }
         this.usageLoading = false;
     }

    // Method to check if reset is needed (e.g., on load or alarm)
    private checkAndResetDailyUsageIfNeeded(): void {
        if (!this.currentUsage || !this.currentUserId) return;

        const now = Date.now();
        const lastReset = this.currentUsage.lastOptimizationReset;

        // Check if lastReset is null or if it was before the start of today
        if (lastReset === null || new Date(lastReset).setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0)) {
            safeLogger.log(`[QuotaService] Daily optimization reset needed for user ${this.currentUserId}. Last reset: ${lastReset}`);
            this.resetOptimizationUsage(); // Call the reset method
        } else {
            safeLogger.log(`[QuotaService] Daily optimization reset not needed for user ${this.currentUserId}. Last reset: ${lastReset}`);
        }
    }

    /**
     * [API Method] Resets the daily optimization count.
     * Checks if reset is necessary based on last reset timestamp.
     */
    public async resetOptimizationUsage(): Promise<void> {
        if (!this.currentUserId) {
            safeLogger.warn('[QuotaService] Cannot reset usage without userId.');
            return;
        }
        
        // Ensure usage is loaded
        if (!this.currentUsage) {
             safeLogger.warn('[QuotaService] Usage data not loaded, attempting to load before reset...');
             await this._loadUsage();
             // If still not loaded after attempt, abort
             if (!this.currentUsage) {
                 safeLogger.error('[QuotaService] Failed to load usage data, cannot proceed with reset.');
                 return;
             }
        }

        const now = Date.now();
        const lastReset = this.currentUsage.lastOptimizationReset;
        const needsReset = lastReset === null || new Date(lastReset).setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0);

        if (needsReset) {
            safeLogger.log(`[QuotaService] Performing daily optimization reset for user ${this.currentUserId}.`);
            const updatedUsage: Partial<QuotaUsage> = {
                dailyOptimizationCount: 0,
                lastOptimizationReset: now
            };
            // Update cache first
            this.currentUsage = { ...this.currentUsage, ...updatedUsage }; 
            // Write update to Firestore
            await this._writeUsage(this.currentUserId, updatedUsage);
        } else {
            safeLogger.log(`[QuotaService] Daily reset already performed for user ${this.currentUserId}.`);
        }
    }

    // Updated destroy method
    public destroy(): void {
        safeLogger.log('[QuotaService] Destroying...');
        this.cleanupMembershipSubscription(); // Cleanup membership listener
        if (this.unsubscribeAuth) { // Cleanup auth listener
            this.unsubscribeAuth();
            this.unsubscribeAuth = null;
            safeLogger.log('[QuotaService] Unsubscribed from auth state.');
        }
    }

    // --- New API Methods for Usage and Checks ---

    /**
     * [API Method] Gets the current cached usage data.
     * Returns null if usage hasn't been loaded yet.
     */
    public getUsage(): QuotaUsage | null {
        return this.currentUsage;
    }

    /**
     * [API Method] Checks if a specific feature can be used based on current quota and usage.
     * @param feature The feature to check ('storage' or 'optimization')
     * @returns Promise<boolean> True if the feature can be used, false otherwise.
     */
    public async canUseFeature(feature: 'storage' | 'optimization'): Promise<boolean> {
        if (!this.currentUserId) {
            safeLogger.warn(`[QuotaService] Cannot check feature '${feature}' without userId.`);
            // Define behavior for anonymous users - assume free quota applies, maybe limited checks
            if (feature === 'storage') return true; // Allow anonymous storage for now? Needs clarification.
            if (feature === 'optimization') return (DEFAULT_USAGE.dailyOptimizationCount < DEFAULT_FREE_QUOTA.dailyOptimizations); // Check against default free
            return false;
        }

        // Ensure usage is loaded if needed (especially for optimization)
        if (!this.currentUsage && !this.usageLoading) {
            safeLogger.log(`[QuotaService] Usage not cached for canUseFeature('${feature}'), loading...`);
            await this._loadUsage(); 
        }
        // Wait if loading is in progress (simple busy wait, consider promise queue for robustness)
        while (this.usageLoading) {
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        const limits = this.currentQuota;
        const usage = this.currentUsage; 

        if (!usage) {
             safeLogger.error(`[QuotaService] Failed to get usage data for user ${this.currentUserId} after load attempt.`);
             return false; // Cannot determine quota if usage is unavailable
        }

        if (feature === 'storage') {
            try {
                safeLogger.log(`[QuotaService] Checking 'storage' quota for user ${this.currentUserId}. Limit: ${limits.maxPrompts}`);
                // !! 修改: 使用缓存或实时获取的存储数量 !!
                const currentPromptCount = usage.storedPromptsCount ?? 0; // 使用加载到缓存的计数
                safeLogger.log(`[QuotaService] User ${this.currentUserId} current prompt count: ${currentPromptCount}`);
                return currentPromptCount < limits.maxPrompts;
            } catch (error) {
                safeLogger.error(`[QuotaService] Error querying prompt count for user ${this.currentUserId}:`, error);
                return false; // Fail safely if count query fails
            }
        } else if (feature === 'optimization') {
             safeLogger.log(`[QuotaService] Checking 'optimization' quota for user ${this.currentUserId}. Usage: ${usage.dailyOptimizationCount}, Limit: ${limits.dailyOptimizations}`);
            // Check if reset is needed before comparing counts
            this.checkAndResetDailyUsageIfNeeded(); // Ensure usage reflects current day
            // Re-read usage from cache after potential reset
            const currentUsageAfterCheck = this.currentUsage; 
             if (!currentUsageAfterCheck) {
                safeLogger.error(`[QuotaService] Usage data unavailable after reset check for user ${this.currentUserId}.`);
                return false;
             }           
            return currentUsageAfterCheck.dailyOptimizationCount < limits.dailyOptimizations;
        }

        return false; // Unknown feature
    }

    /**
     * [API Method] Increments the usage count for a feature.
     * Currently only handles 'optimization'.
     * @param feature The feature whose usage to increment ('storage' or 'optimization')
     */
    public async incrementUsage(feature: 'storage' | 'optimization'): Promise<void> {
        safeLogger.log(`[QuotaService] incrementUsage called for feature: ${feature}`);
        
        if (!this.currentUserId) {
            safeLogger.warn('[QuotaService] Cannot increment usage without userId.');
            return;
        }

        // Handle storage increment
        if (feature === 'storage') {
            // 新的思路：不再由 incrementUsage 直接修改计数。
            // QuotaService 依赖 _loadUsage 和 _getStoredPromptsCount 来获取准确的激活计数以进行配额判断。
            // 此函数被调用表明一个"可能导致存储数量变化"的操作已发生，
            // 但具体的计数更新将通过下一次 _loadUsage (通常由 canUseFeature 触发) 完成。
            safeLogger.log(`[QuotaService] incrementUsage('storage') called for user ${this.currentUserId}. The actual count is determined by _getStoredPromptsCount via _loadUsage.`);
            
            // 可选：如果希望此调用主动刷新并广播最新的配额状态
            // (确保在调用此函数的地方，操作确实已成功并改变了Firestore中的isActive状态)
            // if (this.currentUserId) {
            //    console.log('[QuotaService] incrementUsage(\\'storage\\') triggering _loadUsage and broadcast.');
            //    await this._loadUsage(); // 重新加载用量
            //    this.broadcastQuotaUpdate(this.currentQuota); // 广播最新的完整配额信息
            // }
            return; 
        }

        // Handle optimization increment (involves DB write)
        if (feature === 'optimization') {
            // Ensure usage is loaded before proceeding with optimization increment
            if (!this.currentUsage && !this.usageLoading) {
                safeLogger.log(`[QuotaService] Usage not cached for incrementUsage('${feature}'), loading...`);
                await this._loadUsage(); 
            }
            // Wait if loading is in progress
            while (this.usageLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (!this.currentUsage) {
                 safeLogger.error(`[QuotaService] Failed to get usage data for incrementUsage('optimization'), user ${this.currentUserId}.`);
                 return; // Abort if usage is unavailable
            }

            // Ensure reset check is done before incrementing
            this.checkAndResetDailyUsageIfNeeded();
            // Re-read usage from cache after potential reset
            const usageToUpdate = this.currentUsage; 
            if (!usageToUpdate) {
                safeLogger.error(`[QuotaService] Usage data unavailable after reset check for incrementUsage('optimization'), user ${this.currentUserId}.`);
                return;
            }    

            const updatedCount = usageToUpdate.dailyOptimizationCount + 1;
            safeLogger.log(`[QuotaService] Incrementing optimization usage for user ${this.currentUserId}. New count: ${updatedCount}`);
            
            const updatedUsage: Partial<QuotaUsage> = {
                dailyOptimizationCount: updatedCount,
                lastOptimizationReset: usageToUpdate.lastOptimizationReset // Keep the existing reset time
            };

            // Optimistically update cache
            this.currentUsage = { ...usageToUpdate, ...updatedUsage };

            // Write update to Firestore
            await this._writeUsage(this.currentUserId, updatedUsage);
        }
    }

    // !! 修改: 获取存储的提示词数量 (现在是激活的提示词数量) !!
    private async _getStoredPromptsCount(userId: string): Promise<number> {
        if (!userId) return 0;
        try {
            const promptsCollectionRef = collection(this.db, 'users', userId, 'prompts');
            // 修改查询以只计算 isActive: true 的提示词
            const q = query(promptsCollectionRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            safeLogger.log(`[QuotaService] Fetched ACTIVE prompt count for user ${userId}: ${snapshot.size}`);
            return snapshot.size;
        } catch (error) {
            safeLogger.error(`[QuotaService] Error fetching ACTIVE prompt count for user ${userId}:`, error);
            return 0; // 返回 0 表示获取失败或无权限，避免阻塞
        }
    }
} 