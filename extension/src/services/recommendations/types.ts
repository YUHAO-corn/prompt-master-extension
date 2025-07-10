/**
 * 推荐提示词数据结构
 */
export interface RecommendedPrompt {
  /** 唯一标识符 */
  id: string;
  
  /** 标题 */
  title: string;
  
  /** 内容 */
  content: string;
  
  /** 创建时间 (硬编码为早期日期) */
  createdAt: number;
  
  /** 使用次数 (硬编码为0) */
  useCount: number;
  
  /** 标签列表 (可选，预留未来扩展) */
  tags?: string[];
  
  /** 分类 (可选，预留未来扩展) */
  category?: string;
} 