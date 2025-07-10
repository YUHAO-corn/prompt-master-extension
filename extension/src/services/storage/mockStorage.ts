import { StorageService } from './types';
import { Prompt } from '../prompt/types';
import { v4 as uuidv4 } from 'uuid';

// 从prompt/mock导入初始数据
import { mockPrompts as initialPrompts } from '../prompt/mock';

/**
 * 内存中模拟存储的数据
 */
const mockStorage = new Map<string, any>();

// 初始化存储数据
initialPrompts.forEach(prompt => {
  mockStorage.set(`prompt_${prompt.id}`, {...prompt});
});

/**
 * 基于内存的模拟存储服务实现
 * 用于开发环境和测试
 */
export class MockStorageService implements StorageService {
  // 提示词相关操作
  
  /**
   * 获取单个提示词
   * @param id 提示词ID 
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    const key = `prompt_${id}`;
    return mockStorage.get(key) || null;
  }
  
  /**
   * 获取所有提示词
   */
  async getAllPrompts(): Promise<Prompt[]> {
    const prompts: Prompt[] = [];
    
    // 收集所有提示词数据
    for (const [key, value] of mockStorage.entries()) {
      if (key.startsWith('prompt_') && value.isActive !== false) {
        prompts.push(value as Prompt);
      }
    }
    
    return prompts;
  }
  
  /**
   * 保存提示词
   * @param prompt 提示词对象
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    if (!prompt.id) {
      throw new Error('提示词ID是必需的');
    }
    
    // 确保所有必要字段存在
    const now = Date.now();
    const completePrompt: Prompt = {
      ...prompt,
      createdAt: prompt.createdAt || now,
      updatedAt: now,
      useCount: prompt.useCount || 0,
      isFavorite: Boolean(prompt.isFavorite || prompt.favorite),
      favorite: Boolean(prompt.isFavorite || prompt.favorite),
      lastUsed: prompt.lastUsed || 0,
      isActive: prompt.isActive !== false
    };
    
    const key = `prompt_${prompt.id}`;
    mockStorage.set(key, completePrompt);
    
    // 触发自定义事件，模拟存储变化通知
    this.dispatchStorageEvent(key, completePrompt);
  }
  
  /**
   * 更新提示词
   * @param id 提示词ID
   * @param updates 要更新的字段
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      throw new Error(`提示词ID ${id} 不存在`);
    }
    
    // 合并更新
    const updatedPrompt = {
      ...prompt,
      ...updates,
      updatedAt: Date.now()
    };
    
    // 同步更新isFavorite和favorite字段
    if ('isFavorite' in updates && updates.isFavorite !== undefined) {
      updatedPrompt.favorite = updates.isFavorite;
    } else if ('favorite' in updates && updates.favorite !== undefined) {
      updatedPrompt.isFavorite = updates.favorite;
    }
    
    const key = `prompt_${id}`;
    mockStorage.set(key, updatedPrompt);
    
    // 触发自定义事件，模拟存储变化通知
    this.dispatchStorageEvent(key, updatedPrompt);
  }
  
  /**
   * 删除提示词(软删除)
   * @param id 提示词ID
   */
  async deletePrompt(id: string): Promise<void> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      return; // 提示词不存在，视为删除成功
    }
    
    // 软删除: 将isActive标记为false
    await this.updatePrompt(id, { 
      isActive: false, 
      active: false 
    });
  }
  
  /**
   * 增加提示词使用次数
   * @param id 提示词ID
   */
  async incrementUseCount(id: string): Promise<void> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      return; // 提示词不存在，忽略操作
    }
    
    await this.updatePrompt(id, {
      useCount: (prompt.useCount || 0) + 1,
      lastUsed: Date.now()
    });
  }
  
  // 通用存储操作
  
  /**
   * 获取存储值
   * @param key 键名
   */
  async get<T>(key: string): Promise<T | null> {
    return mockStorage.get(key) || null;
  }
  
  /**
   * 设置存储值
   * @param key 键名
   * @param value 值
   */
  async set<T>(key: string, value: T): Promise<void> {
    mockStorage.set(key, value);
    this.dispatchStorageEvent(key, value);
  }
  
  /**
   * 删除存储值
   * @param key 键名
   */
  async remove(key: string): Promise<void> {
    mockStorage.delete(key);
    this.dispatchStorageEvent(key, undefined);
  }
  
  /**
   * 清空存储
   */
  async clear(): Promise<void> {
    mockStorage.clear();
    this.dispatchStorageEvent('all', undefined);
  }
  
  /**
   * 触发自定义存储事件，模拟Chrome存储变化事件
   */
  private dispatchStorageEvent(key: string, newValue: any): void {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('mock-storage-changed', {
        detail: { 
          key, 
          newValue,
          // 模拟Chrome存储变化格式
          changes: {
            [key]: { newValue }
          }
        }
      });
      window.dispatchEvent(event);
    }
  }
}

// 创建默认实例
export const mockStorageService = new MockStorageService(); 