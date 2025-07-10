import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp, // 用于更新时间戳
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { authService } from '../auth'; // 假设 Auth 服务在这里
import { getCentralStateManager } from '@/background/index';
import { MembershipState } from '@/types/centralState'; // Use the unified type
import {
  QuotaLimits,
  QuotaUsage,
  QuotaType,
  DEFAULT_FREE_QUOTA_LIMITS,
  DEFAULT_PRO_QUOTA_LIMITS,
  DEFAULT_QUOTA_USAGE,
  FIRESTORE_QUOTA_PATH,
} from './types';
import { safeLogger } from '../../utils/safeEnvironment';
import { debounce } from '../../utils/debounce';

// 定义观察者回调类型
type QuotaObserver = (usage: QuotaUsage, limits: QuotaLimits) => void;

/**
 * 配额管理服务
 * 负责跟踪和管理用户的功能使用配额
 */
class QuotaService {
  private currentUserId: string | null = null;
  private currentQuotaUsage: QuotaUsage | null = null;
  private currentQuotaLimits: QuotaLimits = DEFAULT_FREE_QUOTA_LIMITS; // 默认为免费版
  private firestorePath: string | null = null;
  private observers: QuotaObserver[] = [];
  private isInitialized: boolean = false;

  // 依赖注入 (或者直接引用单例服务)
  private auth = authService;
  private unsubscribeCentralMembership: (() => void) | null = null;
  private db = getFirestore(getApp());

  constructor() {
    this.setupAuthListener();
  }

  /**
   * 初始化服务，加载初始状态
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized || !this.currentUserId) return;

    this.firestorePath = `users/${this.currentUserId}/${FIRESTORE_QUOTA_PATH}`;
    safeLogger.log(`[QuotaService] Initializing for user ${this.currentUserId}, path: ${this.firestorePath}`);

    try {
      // 1. Get initial limits from CentralStateManager
      const centralStateManager = getCentralStateManager();
      const initialMembershipState = centralStateManager.getMembershipState();
      this.updateLimits(initialMembershipState); // Update based on initial state

      // 2. 从 Firestore 加载当前 usage
      this.currentQuotaUsage = await this._loadQuotaUsage();

      // 3. 检查并执行每日重置（如果需要）
      await this.checkAndPerformDailyReset();

      this.isInitialized = true;
      this.notifyObservers();
      safeLogger.log(`[QuotaService] Initialized successfully. Usage:`, this.currentQuotaUsage, `Limits:`, this.currentQuotaLimits);
    } catch (error) {
      safeLogger.error('[QuotaService] Initialization failed:', error);
      // 初始化失败，使用默认值并标记未初始化，以便稍后重试
      this.currentQuotaUsage = { ...DEFAULT_QUOTA_USAGE };
      this.isInitialized = false;
    }
  }

  /**
   * 设置认证状态监听器
   */
  private setupAuthListener(): void {
    this.auth.onAuthStateChanged(async (user) => {
      if (user && user.uid !== this.currentUserId) {
        safeLogger.log(`[QuotaService] Auth state changed: User logged in (${user.uid})`);
        this.currentUserId = user.uid;
        this.isInitialized = false; // 重置初始化标志，以便重新加载数据
        await this.initialize();
        this.subscribeToCentralStateManager(); // **NEW: Subscribe on login**
      } else if (!user && this.currentUserId) {
        safeLogger.log(`[QuotaService] Auth state changed: User logged out`);
        this.cleanupCentralSubscription(); // **NEW: Cleanup subscription on logout**
        this.resetState();
      }
    });
  }

  /**
   * 根据会员状态更新内部的配额限制
   */
  private updateLimits(state: MembershipState): void {
    const newLimits = (state?.status === 'pro') ? DEFAULT_PRO_QUOTA_LIMITS : DEFAULT_FREE_QUOTA_LIMITS;
    if (JSON.stringify(this.currentQuotaLimits) !== JSON.stringify(newLimits)) {
      this.currentQuotaLimits = newLimits;
      safeLogger.log('[QuotaService] Quota limits updated:', this.currentQuotaLimits);
    }
  }

