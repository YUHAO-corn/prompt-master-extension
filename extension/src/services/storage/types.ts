export type StorageArea = 'sync' | 'local';

import { Prompt } from '../prompt/types';

/**
 * 统一存储服务接口
 * 提供对各类数据的存储和检索功能
 */
export interface StorageService {
  // 提示词相关操作
  getPrompt(id: string): Promise<Prompt | null>;
  getAllPrompts(): Promise<Prompt[]>;
  savePrompt(prompt: Prompt): Promise<void>;
  updatePrompt(id: string, updates: Partial<Prompt>): Promise<void>;
  deletePrompt(id: string): Promise<void>;
  incrementUseCount(id: string): Promise<void>;
  
  // 通用存储操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
} 