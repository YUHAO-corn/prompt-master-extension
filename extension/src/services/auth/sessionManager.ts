/**
 * 会话管理模块
 * 负责处理用户会话生命周期事件，特别是会话结束时的清理工作
 */

import { cloudStorageService } from '../storage/cloudStorage';
import { STORAGE_KEYS } from '../storage/constants';
import { authService } from './index';
import { chromeStorageService } from '../storage/chromeStorage';
import { safeLogger } from '@/utils/safeEnvironment';

// 提示词前缀，用于识别存储中的提示词项
const PROMPT_PREFIX = 'prompt_';

// 需要在会话结束时清理的所有存储键
// 这个列表应该包含所有用户特定的数据键
const USER_SPECIFIC_STORAGE_KEYS = [
  // 认证相关
  'auth_user', // 从 saveAuthStateToStorage 函数中获知
  
  // 会员信息相关
  STORAGE_KEYS.MEMBERSHIP, // 会员状态
  'last_sync_time',       // 上次同步时间
  
  // 用户特定的设置和偏好
  // 注意: 应用通用设置(如主题、语言等)不应删除
];

/**
 * 处理用户会话结束(登出、会话过期等)
 * 清理所有用户特定的数据和状态
 */
export const handleSessionEnd = async (): Promise<void> => {
  console.log('[SessionManager] 用户会话结束，开始清理状态...');
  
  try {
    // 1. 清理 chrome.storage.local 中的用户特定数据
    await clearUserSpecificStorage();
    
    // 2. 依次重置各个服务的状态
    
    // 重置云存储服务
    if (cloudStorageService && typeof cloudStorageService.reset === 'function') {
      await cloudStorageService.reset();
    } else {
      console.warn('[SessionManager] cloudStorageService 不存在或没有 reset 方法');
    }
    
    console.log('[SessionManager] 状态清理完成');
  } catch (error) {
    console.error('[SessionManager] 清理状态时发生错误:', error);
  }
};

/**
 * 清理 chrome.storage.local 中的用户特定数据
 */
const clearUserSpecificStorage = async (): Promise<void> => {
  try {
    console.log('[SessionManager] 清理本地存储中的用户数据...');
    
    // 移除明确列出的键
    if (USER_SPECIFIC_STORAGE_KEYS.length > 0) {
      await chrome.storage.local.remove(USER_SPECIFIC_STORAGE_KEYS);
    }
    
    // 同时清理所有提示词数据
    // 注意: 如果有些提示词需要保留(如默认提示词)，则需要更复杂的逻辑
    const allStorage = await chrome.storage.local.get(null);
    const promptKeys = Object.keys(allStorage).filter(
      key => key.startsWith(PROMPT_PREFIX)
    );
    
    if (promptKeys.length > 0) {
      await chrome.storage.local.remove(promptKeys);
    }
    
    console.log('[SessionManager] 本地存储清理完成');
  } catch (error) {
    console.error('[SessionManager] 清理本地存储失败:', error);
  }
};

/**
 * 处理用户登出逻辑
 * 清理用户特定的状态和服务
 */
export async function handleLogoutCleanup(): Promise<void> {
  safeLogger.log('[SessionManager] Handling logout cleanup...');
  
  // 清理用户相关数据
  // 注意：顺序可能很重要，例如先清理依赖的服务，最后清理认证
  
  try {
    // 1. 清理配额服务状态 (如果需要)
    // await quotaService.reset(); 
    safeLogger.log('[SessionManager] Quota service reset skipped/handled by auth listener.');
  } catch (error) {
    safeLogger.error('[SessionManager] Error resetting quota service:', error);
  }
  
  try {
    // 2. 清理会员服务状态 - REMOVED
    // membershipService.reset(); // Old reset call removed
    // CentralStateManager handles membership state reset based on auth changes.
    safeLogger.log('[SessionManager] Membership service reset handled by CentralStateManager.');
  } catch (error) {
    safeLogger.error('[SessionManager] Error resetting membership service (should not happen):', error);
  }
  
  try {
    // 3. 清理存储服务 (如果需要)
    // await storageService.reset(); 
    safeLogger.log('[SessionManager] Storage service reset skipped/handled by auth listener.');
  } catch (error) {
    safeLogger.error('[SessionManager] Error resetting storage service:', error);
  }
  
  // 4. 执行 Firebase 登出 (这会触发 onAuthStateChanged 监听器)
  try {
    await authService.logoutUser();
    safeLogger.log('[SessionManager] Firebase logout successful.');
  } catch (error) {
    safeLogger.error('[SessionManager] Firebase logout failed:', error);
    // 即便登出失败，也尝试清理本地状态
  }
  
  // Optional: Clear local session data AFTER attempting logout
  // try {
  //   await clearLocalSessionData();
  // } catch (error) {
  //   safeLogger.error('[SessionManager] Error clearing local session data after logout attempt:', error);
  // }

  safeLogger.log('[SessionManager] Logout cleanup process finished.');
}

// 其他 Session 管理相关逻辑...
// 例如: handleLogin, checkSessionValidity 等 