import { addMessageListener, createSuccessResponse, createErrorResponse, sendMessage } from '../messaging';
import { Message, MessageResponse } from '../messaging/types';
import { storageService } from '../storage';
import { Prompt, PromptFilter } from './types';

// 消息类型常量
export const PROMPT_MESSAGE_TYPES = {
  UPDATED: 'prompt_updated',
  SEARCH: 'prompt_search',
  INCREMENT_USE: 'prompt_increment_use'
};

/**
 * 初始化提示词消息处理器
 * 处理所有与提示词相关的跨环境消息
 */
export function initPromptMessaging(): void {
  console.log('[PromptMessaging] 初始化提示词消息处理器');
  
  addMessageListener(async (message: Message, sender, sendResponse) => {
    try {
      // 根据消息类型分发处理
      switch (message.type) {
        case 'GET_PROMPTS':
          // 获取所有提示词
          const prompts = await storageService.getAllPrompts();
          sendResponse(createSuccessResponse(prompts, message.requestId));
          break;
          
        case 'GET_PROMPT':
          // 获取单个提示词
          const promptId = message.payload as string;
          const prompt = await storageService.getPrompt(promptId);
          sendResponse(createSuccessResponse(prompt, message.requestId));
          break;
          
        case 'SAVE_PROMPT':
          // 保存提示词
          const promptToSave = message.payload as Prompt;
          await storageService.savePrompt(promptToSave);
          sendResponse(createSuccessResponse(true, message.requestId));
          break;
          
        case 'UPDATE_PROMPT':
          // 更新提示词
          const { id, updates } = message.payload as { id: string; updates: Partial<Prompt> };
          await storageService.updatePrompt(id, updates);
          sendResponse(createSuccessResponse(true, message.requestId));
          break;
          
        case 'DELETE_PROMPT':
          // 删除提示词
          const idToDelete = message.payload as string;
          await storageService.deletePrompt(idToDelete);
          sendResponse(createSuccessResponse(true, message.requestId));
          break;
          
        case 'INCREMENT_PROMPT_USE':
          // 增加提示词使用次数
          const idToIncrement = message.payload as string;
          await storageService.incrementUseCount(idToIncrement);
          sendResponse(createSuccessResponse(true, message.requestId));
          break;
          
        case 'SEARCH_PROMPTS':
          // 搜索提示词
          const filter = message.payload as PromptFilter;
          const allPrompts = await storageService.getAllPrompts();
          
          // 在内存中执行筛选
          let filteredPrompts = [...allPrompts];
          
          // 关键词搜索
          if (filter.searchTerm) {
            const term = filter.searchTerm.toLowerCase();
            
            // 改进匹配逻辑，支持多种匹配模式
            filteredPrompts = filteredPrompts.filter(prompt => {
              const titleLower = prompt.title.toLowerCase();
              const contentLower = prompt.content.toLowerCase();
              const tagText = prompt.tags?.join(' ').toLowerCase() || '';
              
              // 1. 精确完整匹配（优先级最高）
              const exactTitleMatch = titleLower === term;
              const exactContentMatch = contentLower === term;
              
              // 2. 包含匹配
              const titleContains = titleLower.includes(term);
              const contentContains = contentLower.includes(term);
              const tagContains = tagText.includes(term);
              
              // 3. 开头匹配（常用场景）
              const titleStartsWith = titleLower.startsWith(term);
              const contentStartsWith = contentLower.startsWith(term);
              
              // 4. 词组匹配（按字符）
              const termChars = Array.from(term);
              // 检查所有字符是否都存在（不一定连续）
              const titleHasAllChars = termChars.every(char => titleLower.includes(char));
              const contentHasAllChars = termChars.every(char => contentLower.includes(char));
              
              // 5. 中文拼音匹配（针对拼音输入法）
              // 这里简化处理，实际可能需要拼音转换库
              const isPinyinMatch = term.length > 0 && /^[a-z]+$/.test(term) && 
                                   (titleLower.includes(term) || contentLower.includes(term));
              
              // 综合判断是否匹配
              return exactTitleMatch || exactContentMatch || 
                     titleContains || contentContains || tagContains ||
                     titleStartsWith || contentStartsWith ||
                     titleHasAllChars || contentHasAllChars ||
                     isPinyinMatch;
            });
          }
          
          // 收藏过滤
          if (filter.onlyFavorites || filter.favorite) {
            filteredPrompts = filteredPrompts.filter(prompt => 
              prompt.isFavorite || prompt.favorite
            );
          }
          
          // 分类过滤
          if (filter.category) {
            filteredPrompts = filteredPrompts.filter(prompt => 
              prompt.category === filter.category
            );
          }
          
          // 标签过滤
          if (filter.tags && filter.tags.length > 0) {
            filteredPrompts = filteredPrompts.filter(prompt => 
              prompt.tags?.some(tag => filter.tags!.includes(tag))
            );
          }
          
          // 排序
          if (filter.sortBy) {
            switch (filter.sortBy) {
              case 'usage':
                filteredPrompts.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
                break;
              case 'favorite':
                filteredPrompts.sort((a, b) => {
                  const aFav = a.isFavorite || a.favorite || false;
                  const bFav = b.isFavorite || b.favorite || false;
                  return aFav === bFav ? 0 : aFav ? -1 : 1;
                });
                break;
              case 'time':
                filteredPrompts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                break;
              case 'alphabetical':
                filteredPrompts.sort((a, b) => a.title.localeCompare(b.title));
                break;
              case 'relevance':
                // 使用综合排序算法进行排序
                const now = Date.now();
                const TIME_RANGE = 14 * 24 * 60 * 60 * 1000; // 14天时间范围
                const USAGE_WEIGHT = 0.7;                    // 使用次数权重
                const RECENCY_WEIGHT = 0.3;                  // 最近使用时间权重
                const INITIAL_SCORE = 0.1;                   // 冷启动常数
                
                // 找出所有提示词中最大使用次数
                const maxUsage = Math.max(...filteredPrompts.map(p => p.useCount || 0));
                
                filteredPrompts.sort((a, b) => {
                  // 计算a的归一化使用次数
                  const normalizedUsageA = maxUsage > 0 ? (a.useCount || 0) / maxUsage : 0;
                  
                  // 计算a的归一化时间接近度 (越接近当前时间，值越高)
                  const timeDistanceA = Math.max(0, Math.min(1, 1 - ((now - (a.lastUsed || 0)) / TIME_RANGE)));
                  
                  // 计算a的综合得分
                  const scoreA = (USAGE_WEIGHT * normalizedUsageA) + 
                                (RECENCY_WEIGHT * timeDistanceA) + 
                                INITIAL_SCORE;
                  
                  // 计算b的归一化使用次数
                  const normalizedUsageB = maxUsage > 0 ? (b.useCount || 0) / maxUsage : 0;
                  
                  // 计算b的归一化时间接近度
                  const timeDistanceB = Math.max(0, Math.min(1, 1 - ((now - (b.lastUsed || 0)) / TIME_RANGE)));
                  
                  // 计算b的综合得分
                  const scoreB = (USAGE_WEIGHT * normalizedUsageB) + 
                                (RECENCY_WEIGHT * timeDistanceB) + 
                                INITIAL_SCORE;
                  
                  // 收藏状态优先级最高，在评分基础上叠加收藏因素
                  const aFav = a.isFavorite || a.favorite || false;
                  const bFav = b.isFavorite || b.favorite || false;
                  
                  if (aFav && !bFav) return -1;
                  if (!aFav && bFav) return 1;
                  
                  // 相同收藏状态则按评分排序
                  return scoreB - scoreA;
                });
                break;
            }
          }
          
          // 分页
          if (filter.offset && filter.offset > 0) {
            filteredPrompts = filteredPrompts.slice(filter.offset);
          }
          
          if (filter.limit && filter.limit > 0) {
            filteredPrompts = filteredPrompts.slice(0, filter.limit);
          }
          
          sendResponse(createSuccessResponse(filteredPrompts, message.requestId));
          break;
          
        default:
          // 不处理其他类型的消息
          return false;
      }
      
      // 异步响应需要返回true
      return true;
    } catch (error) {
      console.error('[PromptMessaging] 处理消息错误:', error);
      sendResponse(createErrorResponse(error as Error, message.requestId));
      // 异步响应需要返回true
      return true;
    }
  });
}

