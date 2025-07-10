import { StorageService } from './types';
import { Prompt } from '../prompt/types';
import { v4 as uuidv4 } from 'uuid';
import { safeLogger } from '../../utils/safeEnvironment';
import { sendMessage } from '../../services/messaging';
import { MessageType } from '../../services/messaging/types';

// 存储键名常量
const STORAGE_KEYS = {
  PROMPT_PREFIX: 'prompt_',
  SETTINGS: 'settings',
  VERSION: 'version'
};

/**
 * 基于Chrome Storage API的存储服务实现
 */
export class ChromeStorageService implements StorageService {
  // 提示词相关操作
  
  /**
   * 获取单个提示词
   * @param id 提示词ID 
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    try {
      const key = `${STORAGE_KEYS.PROMPT_PREFIX}${id}`;
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error(`[ChromeStorage] 获取提示词失败:`, error);
      return null;
    }
  }
  
  /**
   * 获取所有提示词
   */
  async getAllPrompts(): Promise<Prompt[]> {
    try {
      const result = await chrome.storage.local.get(null);
      
      // 过滤所有提示词数据
      return Object.entries(result)
        .filter(([key]) => key.startsWith(STORAGE_KEYS.PROMPT_PREFIX))
        .map(([_, value]) => value as Prompt)
        .filter(prompt => prompt.isActive !== false); // 排除已删除的提示词
    } catch (error) {
      console.error(`[ChromeStorage] 获取所有提示词失败:`, error);
      return [];
    }
  }
  
  /**
   * 保存提示词
   * @param prompt 提示词对象
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    if (!prompt.id) {
      console.error('[ChromeStorage] 提示词ID缺失，无法保存');
      throw new Error('提示词ID是必需的');
    }
    
    try {
      // console.log(`[ChromeStorage] 开始保存提示词: ID=${prompt.id}, 标题=${prompt.title}, 内容长度=${prompt.content.length}`); // 精简日志
      
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
      
      const key = `${STORAGE_KEYS.PROMPT_PREFIX}${prompt.id}`;
      // console.log(`[ChromeStorage] 将提示词保存到键名: ${key}`); // 精简日志
      
      await chrome.storage.local.set({ [key]: completePrompt });
      
      // 验证保存是否成功
      const savedPrompt = await this.getPrompt(prompt.id);
      if (!savedPrompt) {
        console.error(`[ChromeStorage] 保存后未能读取提示词: ID=${prompt.id}`);
        throw new Error('提示词保存失败，无法验证存储结果');
      }
      
      // --- 通知前端 --- 
      try {
        // 使用 PROMPT_UPDATED 覆盖新增和更新场景
        await sendMessage({ type: 'PROMPT_UPDATED', payload: savedPrompt });
        safeLogger.log(`[ChromeStorage] Sent PROMPT_UPDATED message for ID: ${prompt.id}`);
      } catch (msgError) {
        safeLogger.error('[ChromeStorage] 发送提示词保存/更新通知失败:', msgError);
        // 通常不应因为消息发送失败而使整个操作失败
      }
      // --- 通知结束 ---
      
    } catch (error) {
      console.error(`[ChromeStorage] 保存提示词失败:`, error);
      // 记录更详细的错误信息
      if (error instanceof Error) {
        console.error(`[ChromeStorage] 错误详情: ${error.name}: ${error.message}`);
        console.error(`[ChromeStorage] 错误堆栈: ${error.stack}`);
      }
      throw error;
    }
  }
  
  /**
   * 更新提示词
   * @param id 提示词ID
   * @param updates 要更新的字段
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<void> {
    try {
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
      
      await this.savePrompt(updatedPrompt);
    } catch (error) {
      console.error(`[ChromeStorage] 更新提示词失败:`, error);
      throw error;
    }
  }
  
  /**
   * 删除提示词(软删除)
   * @param id 提示词ID
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      const prompt = await this.getPrompt(id);
      if (!prompt) {
        return; // 提示词不存在，视为删除成功
      }
      
      // 软删除: 将isActive标记为false
      await this.updatePrompt(id, { 
        isActive: false,
        active: false
      });

      // --- 通知前端 --- 
      try {
        // 明确断言类型为 MessageType 来解决 Linter 误报
        await sendMessage({ type: 'DELETE_PROMPT' as MessageType, payload: { id } }); 
        safeLogger.log(`[ChromeStorage] Sent PROMPT_DELETED message for ID: ${id}`);
      } catch (msgError) {
        safeLogger.error('[ChromeStorage] 发送提示词删除通知失败:', msgError);
      }
      // --- 通知结束 ---

    } catch (error) {
      console.error(`[ChromeStorage] 删除提示词失败:`, error);
      throw error;
    }
  }
  
  /**
   * 增加提示词使用次数
   * @param id 提示词ID
   */
  async incrementUseCount(id: string): Promise<void> {
    try {
      const prompt = await this.getPrompt(id);
      if (!prompt) {
        return; // 提示词不存在，忽略操作
      }
      
      await this.updatePrompt(id, {
        useCount: (prompt.useCount || 0) + 1,
        lastUsed: Date.now()
      });
    } catch (error) {
      console.error(`[ChromeStorage] 增加提示词使用次数失败:`, error);
      // 不抛出异常，避免影响用户体验
    }
  }
  
