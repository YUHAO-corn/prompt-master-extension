import { MembershipState as CentralMembershipState, AuthState, QuotaUsage } from '@/types/centralState';
import { Timestamp } from 'firebase/firestore';

/**
 * 会员状态类型
 */
export type MembershipStatus = 'free' | 'pro' | 'trial';

/**
 * 订阅计划类型
 */
export type SubscriptionPlan = 'monthly' | 'annual' | null;

/**
 * 会员状态数据结构 - **现在从中央类型导入**
 */
// export interface MembershipState { ... old definition commented out ... }
export type { CentralMembershipState as MembershipState }; // Re-export with the original name

/**
 * 默认的免费会员状态
 * **注意**: 此默认值需要更新以匹配新的 MembershipState 结构
 */
export const DEFAULT_FREE_MEMBERSHIP: CentralMembershipState = {
  status: 'free',
  plan: null,
  startedAt: null,
  expiresAt: null,
  cancelAtPeriodEnd: false,
  lastVerifiedAt: Date.now(),
  subscriptionId: null,
  customerId: null,
  // Add missing fields with default values
  updatedAt: null,
  subscriptionStatus: null,
  rawDoc: null,
  isLoading: false,
  error: null,
};

/**
 * 会员权益配额信息
 */
export interface MembershipQuota {
  // 最大提示词数量
  maxPrompts: number;
  
  // 每日优化次数上限
  dailyOptimizations: number;
  
  // 是否能使用导出功能
  canExport: boolean;
  
  // 是否有优先支持特权
  hasPrioritySupport: boolean;
}

/**
 * 新增: 整合类型，包含上限和用量
 */
export interface FullQuotaInfo {
  limits: MembershipQuota; // 配额上限
  usage: QuotaUsage | null; // 实际用量 (可能为 null)
} 