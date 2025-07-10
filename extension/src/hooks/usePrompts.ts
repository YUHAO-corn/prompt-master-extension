import { useState, useCallback, useEffect } from 'react';
import { 
  Prompt, 
  PromptFilter,
  CreatePromptInput
} from '../services/prompt';
import { usePromptsData } from './usePromptsData';

export type UpdatePromptInput = Partial<Omit<Prompt, 'id' | 'createdAt'>>; 

/**
 * 提示词Hook，用于组件中管理提示词数据
 * 提供提示词的CRUD操作，以及搜索、排序等功能
 * @deprecated 使用usePromptsData替代，该Hook提供更完整的提示词管理功能
 */
export function usePrompts() {
  // 使用新的usePromptsData来实现所有功能
  const {
    prompts,
    loading,
    error,
    searchPrompts: search,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    refresh
  } = usePromptsData();
  
  // 生成唯一ID (UUID v4格式)
  const generateId = useCallback((): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }, []);
  
  // 搜索提示词 - 保持旧API兼容性
  const searchPromptsHook = useCallback(async (keyword: string, filter?: Partial<PromptFilter>): Promise<Prompt[]> => {
    // 兼容旧版API格式
    return search({ 
      searchTerm: keyword,
      ...(filter || {})
    });
  }, [search]);
  
  // 增加提示词使用次数 - 确保与旧版接口兼容
  const incrementPromptUseHook = useCallback(async (id: string): Promise<void> => {
    try {
      // 使用updatePrompt来增加使用次数
      const prompt = prompts.find(p => p.id === id);
      if (prompt) {
        await updatePrompt(id, { 
          useCount: (prompt.useCount || 0) + 1,
          lastUsed: Date.now()
        });
        
        // 🚀 Analytics埋点：追踪通过usePrompts hook的提示词使用
        try {
          const { trackPromptAction } = await import('../services/analytics');
          trackPromptAction('used', id, {
            title: prompt.title,
            category: prompt.category,
            source: prompt.source || 'usePrompts_hook',
            useCount: (prompt.useCount || 0) + 1,
            tags: prompt.tags,
            context: 'usePrompts_hook'
          });
        } catch (analyticsError) {
          console.error('[Analytics] Failed to track prompt usage via usePrompts:', analyticsError);
        }
      }
    } catch (err) {
      console.error('Failed to increment prompt use count:', err);
    }
  }, [prompts, updatePrompt]);

  return {
    prompts,
    loading,
    error,
    searchPrompts: searchPromptsHook,
    incrementPromptUse: incrementPromptUseHook,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    generateId,
    refreshPrompts: refresh
  };
}

// 重新导出Prompt类型，方便组件使用
export type { Prompt } from '../services/prompt'; 