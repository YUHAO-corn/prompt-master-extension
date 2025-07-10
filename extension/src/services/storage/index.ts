import { StorageArea, StorageService } from './types';
import { STORAGE_KEYS, STORAGE_LIMITS } from './constants';
import { chromeStorageService } from './chromeStorage';
import { mockStorageService } from './mockStorage';
import { cloudStorageService } from './cloudStorage';
import { Prompt } from '../prompt/types';
import { isServiceWorkerEnvironment, safeLogger } from '../../utils/safeEnvironment';

// 存储操作的最大重试次数
const MAX_RETRY_COUNT = 3;
// 重试延迟(毫秒)
const RETRY_DELAY = 500;

/**
 * 基础存储类
 * @deprecated 使用统一的 storageService 替代
 */
export class Storage {
  private area: StorageArea;

  constructor(area: StorageArea = 'sync') {
    this.area = area;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const storageArea = this.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      const result = await storageArea.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    let retries = 0;
    let lastError = null;

    // 加入重试逻辑，提高存储可靠性
    while (retries < MAX_RETRY_COUNT) {
      try {
        console.log(`[Storage] 尝试存储数据 (${retries > 0 ? '重试#' + retries : '首次'}):`, key);
        const storageArea = this.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
        await storageArea.set({ [key]: value });
        
        // 验证存储是否成功
        const verification = await this.get(key);
        if (!verification) {
          console.warn(`[Storage] 存储后验证失败，数据可能未正确保存:`, key);
          throw new Error('存储验证失败');
        }
        
        console.log(`[Storage] 数据存储成功:`, key);
        return; // 成功则退出
      } catch (error) {
        lastError = error;
        console.error(`[Storage] 存储错误 (尝试 ${retries + 1}/${MAX_RETRY_COUNT}):`, error);
        retries++;
        
        if (retries < MAX_RETRY_COUNT) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }
    
    // 所有重试都失败，抛出最后一个错误
    console.error(`[Storage] 存储彻底失败，已尝试 ${MAX_RETRY_COUNT} 次:`, key);
    throw lastError || new Error('存储操作失败');
  }

  async remove(key: string): Promise<void> {
    try {
      const storageArea = this.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storageArea.remove(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const storageArea = this.area === 'sync' ? chrome.storage.sync : chrome.storage.local;
      await storageArea.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
}

// 为了向后兼容，保留旧的实例
export const syncStorage = new Storage('sync');
export const localStorage = new Storage('local');

// --- 统一的存储服务实例 ---
// 根据运行环境选择存储服务:
// 1. 在Service Worker环境中，使用 chrome.storage API，它不依赖 window 对象
// 2. 在其他环境中使用 cloudStorageService，它提供云同步功能

// 确定要导出的存储服务
let selectedStorageService: StorageService;

if (isServiceWorkerEnvironment) {
  // Service Worker环境中使用 chrome.storage API，它不依赖 window 对象
  safeLogger.log('[Storage] 在Service Worker环境中使用ChromeStorageService');
  selectedStorageService = chromeStorageService;
} else {
  // 其他环境（如Popup, Content Script）中可以使用云存储服务
  safeLogger.log('[Storage] 在普通环境中使用CloudStorageService');
  selectedStorageService = cloudStorageService;
}

// 导出统一的存储服务实例
export const storageService: StorageService = selectedStorageService;

// 导出其他相关内容
export { STORAGE_KEYS, STORAGE_LIMITS };
export * from './types';
export * from './constants';

// 导出具体存储服务，用于特殊场景
export { chromeStorageService, mockStorageService, cloudStorageService };

// 已移除：异步 setStorageModeAsync 
// 已移除：setStorageMode - 依赖 window.localStorage

// 数据迁移函数 migratePromptsData
export async function migratePromptsData(): Promise<{migrated: boolean, count: number}> {
  try {
    // 检查是否存在旧格式数据
    const oldPrompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS);
    
    // 如果没有旧数据或数组为空，则返回
    if (!oldPrompts || oldPrompts.length === 0) {
      console.log('[Storage] 未发现旧格式数据，无需迁移');
      return { migrated: false, count: 0 };
    }
    
    console.log(`[Storage] 发现${oldPrompts.length}条旧格式提示词数据，开始迁移`);
    
    // 迁移每个提示词到新格式
    let migratedCount = 0;
    
    for (const prompt of oldPrompts) {
      if (!prompt.id) continue; // 跳过没有ID的提示词
      
      // 使用新格式保存
      const key = `prompt_${prompt.id}`;
      
      // 确保所有必要字段存在
      const now = Date.now();
      const completePrompt: Prompt = {
        ...prompt,
        createdAt: prompt.createdAt || now,
        updatedAt: prompt.updatedAt || now,
        useCount: prompt.useCount || 0,
        isFavorite: Boolean(prompt.isFavorite || prompt.favorite),
        favorite: Boolean(prompt.isFavorite || prompt.favorite),
        lastUsed: prompt.lastUsed || 0,
        isActive: prompt.isActive !== false
      };
      
      // 使用Chrome Storage API直接保存，避免循环调用
      await chrome.storage.local.set({ [key]: completePrompt });
      migratedCount++;
    }
    
    // 迁移完成后，清空旧数据
    if (migratedCount > 0) {
      await storageService.remove(STORAGE_KEYS.PROMPTS);
      console.log(`[Storage] 成功迁移${migratedCount}条提示词数据到新格式`);
    }
    
    return { migrated: true, count: migratedCount };
  } catch (error) {
    console.error('[Storage] 数据迁移失败:', error);
    return { migrated: false, count: 0 };
  }
}