/**
 * 初始化提示词消息处理
 * 在后台环境调用
 */
export function setupPromptMessaging(): void {
  initPromptMessaging();
}

/**
 * 通过消息处理搜索提示词
 * @param keyword 关键词
 * @param limit 限制数量
 * @returns 匹配的提示词数组
 */
export async function searchPromptsByMessaging(keyword: string, limit: number = 8): Promise<Prompt[]> {
  console.log('[AetherFlow] 消息服务: 开始搜索提示词, 关键词:', keyword, '限制:', limit);
  
  try {
    console.log('[AetherFlow] 消息服务: 发送SEARCH_PROMPTS消息');
    const filter: PromptFilter = {
      searchTerm: keyword,
      limit: limit,
      sortBy: 'favorite'
    };
    
    const response = await sendMessage<PromptFilter, Prompt[]>({
      type: 'SEARCH_PROMPTS',
      payload: filter
    });
    
    console.log('[AetherFlow] 消息服务: 收到搜索响应', response ? '成功' : '失败');
    return response;
  } catch (error) {
    console.error('[AetherFlow] 消息服务: 搜索提示词失败:', error);
    return [];
  }
}

/**
 * 通过消息处理增加提示词使用次数
 * @param promptId 提示词ID
 * @returns 是否成功
 */
export async function incrementPromptUseByMessaging(promptId: string): Promise<boolean> {
  console.log('[AetherFlow] 消息服务: 开始增加提示词使用次数, ID:', promptId);
  
  try {
    console.log('[AetherFlow] 消息服务: 发送INCREMENT_PROMPT_USE消息');
    await sendMessage<string, boolean>({
      type: 'INCREMENT_PROMPT_USE',
      payload: promptId
    });
    
    console.log('[AetherFlow] 消息服务: 增加使用次数成功');
    return true;
  } catch (error) {
    console.error('[AetherFlow] 消息服务: 增加提示词使用次数失败:', error);
    return false;
  }
}

// 发送提示词更新通知
export async function notifyPromptUpdated(): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'PROMPT_UPDATED'
  });
}

// 导出消息服务
export const promptMessagingService = {
  searchPromptsByMessaging,
  incrementPromptUseByMessaging,
  notifyPromptUpdated
}; 