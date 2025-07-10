import { createPrompt, searchPrompts as searchPromptsService } from '../services/prompt'; // Assuming location, added searchPromptsService
import { storageService } from '../services/storage'; // Added import for storageService
import { safelySendNotification } from './notificationService'; // Added import
import { PromptFilter, CreatePromptInput, Prompt } from '../services/prompt/types'; // Import necessary types
import { PromptError, PromptErrorCode } from '../services/prompt/errors'; // Added import
import { recommendedPromptsService } from '../services/recommendations'; // 导入推荐提示词服务
import { adaptRecommendedArrayToPrompts } from '../services/recommendations'; // 导入推荐提示词适配器
import { FeatureType, featureUsageService } from '../services/featureUsage';

// 处理暂存的捕获请求 (供 keepAlive 调用)
export async function processPendingCaptures() {
  try {
    console.log('[AetherFlow] 检查暂存的捕获请求...');

    // 获取所有存储的键
    // Assuming storageService.getAll() returns all keys, or use chrome.storage.local directly
    // const storage = await storageService.getAll(); // Need to verify storageService capabilities
    const storage = await chrome.storage.local.get(null); // Using chrome API directly for now

    // 找出所有暂存的捕获请求
    const pendingKeys = Object.keys(storage).filter(key =>
      key.startsWith('temp_capture_') &&
      storage[key] &&
      storage[key].pendingCapture === true
    );

    if (pendingKeys.length === 0) {
      return; // 没有暂存的请求
    }

    console.log(`[AetherFlow] 发现${pendingKeys.length}个暂存的捕获请求，开始处理...`);

    // 处理每个暂存的请求
    for (const key of pendingKeys) {
      const captureData = storage[key];

      // 提取内容
      const content = captureData.content;

      if (!content || typeof content !== 'string' || content.trim() === '') {
        console.warn(`[AetherFlow] 暂存捕获请求 ${key} 内容为空，跳过`);
        // 删除无效的暂存请求
        await chrome.storage.local.remove(key); // Use await
        continue;
      }

      console.log(`[AetherFlow] 处理暂存的捕获请求 ${key}，内容长度: ${content.length}`);

      try {
        // 尝试保存提示词
        const result = await captureSelectionAsPrompt(content, {
          source: 'pending_restore',
          isToolbar: false
        }); // Call the function within this module

        if (result) {
          console.log(`[AetherFlow] 成功处理暂存的捕获请求 ${key}`);

          // 尝试向用户发送通知
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); // Use await
            if (tabs && tabs[0] && tabs[0].id) {
              await safelySendNotification( // Use await and imported function
                tabs[0].id,
                'Pending prompt has been saved to library',
                'success'
              );
              // console.warn('[PromptHandler] safelySendNotification call is commented out until dependency is resolved.'); // Removed temporary warning
            }
          } catch (notifyError) {
            console.warn('[AetherFlow] 发送通知失败:', notifyError);
          }
        } else {
          console.warn(`[AetherFlow] 处理暂存的捕获请求 ${key} 失败`);
        }
      } catch (error) {
        console.error(`[AetherFlow] 处理暂存的捕获请求 ${key} 出错:`, error);
        // 保留失败的请求，下次再试
        continue;
      }

      // 处理完成后删除暂存的请求
      await chrome.storage.local.remove(key); // Use await
    }
  } catch (error) {
    console.error('[AetherFlow] 处理暂存的捕获请求时出错:', error);
  }
}

