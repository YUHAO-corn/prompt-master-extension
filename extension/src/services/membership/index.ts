import { MembershipState, MembershipQuota } from './types';
import { authService } from '../auth';
import { getFirestore, doc, setDoc, Timestamp, Firestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { isServiceWorkerEnvironment, safeLogger } from '../../utils/safeEnvironment';
// Removed imports related to CentralStateManager as this is dev-tools only
// import { getCentralStateManager } from '@/background/index';
// import { CENTRAL_MEMBERSHIP_STATE_UPDATED } from '@/types/centralState';

/**
 * [LEGACY - DEV TOOLS ONLY]
 * 会员状态管理服务 (旧版 - 仅保留开发者工具)
 * 警告: 此服务已废弃，核心状态管理和监听已完全迁移至 CentralStateManager。
 * 这些方法直接修改 Firestore，状态同步依赖 CentralStateManager 监听 Firestore 变化。
 * 请勿在生产代码中直接调用此服务的功能。
 */
class MembershipService {
  // Firebase DB instance for dev tools
  private db: Firestore;

  constructor() {
    safeLogger.log('[MembershipService] Constructor called. WARNING: This service is legacy, primary state management is in CentralStateManager.');
    // Get Firestore instance for dev tools
    try {
      const app = getApp(); // Assuming Firebase is already initialized by CentralStateManager
      this.db = getFirestore(app);
    } catch (error) {
       safeLogger.error('[MembershipService] Failed to get Firestore instance:', error);
       this.db = {} as Firestore; // Dummy to prevent further errors
    }
  }

  /**
   * [开发者工具] 切换为Pro会员状态
   * 直接修改 Firestore users/{userId}/membership/status 文档
   */
  async _devSetProMembership(): Promise<void> {
    if (!this.isDevelopmentMode()) {
      safeLogger.warn('[MembershipService] 开发环境专用方法在生产环境被调用');
      return;
    }
    const currentUser = await authService.getCurrentUser(); // Get full user object
    if (!currentUser) {
      safeLogger.error('[MembershipService._devSetProMembership] 用户未登录');
      throw new Error('User not logged in');
    }
    const userId = currentUser.uid; // Get userId from user object

    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天后
    const proState = {
      status: 'pro',
      plan: 'dev_monthly', // Use a distinct plan name for dev
      startedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(expiresAt),
      updatedAt: Timestamp.now(),
      cancelAtPeriodEnd: false,
      subscriptionId: 'dev_sub_pro_' + Date.now(),
      customerId: 'dev_customer_' + userId.substring(0, 5),
      subscriptionStatus: 'active',
      lastVerifiedAt: Timestamp.now(),
    };

    try {
      const membershipDocRef = doc(this.db, 'users', userId, 'membership', 'status');
      await setDoc(membershipDocRef, proState);
      safeLogger.log(`[MembershipService._devSetProMembership] Firestore updated for user ${userId} to Pro.`);
      // No need to return state or broadcast, CentralStateManager handles it.
    } catch (error) {
      safeLogger.error(`[MembershipService._devSetProMembership] Failed to update Firestore for user ${userId}:`, error);
      throw error; // Re-throw for potential UI feedback
    }
  }
  
  /**
   * [开发者工具] 切换为Free会员状态
   * 直接修改 Firestore users/{userId}/membership/status 文档
   */
  async _devSetFreeMembership(): Promise<void> {
    if (!this.isDevelopmentMode()) {
      safeLogger.warn('[MembershipService] 开发环境专用方法在生产环境被调用');
        return;
      }
    const currentUser = await authService.getCurrentUser(); // Get full user object
    if (!currentUser) {
      safeLogger.error('[MembershipService._devSetFreeMembership] 用户未登录');
      throw new Error('User not logged in');
    }
    const userId = currentUser.uid; // Get userId from user object

    const freeState = {
      status: 'free',
      plan: 'free',
      startedAt: Timestamp.now(), // Or null?
      expiresAt: null,
      updatedAt: Timestamp.now(),
      cancelAtPeriodEnd: null,
      subscriptionId: null,
      customerId: 'dev_customer_' + userId.substring(0, 5), // Keep customer ID?
      subscriptionStatus: null,
      lastVerifiedAt: Timestamp.now(),
    };

    try {
      const membershipDocRef = doc(this.db, 'users', userId, 'membership', 'status');
      await setDoc(membershipDocRef, freeState); // Use setDoc to overwrite
      safeLogger.log(`[MembershipService._devSetFreeMembership] Firestore updated for user ${userId} to Free.`);
    } catch (error) {
      safeLogger.error(`[MembershipService._devSetFreeMembership] Failed to update Firestore for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * [开发者工具] 设置会员状态为即将过期（例如，1小时后过期）
   * 直接修改 Firestore users/{userId}/membership/status 文档
   */
  async _devSetExpiringSoon(): Promise<void> {
    if (!this.isDevelopmentMode()) {
      safeLogger.warn('[MembershipService] 开发环境专用方法在生产环境被调用');
      return;
    }
    const currentUser = await authService.getCurrentUser(); // Get full user object
      if (!currentUser) {
      safeLogger.error('[MembershipService._devSetExpiringSoon] 用户未登录');
      throw new Error('User not logged in');
    }
    const userId = currentUser.uid; // Get userId from user object

    const expiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1小时后
    const expiringState = {
      status: 'pro', // Assuming expiring from pro
      plan: 'dev_monthly',
      startedAt: Timestamp.fromMillis(Date.now() - 29 * 24 * 60 * 60 * 1000), // Assume started 29 days ago
      expiresAt: Timestamp.fromMillis(expiresAt),
      updatedAt: Timestamp.now(),
      cancelAtPeriodEnd: false,
      subscriptionId: 'dev_sub_expiring_' + Date.now(),
      customerId: 'dev_customer_' + userId.substring(0, 5),
      subscriptionStatus: 'active',
      lastVerifiedAt: Timestamp.now(),
    };

    try {
      const membershipDocRef = doc(this.db, 'users', userId, 'membership', 'status');
      await setDoc(membershipDocRef, expiringState);
      safeLogger.log(`[MembershipService._devSetExpiringSoon] Firestore updated for user ${userId} to Expiring Soon.`);
    } catch (error) {
      safeLogger.error(`[MembershipService._devSetExpiringSoon] Failed to update Firestore for user ${userId}:`, error);
      throw error;
    }
  }
  
  private isDevelopmentMode(): boolean {
    // 在实际项目中，这里应该有更可靠的开发环境检测逻辑
    // 例如，检查 process.env.NODE_ENV 或特定的构建标志
    return process.env.NODE_ENV === 'development';
  }
}

// 导出单例
export const membershipService = new MembershipService();

// 重新导出类型，以修复 TS2459 错误
export * from './types'; 