  /**
   * 批量更新本地提示词的 locked 状态
   * @param promptIds 要更新的提示词 ID 列表
   * @param locked 新的 locked 状态值
   */
  async batchUpdateLocalPromptLockedStatus(promptIds: string[], locked: boolean): Promise<void> {
    // 添加日志:
    safeLogger.log(`[ChromeStorageService] batchUpdateLocalPromptLockedStatus called. IDs count: ${promptIds?.length}, Setting locked=${locked}`);
    if (!promptIds || promptIds.length === 0) {
      safeLogger.log('[ChromeStorageService] batchUpdateLocalPromptLockedStatus: No IDs provided, exiting.'); // Add log
      return; // 没有需要更新的 ID
    }

    // console.log(`[ChromeStorage] Starting batch update for locked status. IDs: ${promptIds.length}, locked: ${locked}`); // 使用 safeLogger 替代

    try {
      // 1. 获取所有需要更新的提示词的当前状态
      const keysToGet = promptIds.map(id => `${STORAGE_KEYS.PROMPT_PREFIX}${id}`);
      safeLogger.log(`[ChromeStorageService] batchUpdateLocal: Fetching current states for ${keysToGet.length} keys.`); // Add log
      const currentPromptsData = await chrome.storage.local.get(keysToGet);
      safeLogger.log(`[ChromeStorageService] batchUpdateLocal: Fetched current states.`); // Add log

      // 2. 准备批量更新操作
      const updates: { [key: string]: Prompt } = {};
      let updatedCount = 0;
      let notFoundCount = 0;
      let alreadySetCount = 0;

      promptIds.forEach(id => {
        const key = `${STORAGE_KEYS.PROMPT_PREFIX}${id}`;
        const currentPrompt = currentPromptsData[key] as Prompt | undefined;

        if (currentPrompt) {
          if (currentPrompt.locked !== locked) {
            updates[key] = {
              ...currentPrompt,
              locked: locked,
              updatedAt: Date.now()
            };
            updatedCount++;
          } else {
            alreadySetCount++;
          }
        } else {
          // safeLogger.warn(`[ChromeStorage] Prompt ID ${id} not found locally during batch update.`); // Use safeLogger
          notFoundCount++;
        }
      });
      safeLogger.log(`[ChromeStorageService] batchUpdateLocal: Calculated updates. Need update: ${updatedCount}, Already set: ${alreadySetCount}, Not found: ${notFoundCount}`); // Add log

      // 3. 执行批量更新 (如果需要)
      if (Object.keys(updates).length > 0) {
        // safeLogger.log(`[ChromeStorage] Applying batch update to ${updatedCount} prompts.`); // 使用 safeLogger
        safeLogger.log(`[ChromeStorageService] batchUpdateLocal: Applying batch update to ${updatedCount} prompts.`); // Add log
        await chrome.storage.local.set(updates);
        safeLogger.log(`[ChromeStorageService] batchUpdateLocal: Batch update for locked=${locked} completed successfully.`); // Add log
      } else {
        safeLogger.log(`[ChromeStorageService] batchUpdateLocal: No prompts needed status update for locked=${locked}.`); // Add log
      }

    } catch (error) {
      safeLogger.error(`[ChromeStorageService] batchUpdateLocal: 批量更新 locked 状态失败:`, error); // Add log
      // throw error; // Consider re-throwing based on requirements
    }
  }
  
  // 通用存储操作
  
  /**
   * 获取存储值
   * @param key 键名
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
    } catch (error) {
      console.error(`[ChromeStorage] 获取键 ${key} 失败:`, error);
      return null;
    }
  }
  
  /**
   * 设置存储值
   * @param key 键名
   * @param value 值
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`[ChromeStorage] 设置键 ${key} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 批量设置多个键值对
   * @param items 一个包含键值对的对象，键是存储的key，值是要存储的数据
   */
  async setMultiple(items: { [key: string]: any }): Promise<void> {
    if (Object.keys(items).length === 0) {
      return; // No items to set
    }
    safeLogger.log(`[ChromeStorage] Setting multiple items: ${Object.keys(items).length} keys`);
    try {
      await chrome.storage.local.set(items);
      safeLogger.log(`[ChromeStorage] Batch set successful.`);

      // --- 发送精确通知 --- 
      safeLogger.log(`[ChromeStorage] Sending individual notifications for prompt updates after batch set...`);
      let notificationCount = 0;
      for (const key in items) {
          // 检查键是否是提示词的键，并且值看起来像一个提示词对象
          if (key.startsWith(STORAGE_KEYS.PROMPT_PREFIX) && typeof items[key] === 'object' && items[key]?.id) {
              const promptData = items[key] as Prompt;
              try {
                  // 发送 PROMPT_UPDATED 消息
                  await sendMessage({ type: 'PROMPT_UPDATED', payload: promptData });
                  notificationCount++;
              } catch (msgError) {
                  // 只记录错误，不中断其他通知的发送
                  safeLogger.error(`[ChromeStorage] 发送提示词更新通知失败 (ID: ${promptData.id}) during batch update:`, msgError);
              }
          }
      }
      safeLogger.log(`[ChromeStorage] Sent ${notificationCount} PROMPT_UPDATED notifications.`);
      // --- 通知结束 --- 

    } catch (error) {
      console.error(`[ChromeStorage] 批量设置失败:`, error);
      throw error;
    }
  }
  
  /**
   * 删除存储值
   * @param key 键名
   */
  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error(`[ChromeStorage] 删除键 ${key} 失败:`, error);
      throw error;
    }
  }
  
  /**
   * 清空存储
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      // Consider sending a notification after clearing
    } catch (error) {
      console.error(`[ChromeStorage] 清除存储失败:`, error);
      throw error;
    }
  }
}

// 创建默认实例
export const chromeStorageService = new ChromeStorageService(); 