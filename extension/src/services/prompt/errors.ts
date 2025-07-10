/**
 * 提示词服务错误代码
 */
export enum PromptErrorCode {
  // 验证错误 (1000-1999)
  VALIDATION_ERROR = 1000,
  INVALID_TITLE = 1001,
  INVALID_CONTENT = 1002,
  INVALID_TAGS = 1003,
  
  // 存储错误 (2000-2999)
  STORAGE_ERROR = 2000,
  STORAGE_LIMIT_EXCEEDED = 2001,
  ITEM_NOT_FOUND = 2002,
  
  // 导入/导出错误 (3000-3999)
  IMPORT_ERROR = 3000,
  EXPORT_ERROR = 3001,
  
  // 其他错误 (9000-9999)
  UNKNOWN_ERROR = 9000
}

/**
 * 提示词服务错误类
 */
export class PromptError extends Error {
  code: PromptErrorCode;
  field?: string;
  
  constructor(message: string, code: PromptErrorCode, field?: string) {
    super(message);
    this.name = 'PromptError';
    this.code = code;
    this.field = field;
    
    // 确保原型链正确
    Object.setPrototypeOf(this, PromptError.prototype);
  }
  
  /**
   * 创建验证错误
   */
  static validation(message: string, field?: string): PromptError {
    return new PromptError(message, PromptErrorCode.VALIDATION_ERROR, field);
  }
  
  /**
   * 创建存储错误
   */
  static storage(message: string, code = PromptErrorCode.STORAGE_ERROR): PromptError {
    return new PromptError(message, code);
  }
  
  /**
   * 创建"未找到项目"错误
   */
  static notFound(id: string): PromptError {
    return new PromptError(`找不到ID为${id}的提示词`, PromptErrorCode.ITEM_NOT_FOUND);
  }
  
  /**
   * 创建存储限制错误
   */
  static limitExceeded(message: string): PromptError {
    return new PromptError(message, PromptErrorCode.STORAGE_LIMIT_EXCEEDED);
  }
  
  /**
   * 创建导入错误
   */
  static import(message: string): PromptError {
    return new PromptError(message, PromptErrorCode.IMPORT_ERROR);
  }
  
  /**
   * 创建导出错误
   */
  static export(message: string): PromptError {
    return new PromptError(message, PromptErrorCode.EXPORT_ERROR);
  }
} 