  /**
   * 从 Firestore 加载用户的配额使用情况
   * 如果 Firestore 中没有记录，则创建并返回默认记录
   */
  private async _loadQuotaUsage(): Promise<QuotaUsage> {
    if (!this.firestorePath) {
      safeLogger.error('[QuotaService] Cannot load usage, firestorePath is not set.');
      return { ...DEFAULT_QUOTA_USAGE };
    }

    try {
      const docRef = doc(this.db, this.firestorePath);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // TODO: 可能需要数据迁移/验证逻辑，确保字段符合最新定义
        return docSnap.data() as QuotaUsage;
      } else {
        safeLogger.log('[QuotaService] No quota usage record found in Firestore, creating default.');
        const defaultUsage = { ...DEFAULT_QUOTA_USAGE, lastOptimizationReset: Date.now() }; // 首次创建时，设置重置时间为当前
        await setDoc(docRef, defaultUsage);
        return defaultUsage;
      }
    } catch (error) {
      safeLogger.error('[QuotaService] Failed to load quota usage from Firestore:', error);
      return { ...DEFAULT_QUOTA_USAGE }; // 返回默认值以保证服务可用性
    }
  }

  /**
   * 将当前的配额使用情况保存到 Firestore
   * 使用 debounce 避免频繁写入
   */
  private _saveQuotaUsage = debounce(async (usage: QuotaUsage): Promise<void> => {
    if (!this.firestorePath) {
      safeLogger.error('[QuotaService] Cannot save usage, firestorePath is not set.');
      return;
    }
    if (!usage) {
      safeLogger.error('[QuotaService] Cannot save null or undefined usage.');
      return;
    }

    safeLogger.log('[QuotaService] Debounced save triggered. Saving usage:', usage);
    try {
      const docRef = doc(this.db, this.firestorePath);
      // 使用 setDoc + merge: true 或者 updateDoc 来更新
      // setDoc + merge: true 如果文档不存在会创建，存在则合并
      await setDoc(docRef, usage, { merge: true });
      safeLogger.log('[QuotaService] Quota usage saved to Firestore.');
    } catch (error) {
      safeLogger.error('[QuotaService] Failed to save quota usage to Firestore:', error);
    }
  }, 1000); // 1秒防抖

  /**
   * 重置内部状态（用户登出时调用）
   */
  private resetState(): void {
    this.currentUserId = null;
    this.currentQuotaUsage = null;
    this.currentQuotaLimits = DEFAULT_FREE_QUOTA_LIMITS;
    this.firestorePath = null;
    this.isInitialized = false;
    this.cleanupCentralSubscription(); // **NEW: Ensure cleanup on reset**
    safeLogger.log('[QuotaService] State reset.');
    this.notifyObservers();
  }

  /**
   * 添加观察者
   */
  public subscribe(observer: QuotaObserver): () => void {
    this.observers.push(observer);
    // 立即用当前状态调用一次
    if (this.isInitialized && this.currentQuotaUsage) {
      observer(this.currentQuotaUsage, this.currentQuotaLimits);
    }
    return () => {
      this.observers = this.observers.filter(obs => obs !== observer);
    };
  }

  /**
   * 通知所有观察者
   */
  private notifyObservers(): void {
    if (!this.isInitialized || !this.currentQuotaUsage) {
      // 如果未初始化或没有使用数据，可以发送默认/空状态
      this.observers.forEach(observer => observer(DEFAULT_QUOTA_USAGE, this.currentQuotaLimits));
      return;
    }
    this.observers.forEach(observer => observer(this.currentQuotaUsage!, this.currentQuotaLimits));
  }

  // --- 核心 API (待实现) ---

  /**
   * 获取当前用户的配额限制
   * 确保服务已初始化
   */
  public async getLimits(): Promise<QuotaLimits> {
    // 限制是根据会员状态在内存中更新的，直接返回即可
    // 如果需要更强的实时性（例如，管理员后台修改了默认限制），则需要重新从配置服务或 Firestore 读取
    if (!this.isInitialized) {
        // 尝试初始化，但不阻塞主流程太久，如果初始化失败则返回默认值
        await this.initialize().catch(e => safeLogger.error("Error during lazy init in getLimits:", e));
    }
    return this.currentQuotaLimits;
  }

  /**
   * 获取当前用户的配额使用情况
   * 确保服务已初始化
   */
  public async getUsage(): Promise<QuotaUsage> {
    // 确保已初始化并加载了数据
    if (!this.isInitialized || !this.currentQuotaUsage) {
      safeLogger.log('[QuotaService] getUsage called before initialized or usage loaded, attempting init...');
      await this.initialize();
    }
    // 返回当前内存中的使用情况，如果仍未加载则返回默认值
    return this.currentQuotaUsage || { ...DEFAULT_QUOTA_USAGE };
  }

  /**
   * 检查用户是否可以使用某个功能
   * @param type 配额类型 ('storage' 或 'optimization')
   */
  public async canUseFeature(type: QuotaType): Promise<boolean> {
    // 确保数据已加载
    if (!this.isInitialized || !this.currentQuotaUsage) {
      safeLogger.log('[QuotaService] canUseFeature called before initialized, attempting init...');
      await this.initialize();
      // 如果初始化失败，为安全起见，可能需要返回 false
      if (!this.isInitialized || !this.currentQuotaUsage) {
        safeLogger.warn('[QuotaService] Initialization failed, denying feature use.');
        return false;
      }
    }

    // 检查并执行每日重置（如果需要）
    // 这确保了在检查之前，当天的使用次数是最新的
    await this.checkAndPerformDailyReset();

    const usage = this.currentQuotaUsage!;
    const limits = this.currentQuotaLimits;

    switch (type) {
      case 'storage':
        // 注意：这里的 storageCount 来自 Firestore 的 QuotaUsage 文档
        // 这可能不是最准确的，因为它依赖于 Firestore 文档的更新。
        // 更可靠的方式可能是直接查询 prompts 集合的数量，但这会增加读取成本。
        // 暂时先使用 QuotaUsage 中的计数，后续根据需要优化。
        safeLogger.log(`[QuotaService] Checking storage quota: usage=${usage.storageCount}, limit=${limits.storage}`);
        return usage.storageCount < limits.storage;
      case 'optimization':
        safeLogger.log(`[QuotaService] Checking optimization quota: usage=${usage.optimizationsUsedToday}, limit=${limits.optimizationsPerDay}`);
        return usage.optimizationsUsedToday < limits.optimizationsPerDay;
      default:
        safeLogger.warn(`[QuotaService] Unknown quota type requested: ${type}`);
        return false;
    }
  }

  /**
   * 增加指定类型的配额使用量
   * @param type 配额类型 ('storage' 或 'optimization')
   * @param count 增加的数量 (默认为 1)
   */
  public async incrementUsage(type: QuotaType, count: number = 1): Promise<void> {
    if (!this.isInitialized || !this.currentQuotaUsage) {
      safeLogger.warn('[QuotaService] incrementUsage called before initialized. Operation might be lost if init fails later.');
      // 尝试初始化，如果失败则无法增加用量
      try {
          await this.initialize();
          if (!this.isInitialized || !this.currentQuotaUsage) {
              safeLogger.error('[QuotaService] Initialization failed, cannot increment usage.');
              return;
          }
      } catch (error) {
          safeLogger.error('[QuotaService] Error during lazy init in incrementUsage:', error);
          return;
      }
    }

    // 检查并执行每日重置（如果需要）
    await this.checkAndPerformDailyReset();

    const updatedUsage = { ...this.currentQuotaUsage! }; // 创建副本进行修改
    let usageChanged = false;

    switch (type) {
      case 'storage':
        updatedUsage.storageCount = (updatedUsage.storageCount || 0) + count;
        usageChanged = true;
        safeLogger.log(`[QuotaService] Incrementing storage usage to ${updatedUsage.storageCount}`);
        break;
      case 'optimization':
        updatedUsage.optimizationsUsedToday = (updatedUsage.optimizationsUsedToday || 0) + count;
        usageChanged = true;
        safeLogger.log(`[QuotaService] Incrementing optimization usage to ${updatedUsage.optimizationsUsedToday}`);
        break;
      default:
        safeLogger.warn(`[QuotaService] Unknown quota type for increment: ${type}`);
        return; // 不做任何操作
    }

    if (usageChanged) {
      this.currentQuotaUsage = updatedUsage; // 更新内存状态
      this.notifyObservers(); // 通知观察者
      this._saveQuotaUsage(updatedUsage); // 触发防抖保存到 Firestore
    }
  }

  /**
   * 重置每日优化次数
   * 内部方法，也可由外部（如后台任务）调用
   */
  public async resetOptimizationUsage(): Promise<void> {
    if (!this.isInitialized || !this.currentQuotaUsage) {
       safeLogger.warn('[QuotaService] resetOptimizationUsage called before initialized.');
       // 尝试初始化
       try {
          await this.initialize();
          if (!this.isInitialized || !this.currentQuotaUsage) {
              safeLogger.error('[QuotaService] Initialization failed, cannot reset usage.');
              return;
          }
      } catch (error) {
          safeLogger.error('[QuotaService] Error during lazy init in resetOptimizationUsage:', error);
          return;
      }
    }

    const now = Date.now();
    // 检查是否真的需要重置 (例如，如果今天已经重置过)
    // 通过比较 lastOptimizationReset 和当前时间的日期部分
    const lastResetDate = new Date(this.currentQuotaUsage!.lastOptimizationReset).toDateString();
    const currentDate = new Date(now).toDateString();

    if (lastResetDate !== currentDate || this.currentQuotaUsage!.optimizationsUsedToday > 0) {
        if (this.currentQuotaUsage!.optimizationsUsedToday > 0) {
          safeLogger.log(`[QuotaService] Resetting daily optimization usage. Previous count: ${this.currentQuotaUsage!.optimizationsUsedToday}`);
          const updatedUsage = {
            ...this.currentQuotaUsage!,
            optimizationsUsedToday: 0,
            lastOptimizationReset: now,
          };
          this.currentQuotaUsage = updatedUsage;
          this.notifyObservers();
          this._saveQuotaUsage(updatedUsage);
        } else if (lastResetDate !== currentDate) {
            // 即使当天使用次数为0，如果日期变了，也更新重置时间戳
            safeLogger.log(`[QuotaService] Updating last optimization reset timestamp.`);
             const updatedUsage = {
                 ...this.currentQuotaUsage!,
                 lastOptimizationReset: now,
             };
             this.currentQuotaUsage = updatedUsage;
             // 不需要通知观察者，因为使用次数没变，但需要保存
             this._saveQuotaUsage(updatedUsage);
        }
    } else {
        safeLogger.log('[QuotaService] Daily optimization usage already reset today.');
    }

  }

  /**
   * 检查并根据需要执行每日重置逻辑
   * 这个方法会在获取用量或检查配额前调用，确保数据是当天最新的
   */
  private async checkAndPerformDailyReset(): Promise<void> {
    if (!this.currentQuotaUsage) {
      // safeLogger.warn('[QuotaService] Cannot check daily reset, usage not loaded.');
      // 如果 usage 未加载，初始化时会尝试加载并重置，这里可以先跳过
      return;
    }

    const now = Date.now();
    const lastReset = this.currentQuotaUsage.lastOptimizationReset || 0;
    const lastResetDate = new Date(lastReset);
    const currentDate = new Date(now);

    // 检查上次重置是否在今天之前 (比较年月日)
    const needsReset = lastResetDate.getFullYear() < currentDate.getFullYear() ||
                     (lastResetDate.getFullYear() === currentDate.getFullYear() && lastResetDate.getMonth() < currentDate.getMonth()) ||
                     (lastResetDate.getFullYear() === currentDate.getFullYear() && lastResetDate.getMonth() === currentDate.getMonth() && lastResetDate.getDate() < currentDate.getDate());

    if (needsReset) {
      safeLogger.log('[QuotaService] Detected day change, performing daily optimization reset.');
      await this.resetOptimizationUsage();
    }
  }

  // --- NEW: Methods for CentralStateManager Subscription ---
  private subscribeToCentralStateManager(): void {
      this.cleanupCentralSubscription(); // Ensure no duplicate subscriptions
      try {
          const centralStateManager = getCentralStateManager();
          safeLogger.log('QuotaService subscribing to CentralStateManager membership state...');
          this.unsubscribeCentralMembership = centralStateManager.subscribeToMembershipState(
              (newState: MembershipState) => { // Explicitly type newState
                  safeLogger.log('[QuotaService] Received membership update from CentralStateManager:', newState.status);
                  this.updateLimits(newState);
                  // Maybe notify observers or re-check quotas here if limits change affects availability
                  this.notifyObservers(); 
              }
          );
          if (typeof this.unsubscribeCentralMembership === 'function') {
             safeLogger.log('QuotaService successfully subscribed to CentralStateManager.');
          } else {
             safeLogger.error('QuotaService failed to subscribe! Subscription did not return a function.');
          }
      } catch (error) {
          safeLogger.error('QuotaService error subscribing to CentralStateManager:', error);
      }
  }

  private cleanupCentralSubscription(): void {
      if (this.unsubscribeCentralMembership) {
          safeLogger.log('QuotaService cleaning up CentralStateManager subscription.');
          try {
              this.unsubscribeCentralMembership();
          } catch (error) {
              safeLogger.error('QuotaService error during cleanup of subscription:', error);
          }
          this.unsubscribeCentralMembership = null;
    }
  }
}

// 导出单例
export const quotaService = new QuotaService(); 