// 将选中文本保存为提示词 (供消息处理器和 processPendingCaptures 调用)
export async function captureSelectionAsPrompt(
  content: string, 
  sourceContext: { sourceUrl?: string; isToolbar?: boolean; source?: string } = {}
): Promise<boolean> {
  const result = await featureUsageService.trackFeature(
    FeatureType.PROMPT_CAPTURE,
    async () => {
      try {
        // 记录更详细的日志
        console.log('[AetherFlow] 处理选中内容，准备保存为提示词:', {
          长度: content.length,
          包含换行符: content.includes('\n'),
          行数: content.split('\n').length,
          前30字符: content.substring(0, 30).replace(/\n/g, '\\\n'),
          sourceContext
        });

        if (!content || content.trim().length === 0) {
          console.warn('[AetherFlow] 内容为空或仅包含空白字符，不保存');
          return false;
        }

        console.log('[AetherFlow] 准备创建新提示词，保留原始格式...');

        const promptData = {
          content,
          isFavorite: true,
          favorite: true, // 兼容旧版
          source: 'user' as 'user',
          sourceUrl: sourceContext.sourceUrl
        };

        console.log('[AetherFlow] 创建提示词输入数据:', {
          contentLength: content.length,
          contentSample: content.substring(0, 50).replace(/\n/g, '\\\n') + (content.length > 50 ? '...' : ''),
          isFavorite: true,
          source: 'user',
          sourceUrl: sourceContext.sourceUrl
        });

        // 使用服务层创建提示词
        const newPrompt = await createPrompt(promptData);

        console.log('[AetherFlow] 提示词创建成功:', {
          id: newPrompt.id,
          title: newPrompt.title,
          contentLength: newPrompt.content.length,
          contentHasNewlines: newPrompt.content.includes('\n'),
          lineCount: newPrompt.content.split('\n').length,
          isFavorite: newPrompt.isFavorite
        });

        // 再次手动广播提示词更新消息，确保UI更新
        try {
          await chrome.runtime.sendMessage({ // Use await? Check if necessary
            type: 'PROMPT_UPDATED',
            from: 'capture_prompt',
            promptId: newPrompt.id
          });
          console.log('[AetherFlow] 已再次广播PROMPT_UPDATED消息通知UI更新');
        } catch (notifyError) {
          console.warn('[AetherFlow] 广播PROMPT_UPDATED消息失败:', notifyError);
        }

        return true;
      } catch (error) {
        console.error('[AetherFlow] 保存提示词失败:', error);
        if (error instanceof Error) {
          console.error('[AetherFlow] 错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
        }
        return false;
      }
    },
    {
      metadata: {
        contentLength: content.length,
        hasNewlines: content.includes('\n'),
        lineCount: content.split('\n').length,
        sourceUrl: sourceContext.sourceUrl,
        isToolbar: sourceContext.isToolbar,
        source: sourceContext.source
      }
    }
  );
  
  return result.data!;
}

/**
 * Handles the SAVE_PROMPT_CAPTURE message specifically.
 * Creates a new prompt using title and content from the payload.
 * 
 * @param payload - Expected to have { title: string, content: string, sourceUrl?: string }
 * @param sender - The message sender.
 * @param sendResponse - Callback function to send the response.
 */
export async function handleSavePromptCapture(
  payload: { title?: string; content?: string; sourceUrl?: string },
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[PromptHandler] Received SAVE_PROMPT_CAPTURE request');
  const { title, content, sourceUrl } = payload;

  if (!content || content.trim() === '') {
    console.error('[PromptHandler] Invalid payload: Content is missing or empty.');
    sendResponse({ success: false, error: 'Content is required' });
    return;
  }

  // Use provided title or generate a default one if missing
  const finalTitle = title && title.trim() !== '' ? title.trim() : content.substring(0, 30).replace(/\n/g, ' ') + '...';

  const promptData: CreatePromptInput = {
    title: finalTitle,
    content: content,
    isFavorite: true, // Default captured prompts to favorite
    source: 'user',
    sourceUrl: sourceUrl
  };

  try {
    // 使用 FeatureUsageService 包装保存操作以触发奖励系统
    const result = await featureUsageService.trackFeature(
      FeatureType.PROMPT_CAPTURE,
      async () => {
        const savedPrompt = await createPrompt(promptData); // Use the imported service function
        console.log('[PromptHandler] Prompt saved successfully via SAVE_PROMPT_CAPTURE:', savedPrompt.id);
        // Send prompt update message
        chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' }); 
        return savedPrompt;
      },
      {
        metadata: {
          contentLength: content.length,
          hasTitle: !!title,
          sourceUrl: sourceUrl,
          isToolbar: true, // 来自工具栏的剪藏操作
          source: 'capture_modal'
        }
      }
    );
    
    sendResponse({ success: true, data: result.data });
  } catch (error: any) {
    console.error('[PromptHandler] Error saving prompt via SAVE_PROMPT_CAPTURE:', error);
    if (error instanceof PromptError) { 
        sendResponse({ 
            success: false, 
            error: error.message, 
            code: error.code 
        });
    } else {
        sendResponse({ success: false, error: error.message || 'Failed to save prompt' });
    }
  }
  // sendResponse is handled asynchronously
}

/**
 * Handles searching prompts based on a filter.
 * Replaces the legacy search logic previously in listeners.
 * 
 * @param payload - Expected to be a PromptFilter object { searchTerm?: string, limit?: number, sortBy?: string, etc. }
 * @param sender - The message sender.
 * @param sendResponse - Callback function to send the response.
 */
export async function searchPrompts(
  payload: PromptFilter, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: Prompt[]) => void // Respond with an array of prompts
): Promise<void> {
  console.log('[PromptHandler] Received SEARCH_PROMPTS request with filter:', payload);
  try {
    // Use the prompt service for searching (assuming it handles filtering/sorting)
    // If searchPromptsService doesn't exist or doesn't handle filtering, 
    // we might need to fetch all and filter here like the old logic.
    
    // Option 1: Assuming searchPromptsService handles filtering
    // const results = await searchPromptsService(payload);
    
    // Option 2: Replicating old filtering logic if searchPromptsService is basic
    // This seems more likely based on the previous implementation.
    const allPrompts = await storageService.getAllPrompts(); 
    let results = [...allPrompts];
    const filter = payload; // Use the received filter

    // Keyword filtering
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      results = results.filter(prompt => 
        prompt.title.toLowerCase().includes(term) || 
        prompt.content.toLowerCase().includes(term) ||
        prompt.tags?.some((tag: string) => tag.toLowerCase().includes(term))
      );
    }

    // Sorting (example: favorite then useCount)
    results.sort((a, b) => {
      const aFavorite = a.isFavorite || a.favorite || false;
      const bFavorite = b.isFavorite || b.favorite || false;
      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }
      return (b.useCount || 0) - (a.useCount || 0);
    });

    // Limiting
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    console.log(`[PromptHandler] Search completed. Found ${results.length} prompts.`);
    sendResponse(results);

  } catch (error: any) {
    console.error('[PromptHandler] Error searching prompts:', error);
    sendResponse([]); // Send empty array on error
  }
  // sendResponse is handled asynchronously
}

