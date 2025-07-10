// 存储键名常量
export const STORAGE_KEYS = {
  PROMPT_PREFIX: 'prompt_',
  PROMPTS: 'aetherflow_prompts',
  SETTINGS: 'aetherflow_settings',
  USER: 'aetherflow_user',
  HISTORY: 'aetherflow_history',
  SYNC_STATUS: 'aetherflow_sync_status', // 同步状态
  PENDING_OPERATIONS: 'aetherflow_pending_operations', // 待处理操作
  LAST_SYNC_TIME: 'aetherflow_last_sync_time', // 最后同步时间
  MEMBERSHIP: 'aetherflow_membership' // 会员状态
};

// 存储限制常量
export const STORAGE_LIMITS = {
  // Chrome存储限制 (字节数)
  SYNC_STORAGE_MAX_BYTES: 102400, // 100KB
  LOCAL_STORAGE_MAX_BYTES: 5242880, // 5MB
  
  // 业务逻辑限制
  MAX_PROMPTS: 100,
  MAX_PROMPT_LENGTH: 8000,
  MAX_TITLE_LENGTH: 50,
  
  // 云存储相关
  MAX_PENDING_OPERATIONS: 1000, // 最大待处理操作数量
  MAX_BATCH_SIZE: 500, // 最大批处理大小
  SYNC_INTERVAL: 60000, // 自动同步间隔 (毫秒)

  // 会员相关限制
  FREE_MAX_PROMPTS: 5, // 免费版最大提示词数量
  PRO_MAX_PROMPTS: 100, // 专业版最大提示词数量
  FREE_DAILY_OPTIMIZATIONS: 3, // 免费版每日优化次数
  PRO_DAILY_OPTIMIZATIONS: 50 // 专业版每日优化次数
}; 