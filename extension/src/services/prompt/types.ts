export interface Prompt {
  /** 提示词唯一ID */
  id: string;
  
  /** 提示词标题 */
  title: string;
  
  /** 提示词内容 */
  content: string;
  
  /** 收藏状态 */
  isFavorite?: boolean;
  
  /** 收藏状态 (兼容旧版) */
  favorite?: boolean;
  
  /** 创建时间 */
  createdAt: number;
  
  /** 更新时间 */
  updatedAt: number;
  
  /** 使用次数 */
  useCount: number;
  
  /** 最后使用时间 */
  lastUsed: number;
  
  /** 标签列表 */
  tags?: string[];
  
  /** 提示词来源 (user/optimize/predefined) */
  source?: 'user' | 'optimize' | 'predefined';
  
  /** 提示词分类 */
  category?: string;
  
  /** 提示词来源URL */
  sourceUrl?: string;
  
  /** 是否处于活跃状态，false表示被删除 */
  isActive?: boolean;
  
  /** 是否处于活跃状态，false表示被删除 (兼容旧版) */
  active?: boolean;
  
  /** 是否因配额限制而被锁定 */
  locked?: boolean;
  
  /** 提示词优化历史 */
  optimizationHistory?: Array<{
    version: number;
    content: string;
    timestamp: number;
  }>;
  
  /** 是否为系统推荐提示词 */
  isRecommended?: boolean;
}

/**
 * 提示词筛选选项
 */
export interface PromptFilter {
  /** 搜索关键词 */
  searchTerm?: string;
  
  /** 排序方式 */
  sortBy?: 'usage' | 'favorite' | 'time' | 'alphabetical' | 'relevance';
  
  /** 结果数量限制 */
  limit?: number;
  
  /** 结果偏移量，用于增量加载 */
  offset?: number;
  
  /** 分类筛选 */
  category?: string;
  
  /** 标签筛选 */
  tags?: string[];
  
  /** 是否只显示收藏 */
  onlyFavorites?: boolean;
  
  /** 是否只显示收藏 (兼容旧版) */
  favorite?: boolean;
  
  /** 是否包含已删除项目 */
  includeInactive?: boolean;
}

/**
 * 创建提示词的输入参数
 */
export interface CreatePromptInput {
  title?: string;
  content: string;
  isFavorite?: boolean;
  favorite?: boolean;
  tags?: string[];
  category?: string;
  source?: 'user' | 'optimize' | 'predefined';
  sourceUrl?: string;
}

/**
 * 更新提示词的输入参数
 */
export interface UpdatePromptInput {
  title?: string;
  content?: string;
  isFavorite?: boolean;
  favorite?: boolean;
  tags?: string[];
  category?: string;
  isActive?: boolean;
  active?: boolean;
  updatedAt?: number;
  optimizationHistory?: Array<{
    version: number;
    content: string;
    timestamp: number;
  }>;
}

/**
 * 提示词存储限制
 */
export const PROMPT_STORAGE_LIMITS = {
  /** 轻量级模式下的提示词数量上限 */
  LIGHTWEIGHT_MODE_MAX: 50,
  /** 提示词标题最大长度 */
  TITLE_MAX_LENGTH: 100,
  /** 提示词内容最大长度 */
  CONTENT_MAX_LENGTH: 10000,
  /** 标签最大数量 */
  MAX_TAGS: 10,
  /** 标签最大长度 */
  TAG_MAX_LENGTH: 20,
}; 