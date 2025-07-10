import { storageService, STORAGE_KEYS } from '../storage';
import { Prompt, PromptFilter, PROMPT_STORAGE_LIMITS } from './types';
import { PromptError, PromptErrorCode } from './errors';

/**
 * 提示词存储服务
 * 提供专门用于提示词数据的存储、检索和管理功能
 */
export class PromptStorageService {
  /**
   * 获取所有提示词
   * @param filter 过滤选项
   * @returns 提示词数组
   */
  public async getPrompts(filter?: PromptFilter): Promise<Prompt[]> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      
      let filteredPrompts = [...prompts];
      
      if (filter?.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        filteredPrompts = filteredPrompts.filter(prompt => 
          prompt.title.toLowerCase().includes(term) || 
          prompt.content.toLowerCase().includes(term)
        );
      }
      
      // 收藏过滤
      if (filter?.favorite) {
        filteredPrompts = filteredPrompts.filter(prompt => prompt.favorite);
      }
      
      // 排序
      if (filter?.sortBy) {
        switch (filter.sortBy) {
          case 'usage':
            filteredPrompts.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
            break;
          case 'favorite':
            filteredPrompts.sort((a, b) => (a.favorite === b.favorite) ? 0 : a.favorite ? -1 : 1);
            break;
          case 'time':
            filteredPrompts.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
            break;
        }
      }
      
      // 限制数量
      if (filter?.limit) {
        filteredPrompts = filteredPrompts.slice(0, filter.limit);
      }
      
      return filteredPrompts;
    } catch (error) {
      console.error('[PromptStorage] 获取提示词失败:', error);
      throw new PromptError('获取提示词失败', PromptErrorCode.STORAGE_ERROR);
    }
  }

  /**
   * 通过ID获取提示词
   * @param id 提示词ID
   * @returns 提示词对象或null
   */
  public async getPromptById(id: string): Promise<Prompt | null> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      return prompts.find(prompt => prompt.id === id) || null;
    } catch (error) {
      console.error(`[PromptStorage] 获取提示词(ID:${id})失败:`, error);
      throw new PromptError('获取提示词失败', PromptErrorCode.STORAGE_ERROR);
    }
  }

  /**
   * 保存提示词(添加新提示词或更新现有提示词)
   * @param prompt 要保存的提示词
   * @returns 保存的提示词
   */
  public async savePrompt(prompt: Prompt): Promise<Prompt> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      
      // 查找是否存在该提示词
      const index = prompts.findIndex(p => p.id === prompt.id);
      
      if (index >= 0) {
        // 更新现有提示词
        prompts[index] = {
          ...prompts[index],
          ...prompt,
          updatedAt: Date.now()
        };
      } else {
        // 添加新提示词
        prompts.push(prompt);
      }
      
      // 保存到存储
      await storageService.set(STORAGE_KEYS.PROMPTS, prompts);
      
      return prompt;
    } catch (error) {
      console.error('[PromptStorage] 保存提示词失败:', error);
      throw new PromptError('保存提示词失败', PromptErrorCode.STORAGE_ERROR);
    }
  }

  /**
   * 删除提示词
   * @param id 提示词ID
   * @returns 是否成功
   */
  public async deletePrompt(id: string): Promise<boolean> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      const newPrompts = prompts.filter(p => p.id !== id);
      
      if (newPrompts.length === prompts.length) {
        // 未找到要删除的提示词
        return false;
      }
      
      // 保存到存储
      await storageService.set(STORAGE_KEYS.PROMPTS, newPrompts);
      
      return true;
    } catch (error) {
      console.error(`[PromptStorage] 删除提示词(ID:${id})失败:`, error);
      throw new PromptError('删除提示词失败', PromptErrorCode.STORAGE_ERROR);
    }
  }

  /**
   * 增加提示词使用次数
   * @param id 提示词ID
   * @returns 是否成功
   */
  public async incrementPromptUse(id: string): Promise<boolean> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      const index = prompts.findIndex(p => p.id === id);
      
      if (index === -1) {
        // 未找到提示词
        return false;
      }
      
      // 更新使用次数和最后使用时间
      prompts[index] = {
        ...prompts[index],
        useCount: (prompts[index].useCount || 0) + 1,
        lastUsed: Date.now()
      };
      
      // 保存到存储
      await storageService.set(STORAGE_KEYS.PROMPTS, prompts);
      
      return true;
    } catch (error) {
      console.error(`[PromptStorage] 增加提示词使用次数(ID:${id})失败:`, error);
      throw new PromptError('增加提示词使用次数失败', PromptErrorCode.STORAGE_ERROR);
    }
  }

  /**
   * 切换提示词收藏状态
   * @param id 提示词ID
   * @returns 是否成功
   */
  public async toggleFavorite(id: string): Promise<boolean> {
    try {
      const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
      const index = prompts.findIndex(p => p.id === id);
      
      if (index === -1) {
        // 未找到提示词
        return false;
      }
      
      // 检查当前收藏状态
      const currentFavorite = prompts[index].favorite || prompts[index].isFavorite;
      
      if (currentFavorite) {
        // 如果当前是收藏状态，则删除此提示词
        const newPrompts = prompts.filter(p => p.id !== id);
        await storageService.set(STORAGE_KEYS.PROMPTS, newPrompts);
      } else {
        // 如果当前不是收藏状态，则设为收藏
        prompts[index] = {
          ...prompts[index],
          favorite: true,
          isFavorite: true
        };
        await storageService.set(STORAGE_KEYS.PROMPTS, prompts);
      }
      
      return true;
    } catch (error) {
      console.error(`[PromptStorage] 切换提示词收藏状态(ID:${id})失败:`, error);
      throw new PromptError('切换提示词收藏状态失败', PromptErrorCode.STORAGE_ERROR);
    }
  }
}

// 创建并导出提示词存储服务实例
export const promptStorageService = new PromptStorageService(); 