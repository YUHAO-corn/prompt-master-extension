/**
 * 优化服务类型定义
 */

/**
 * 优化版本数据结构
 */
export interface OptimizationVersion {
  id: number;
  content: string;
  isLoading?: boolean;
  isNew?: boolean;
  editedContent?: string;
  isEdited?: boolean;
  createdAt?: number;
  parentId?: number;
}

/**
 * 优化服务错误
 */
export class OptimizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimizationError';
  }
} 