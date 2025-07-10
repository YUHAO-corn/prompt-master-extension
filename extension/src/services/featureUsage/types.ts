// 功能类型枚举 - 定义所有需要追踪的功能
export enum FeatureType {
  // 提示词相关功能
  PROMPT_CREATE = 'prompt_create',
  PROMPT_CAPTURE = 'prompt_capture',           // 剪藏创建
  PROMPT_SAVE_FROM_OPTIMIZE = 'prompt_save_from_optimize', // 优化后保存
  PROMPT_COPY = 'prompt_copy',                 // 复制使用
  PROMPT_SHORTCUT_INSERT = 'prompt_shortcut_insert', // 快捷输入插入
  PROMPT_OPTIMIZE = 'prompt_optimize', 
  PROMPT_SHORTCUT = 'prompt_shortcut',
  PROMPT_EXPORT = 'prompt_export',
  PROMPT_FAVORITE = 'prompt_favorite',
  PROMPT_USE = 'prompt_use',
  
  // 其他功能
  CLOUD_SYNC = 'cloud_sync',
  // 后续可以扩展更多功能类型
}

// 功能使用记录
export interface FeatureUsageRecord {
  userId: string;
  featureType: FeatureType;
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, any>; // 功能特定的额外信息
}

// 功能使用结果
export interface FeatureUsageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  recordId?: string; // 用于后续查询或分析
}

// 功能使用选项 - 简化版，只管追踪
export interface FeatureUsageOptions {
  skipTracking?: boolean; // 跳过使用追踪（调试或特殊情况）
  metadata?: Record<string, any>; // 额外的追踪数据
}

// 功能执行函数类型
export type FeatureExecutor<T = any> = () => Promise<T>; 