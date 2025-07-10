/**
 * 配额类型定义
 */
export type QuotaType = 'storage' | 'optimization';

/**
 * 配额限制定义
 * 定义了不同会员等级的各项功能限制
 */
export interface QuotaLimits {
  storage: number;       // 最大提示词存储数量
  optimizationsPerDay: number; // 每日优化次数
  // 可以根据需要添加更多配额项，例如：
  // dataExport: boolean; // 是否允许导出
}

/**
 * 用户配额使用情况
 * 存储用户的当前用量和重置信息
 */
export interface QuotaUsage {
  storageCount: number;            // 当前存储的提示词数量 (注意: 这个可能需要从 PromptService 或 Firestore 直接查询更准确)
  optimizationsUsedToday: number;  // 今天已使用的优化次数
  lastOptimizationReset: number; // 上次优化次数重置的时间戳 (UTC milliseconds)
}

/**
 * 单个配额项的状态
 */
export interface QuotaStatus {
  limit: number;
  usage: number;
}

/**
 * 默认的免费用户配额限制
 */
export const DEFAULT_FREE_QUOTA_LIMITS: QuotaLimits = {
  storage: 5,
  optimizationsPerDay: 3,
};

/**
 * Pro 会员配额限制
 */
export const DEFAULT_PRO_QUOTA_LIMITS: QuotaLimits = {
  storage: 100,
  optimizationsPerDay: 50,
};

/**
 * 默认的用户配额使用情况 (新用户或未记录时)
 */
export const DEFAULT_QUOTA_USAGE: QuotaUsage = {
  storageCount: 0, // 初始为 0，实际值可能需要查询
  optimizationsUsedToday: 0,
  lastOptimizationReset: 0, // 设置为 0 或一个过去的时间点，确保首次检查时能正确处理
};

/**
 * Firestore 中存储配额数据的文档路径片段
 */
export const FIRESTORE_QUOTA_PATH = 'quota/status'; 