/**
 * 处理PromptShortcut功能的本地提示词搜索请求
 * @param payload 搜索参数，包含查询词
 * @param sender 消息发送者
 * @param sendResponse 回调函数，用于发送响应
 */
export async function handleSearchLocalPrompts(
  payload: { query?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean; data?: any; error?: string }) => void
): Promise<void> {
  try {
    console.log(`[PromptShortcut] Service Worker收到搜索请求，关键词: "${payload.query || ''}"`, {
      sender: sender.id,
      url: sender.url,
      tabId: sender.tab?.id
    });
    
    // 使用更强的认证检查方式
    let isAuthenticated = false;
    let userId = null;
    
    try {
      // 先从storageService获取userId
      userId = await storageService.get('userId');
      console.log(`[PromptShortcut] 从storageService获取userId: ${userId || 'null'}`);
      
      // 如果userId不存在，尝试从centralStateManager获取
      if (!userId) {
        console.log(`[PromptShortcut] 尝试从centralStateManager获取认证状态`);
        // 直接使用require获取centralStateManager，避免循环依赖
        const { getCentralStateManager } = require('./index');
        const centralStateManager = getCentralStateManager();
        if (centralStateManager) {
          const authState = centralStateManager.getAuthState();
          userId = authState.userId;
          isAuthenticated = authState.isAuthenticated;
          console.log(`[PromptShortcut] 从CentralStateManager获取认证状态: isAuthenticated=${isAuthenticated}, userId=${userId || 'null'}`);
        }
      } else {
        isAuthenticated = true;
        console.log(`[PromptShortcut] 从存储中找到userId: ${userId}`);
      }
    } catch (authError) {
      console.error(`[PromptShortcut] 检查认证状态失败:`, authError);
      isAuthenticated = false;
    }
    
    // 检查用户是否已认证
    if (!isAuthenticated || !userId) {
      console.log(`[PromptShortcut] 用户未认证，无法搜索提示词`);
      sendResponse({ 
        success: false, 
        error: 'User not authenticated',
        data: [] // 返回空数组而不是undefined，避免前端解析错误
      });
      return;
    }

    if (!payload.query || payload.query.trim() === '') {
      console.log(`[PromptShortcut] 搜索关键词为空，返回空结果`);
      sendResponse({ success: true, data: [] });
      return;
    }

    const query = payload.query.trim().toLowerCase();
    console.log(`[PromptShortcut] 执行提示词搜索，关键词: "${query}", 用户ID: ${userId}`);

    // 获取所有提示词
    const allPrompts = await storageService.getAllPrompts();
    console.log(`[PromptShortcut][DEBUG] 存储中总共有 ${allPrompts.length} 条提示词`);
    
    // 获取并搜索推荐提示词
    const recommendedPrompts = recommendedPromptsService.search(query);
    console.log(`[PromptShortcut][DEBUG] 找到 ${recommendedPrompts.length} 条匹配的推荐提示词`);
    
    // 将推荐提示词转换为Prompt格式
    const adaptedRecommendedPrompts = adaptRecommendedArrayToPrompts(recommendedPrompts);
    
    // 输出前5个提示词的信息用于调试
    if (allPrompts.length > 0) {
      const samplePrompts = allPrompts.slice(0, Math.min(5, allPrompts.length));
      console.log(`[PromptShortcut][DEBUG] 存储中的提示词样例:`, 
        samplePrompts.map(p => ({ 
          id: p.id, 
          title: p.title, 
          contentLength: p.content.length,
          createdAt: new Date(p.createdAt).toISOString()
        }))
      );
    }
    
    // 使用简单直接的字符串包含匹配逻辑 (与searchPrompts函数相同)
    let results = [...allPrompts];
    
    // 关键词过滤 - 使用简单的includes匹配
    const term = query.toLowerCase();
    results = results.filter(prompt => 
      prompt.title.toLowerCase().includes(term) || 
      prompt.content.toLowerCase().includes(term) ||
      (prompt.tags && Array.isArray(prompt.tags) && 
       prompt.tags.some((tag: string) => tag.toLowerCase().includes(term)))
    );
    
    // 记录每个提示词的匹配情况（调试用）
    console.log(`[PromptShortcut][DEBUG] 匹配结果详情:`);
    allPrompts.forEach(prompt => {
      const titleMatch = prompt.title.toLowerCase().includes(term);
      const contentMatch = prompt.content.toLowerCase().includes(term);
      const tagsMatch = prompt.tags && Array.isArray(prompt.tags) && 
                        prompt.tags.some((tag: string) => tag.toLowerCase().includes(term));
      
      console.log(`提示词 "${prompt.title}" (ID: ${prompt.id}): ` + 
                 `标题匹配=${titleMatch}, 内容匹配=${contentMatch}, 标签匹配=${tagsMatch}`);
    });
    
    // 基本排序：先收藏，再使用次数
    results.sort((a, b) => {
      const aFavorite = a.isFavorite || a.favorite || false;
      const bFavorite = b.isFavorite || b.favorite || false;
      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }
      return (b.useCount || 0) - (a.useCount || 0);
    });
    
    // 合并两种搜索结果，用户创建的提示词在前
    const combinedResults = [...results, ...adaptedRecommendedPrompts];
    
    // 限制数量
    const finalResults = combinedResults.slice(0, 10);
    
    console.log(`[PromptShortcut] 搜索完成，找到 ${finalResults.length} 条匹配提示词 (${results.length} 用户, ${adaptedRecommendedPrompts.length} 推荐)`, {
      hasResults: finalResults.length > 0,
      resultIds: finalResults.map(p => p.id)
    });
    
    // 如果没有结果，记录一些更详细的搜索信息
    if (finalResults.length === 0) {
      console.log(`[PromptShortcut][DEBUG] 搜索无结果，可能原因：`);
      console.log(`[PromptShortcut][DEBUG] 1. 提示词库为空`);
      console.log(`[PromptShortcut][DEBUG] 2. 没有匹配关键词"${query}"的提示词`);
      console.log(`[PromptShortcut][DEBUG] 3. 可能存在提示词存储或访问权限问题`);
    }
    
    // 发送搜索结果
    sendResponse({ success: true, data: finalResults });
  } catch (error) {
    console.error(`[PromptShortcut] 搜索提示词失败:`, error);
    sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: [] // 返回空数组而不是undefined
    });
  }
}

// 可能还需要一个初始化函数，如果这个模块需要设置监听器等
// export function initializePromptHandling() { ... } 