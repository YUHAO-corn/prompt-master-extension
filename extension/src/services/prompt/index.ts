import { 
  Prompt, 
  PromptFilter, 
  CreatePromptInput, 
  UpdatePromptInput,
  PROMPT_STORAGE_LIMITS
} from './types';
import { 
  getPrompts, 
  searchPrompts, 
  incrementPromptUse,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  purgePrompt,
  toggleFavorite,
  addOptimizationHistory,
  exportPrompts,
  importPrompts
} from './actions';
import { PromptValidator, ValidationResult } from './validator';
import { PromptError, PromptErrorCode } from './errors';
import { 
  searchPromptsByMessaging, 
  incrementPromptUseByMessaging,
  promptMessagingService,
  PROMPT_MESSAGE_TYPES,
  notifyPromptUpdated
} from './messaging';
import { promptStorageService } from './storage';

// 导出类型
export type { 
  Prompt, 
  PromptFilter,
  CreatePromptInput,
  UpdatePromptInput,
  ValidationResult
};

// 导出常量
export { PROMPT_STORAGE_LIMITS, PROMPT_MESSAGE_TYPES };

// 导出错误类
export { PromptError, PromptErrorCode };

// 导出验证器
export { PromptValidator };

// 导出接口函数
export { 
  getPrompts, 
  searchPrompts, 
  incrementPromptUse,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  purgePrompt,
  toggleFavorite,
  addOptimizationHistory,
  exportPrompts,
  importPrompts
};

// 导出消息处理相关函数
export {
  searchPromptsByMessaging,
  incrementPromptUseByMessaging,
  notifyPromptUpdated
}; 

// 导出服务
export { promptMessagingService, promptStorageService }; 