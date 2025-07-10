import { 
  CreatePromptInput, 
  UpdatePromptInput, 
  Prompt,
  PROMPT_STORAGE_LIMITS 
} from './types';
import { PromptErrorCode } from './errors';

/**
 * 提示词验证结果
 */
export interface ValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误消息 */
  message?: string;
  /** 错误字段 */
  field?: string;
  /** 错误代码 */
  code?: PromptErrorCode;
}

/**
 * 提示词验证器
 * 用于验证提示词数据是否符合规范
 */
export class PromptValidator {
  /**
   * 验证创建提示词输入
   * @param input 创建提示词输入
   * @returns 验证结果
   * @throws PromptError 当验证失败时
   */
  static validateCreate(input: CreatePromptInput): ValidationResult {
    // 验证标题
    if (input.title !== undefined && input.title.trim() !== '') {
      // 只有当用户提供了标题时才验证长度
      if (input.title.length > PROMPT_STORAGE_LIMITS.TITLE_MAX_LENGTH) {
        return {
          valid: false,
          message: `标题不能超过${PROMPT_STORAGE_LIMITS.TITLE_MAX_LENGTH}个字符`,
          field: 'title',
          code: PromptErrorCode.INVALID_TITLE
        };
      }
    }
    
    // 验证内容
    if (!input.content || input.content.trim() === '') {
      return {
        valid: false,
        message: '内容不能为空',
        field: 'content',
        code: PromptErrorCode.INVALID_CONTENT
      };
    }
    
    if (input.content.length > PROMPT_STORAGE_LIMITS.CONTENT_MAX_LENGTH) {
      return {
        valid: false,
        message: `内容不能超过${PROMPT_STORAGE_LIMITS.CONTENT_MAX_LENGTH}个字符`,
        field: 'content',
        code: PromptErrorCode.INVALID_CONTENT
      };
    }
    
    // 验证标签
    if (input.tags && input.tags.length > PROMPT_STORAGE_LIMITS.MAX_TAGS) {
      return {
        valid: false,
        message: `标签数量不能超过${PROMPT_STORAGE_LIMITS.MAX_TAGS}个`,
        field: 'tags',
        code: PromptErrorCode.INVALID_TAGS
      };
    }
    
    if (input.tags) {
      for (let i = 0; i < input.tags.length; i++) {
        const tag = input.tags[i];
        if (!tag || tag.trim() === '') {
          return {
            valid: false,
            message: '标签不能为空',
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
        
        if (tag.length > PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH) {
          return {
            valid: false,
            message: `标签长度不能超过${PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH}个字符`,
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
      }
      
      // 验证标签是否有重复
      const uniqueTags = new Set(input.tags);
      if (uniqueTags.size !== input.tags.length) {
        return {
          valid: false,
          message: '标签不能重复',
          field: 'tags',
          code: PromptErrorCode.INVALID_TAGS
        };
      }
    }
    
    // 验证通过
    return { valid: true };
  }
  
  /**
   * 验证更新提示词输入
   * @param input 更新提示词输入
   * @returns 验证结果
   */
  static validateUpdate(input: UpdatePromptInput): ValidationResult {
    // 验证标题
    if (input.title !== undefined) {
      // 如果title设置为空字符串，允许通过（会触发自动生成）
      if (input.title.trim() !== '' && input.title.length > PROMPT_STORAGE_LIMITS.TITLE_MAX_LENGTH) {
        return {
          valid: false,
          message: `标题不能超过${PROMPT_STORAGE_LIMITS.TITLE_MAX_LENGTH}个字符`,
          field: 'title',
          code: PromptErrorCode.INVALID_TITLE
        };
      }
    }
    
    // 验证内容
    if (input.content !== undefined) {
      if (input.content.trim() === '') {
        return {
          valid: false,
          message: '内容不能为空',
          field: 'content',
          code: PromptErrorCode.INVALID_CONTENT
        };
      }
      
      if (input.content.length > PROMPT_STORAGE_LIMITS.CONTENT_MAX_LENGTH) {
        return {
          valid: false,
          message: `内容不能超过${PROMPT_STORAGE_LIMITS.CONTENT_MAX_LENGTH}个字符`,
          field: 'content',
          code: PromptErrorCode.INVALID_CONTENT
        };
      }
    }
    
    // 验证标签
    if (input.tags !== undefined) {
      if (input.tags.length > PROMPT_STORAGE_LIMITS.MAX_TAGS) {
        return {
          valid: false,
          message: `标签数量不能超过${PROMPT_STORAGE_LIMITS.MAX_TAGS}个`,
          field: 'tags',
          code: PromptErrorCode.INVALID_TAGS
        };
      }
      
      for (let i = 0; i < input.tags.length; i++) {
        const tag = input.tags[i];
        if (!tag || tag.trim() === '') {
          return {
            valid: false,
            message: '标签不能为空',
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
        
        if (tag.length > PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH) {
          return {
            valid: false,
            message: `标签长度不能超过${PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH}个字符`,
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
      }
      
      // 验证标签是否有重复
      const uniqueTags = new Set(input.tags);
      if (uniqueTags.size !== input.tags.length) {
        return {
          valid: false,
          message: '标签不能重复',
          field: 'tags',
          code: PromptErrorCode.INVALID_TAGS
        };
      }
    }
    
    // 验证通过
    return { valid: true };
  }
  
  /**
   * 验证提示词完整对象
   * @param prompt 提示词对象
   * @returns 验证结果
   */
  static validatePrompt(prompt: Prompt): ValidationResult {
    // 验证必要字段是否存在
    if (!prompt.id) {
      return {
        valid: false,
        message: 'ID不能为空',
        field: 'id',
        code: PromptErrorCode.VALIDATION_ERROR
      };
    }
    
    // 验证标题
    if (!prompt.title || prompt.title.trim() === '') {
      return {
        valid: false,
        message: '处理后的标题不能为空',
        field: 'title',
        code: PromptErrorCode.INVALID_TITLE
      };
    }
    
    // 验证内容
    if (!prompt.content || prompt.content.trim() === '') {
      return {
        valid: false,
        message: '内容不能为空',
        field: 'content',
        code: PromptErrorCode.INVALID_CONTENT
      };
    }
    
    // 验证时间戳
    if (!prompt.createdAt || typeof prompt.createdAt !== 'number') {
      return {
        valid: false,
        message: '创建时间无效',
        field: 'createdAt',
        code: PromptErrorCode.VALIDATION_ERROR
      };
    }
    
    if (!prompt.updatedAt || typeof prompt.updatedAt !== 'number') {
      return {
        valid: false,
        message: '更新时间无效',
        field: 'updatedAt',
        code: PromptErrorCode.VALIDATION_ERROR
      };
    }
    
    // 验证标签
    if (prompt.tags && prompt.tags.length > 0) {
      if (prompt.tags.length > PROMPT_STORAGE_LIMITS.MAX_TAGS) {
        return {
          valid: false,
          message: `标签数量不能超过${PROMPT_STORAGE_LIMITS.MAX_TAGS}个`,
          field: 'tags',
          code: PromptErrorCode.INVALID_TAGS
        };
      }
      
      // 检查标签是否有空值或超长
      for (const tag of prompt.tags) {
        if (!tag || tag.trim() === '') {
          return {
            valid: false,
            message: '标签不能为空',
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
        
        if (tag.length > PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH) {
          return {
            valid: false,
            message: `标签长度不能超过${PROMPT_STORAGE_LIMITS.TAG_MAX_LENGTH}个字符`,
            field: 'tags',
            code: PromptErrorCode.INVALID_TAGS
          };
        }
      }
      
      // 验证标签是否有重复
      const uniqueTags = new Set(prompt.tags);
      if (uniqueTags.size !== prompt.tags.length) {
        return {
          valid: false,
          message: '标签不能重复',
          field: 'tags',
          code: PromptErrorCode.INVALID_TAGS
        };
      }
    }
    
    // 验证优化历史
    if (prompt.optimizationHistory && prompt.optimizationHistory.length > 0) {
      for (const history of prompt.optimizationHistory) {
        if (typeof history.version !== 'number' || history.version <= 0) {
          return {
            valid: false,
            message: '优化版本号无效',
            field: 'optimizationHistory',
            code: PromptErrorCode.VALIDATION_ERROR
          };
        }
        
        if (!history.content || history.content.trim() === '') {
          return {
            valid: false,
            message: '优化内容不能为空',
            field: 'optimizationHistory',
            code: PromptErrorCode.VALIDATION_ERROR
          };
        }
        
        if (!history.timestamp || typeof history.timestamp !== 'number') {
          return {
            valid: false,
            message: '优化时间戳无效',
            field: 'optimizationHistory',
            code: PromptErrorCode.VALIDATION_ERROR
          };
        }
      }
    }
    
    // 验证通过
    return { valid: true };
  }
  
  /**
   * 验证轻量级模式下的提示词数量限制
   * @param currentCount 当前提示词数量
   * @returns 验证结果
   */
  static validateLightweightModeLimit(currentCount: number): ValidationResult {
    if (currentCount >= PROMPT_STORAGE_LIMITS.LIGHTWEIGHT_MODE_MAX) {
      return {
        valid: false,
        message: `轻量级模式下最多只能存储${PROMPT_STORAGE_LIMITS.LIGHTWEIGHT_MODE_MAX}个提示词`,
        field: 'count',
        code: PromptErrorCode.STORAGE_LIMIT_EXCEEDED
      };
    }
    
    return { valid: true };
  }
} 