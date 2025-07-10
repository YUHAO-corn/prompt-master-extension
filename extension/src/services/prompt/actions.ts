import { 
  Prompt, 
  PromptFilter, 
  CreatePromptInput, 
  UpdatePromptInput,
  PROMPT_STORAGE_LIMITS
} from './types';
import { PromptValidator } from './validator';
import { PromptError, PromptErrorCode } from './errors';
import { storageService, STORAGE_KEYS, STORAGE_LIMITS } from '../storage';
import { generateTitle } from './doubao-title-generator';
import { getQuotaService } from '../../background/index';
import { featureUsageService, FeatureType } from '../featureUsage';

/**
 * 生成唯一ID
 * 生成UUIDv4格式的字符串
 */
function generateId(): string {
  // UUIDv4生成方法
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取所有提示词
 */
export async function getPrompts(filter?: PromptFilter): Promise<Prompt[]> {
  try {
    // 使用新版存储服务的getAllPrompts方法
    const prompts = await storageService.getAllPrompts();
    return prompts;
  } catch (error) {
    console.error('获取提示词失败:', error);
    throw new PromptError('获取提示词失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 通过ID获取提示词
 */
export async function getPromptById(id: string): Promise<Prompt | null> {
  try {
    // 使用新版存储服务的getPrompt方法
    const prompt = await storageService.getPrompt(id);
    return prompt;
  } catch (error) {
    console.error(`获取提示词(ID:${id})失败:`, error);
    throw new PromptError('获取提示词失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 搜索提示词
 */
export async function searchPrompts(filter: PromptFilter): Promise<Prompt[]> {
  try {
    const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];

    let filteredPrompts = [...prompts];
    
    // 只处理激活状态的提示词
    filteredPrompts = filteredPrompts.filter(prompt => 
      prompt.isActive !== false && prompt.active !== false
    );
    
    // 搜索关键词过滤
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      filteredPrompts = filteredPrompts.filter(prompt => 
        prompt.title.toLowerCase().includes(term) || 
        prompt.content.toLowerCase().includes(term)
      );
    }
    
    // 收藏过滤
    if (filter.onlyFavorites || filter.favorite) {
      filteredPrompts = filteredPrompts.filter(prompt => 
        prompt.isFavorite || prompt.favorite
      );
    }
    
    // 排序
    if (filter.sortBy) {
      const now = Date.now();
      const TIME_RANGE = 14 * 24 * 60 * 60 * 1000; // 14天时间范围
      const USAGE_WEIGHT = 0.7;                    // 使用次数权重
      const RECENCY_WEIGHT = 0.3;                  // 最近使用时间权重
      const INITIAL_SCORE = 0.1;                   // 冷启动常数

      switch (filter.sortBy) {
        case 'usage':
          // 按使用频率排序
          filteredPrompts.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
          break;
          
        case 'favorite':
          // 按收藏状态排序
          filteredPrompts.sort((a, b) => {
            const aFav = a.isFavorite || a.favorite || false;
            const bFav = b.isFavorite || b.favorite || false;
            return (aFav === bFav) ? 0 : aFav ? -1 : 1;
          });
          break;
          
        case 'time':
          // 按最近使用时间排序
          filteredPrompts.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
          break;
          
        case 'relevance':
          // 使用综合评分公式排序
          filteredPrompts.sort((a, b) => {
            // 找出所有提示词中最大使用次数
            const maxUsage = Math.max(...filteredPrompts.map(p => p.useCount || 0));
            
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
          
        default:
          // 默认按使用频率排序
          filteredPrompts.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
      }
    } else {
      // 默认按使用频率排序
      filteredPrompts.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
    }
    
    // 限制数量
    if (filter.limit) {
      filteredPrompts = filteredPrompts.slice(0, filter.limit);
    }
    
    return filteredPrompts;
  } catch (error) {
    console.error('搜索提示词失败:', error);
    return [];
  }
}

/**
 * 创建提示词
 */
export async function createPrompt(input: CreatePromptInput): Promise<Prompt> {
  const result = await featureUsageService.trackFeature(
    FeatureType.PROMPT_CREATE,
    async () => {
      // 验证输入
      const validation = PromptValidator.validateCreate(input);
      if (!validation.valid) {
        throw new PromptError(validation.message || '验证失败', 
          validation.code || PromptErrorCode.VALIDATION_ERROR, 
          validation.field);
      }
      
      try {
        // ---- BEGIN QUOTA CHECK ----
        const quotaService = getQuotaService();
        const canSave = await quotaService.canUseFeature('storage');
        if (!canSave) {
            throw new PromptError(
                'Storage quota exceeded. Please upgrade for more space or manage existing prompts.',
                PromptErrorCode.STORAGE_LIMIT_EXCEEDED,
                'storage' 
            );
        }
        // ---- END QUOTA CHECK ----

        const now = Date.now();
        
        // 如果没有提供标题，自动生成标题
        let title = '';
        if (input.title !== undefined) {
          title = input.title.trim();
        }
        
        if (!title) {
          console.log('[createPrompt] 未提供标题，自动生成标题');
          title = await generateTitleForPrompt(input.content);
        }
        
        // 记录是否包含换行符
        const hasNewlines = input.content.includes('\n');
        if (hasNewlines) {
          console.log('[createPrompt] 内容包含换行符，行数:', input.content.split('\n').length);
        }
        
        // 创建新提示词 - 内容处理中保留换行符
        const newPrompt: Prompt = {
          id: generateId(),
          title: title,
          content: input.content, // 不使用trim()，保留原始格式包括换行符
          isFavorite: true,
          createdAt: now,
          updatedAt: now,
          useCount: 0,
          lastUsed: now,
          tags: input.tags || [],
          source: input.source || 'user',
          category: input.category,
          isActive: true
        };
        
        // 添加 sourceUrl 如果存在
        if (input.sourceUrl) {
          newPrompt.sourceUrl = input.sourceUrl;
        }
        
        // 最终验证完整提示词
        const promptValidation = PromptValidator.validatePrompt(newPrompt);
        if (!promptValidation.valid) {
          throw new PromptError(promptValidation.message || '提示词验证失败', 
            promptValidation.code || PromptErrorCode.VALIDATION_ERROR, 
            promptValidation.field);
        }
        
        // 直接使用ChromeStorageService保存单个提示词
        // 替换原来的array保存方式，解决存储不一致问题
        await storageService.savePrompt(newPrompt);
        
        // 通知提示词更新，触发UI刷新
        try {
          chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' });
        } catch (notifyError) {
          console.warn('通知提示词更新失败，这可能会导致UI不同步:', notifyError);
        }
        
        return newPrompt;
      } catch (error) {
        if (error instanceof PromptError) {
          throw error;
        }
        console.error('Error creating prompt:', error);
        throw new PromptError('创建提示词失败', PromptErrorCode.STORAGE_ERROR);
      }
    },
    {
      metadata: {
        contentLength: input.content.length,
        hasTitle: !!input.title,
        source: input.source || 'user',
        hasNewlines: input.content.includes('\n')
      }
    }
  );
  
  return result.data!;
}

/**
 * 更新提示词
 */
export async function updatePrompt(id: string, input: UpdatePromptInput): Promise<Prompt | null> {
  // 验证输入
  const validation = PromptValidator.validateUpdate(input);
  if (!validation.valid) {
    throw new PromptError(validation.message || '验证失败', 
      validation.code || PromptErrorCode.VALIDATION_ERROR, 
      validation.field);
  }
  
  try {
    console.log(`开始更新提示词(ID: ${id})，输入数据:`, JSON.stringify(input));
    
    // 获取现有提示词
    const existingPrompt = await storageService.getPrompt(id);
    if (!existingPrompt) {
      console.error(`找不到ID为${id}的提示词`);
      throw PromptError.notFound(id);
    }
    
    // 构建更新后的提示词
    const updatedPrompt = {
      ...existingPrompt,
      ...input,
      updatedAt: input.updatedAt || Date.now()
    };
    
    console.log(`构建更新后的提示词:`, JSON.stringify(updatedPrompt));
    
    // 最终验证更新后的提示词
    const promptValidation = PromptValidator.validatePrompt(updatedPrompt);
    if (!promptValidation.valid) {
      console.error(`提示词验证失败:`, promptValidation.message);
      throw new PromptError(promptValidation.message || '提示词验证失败', 
        promptValidation.code || PromptErrorCode.VALIDATION_ERROR, 
        promptValidation.field);
    }
    
    // 直接使用ChromeStorageService更新提示词
    // 替换原来的array更新方式，解决存储不一致问题
    await storageService.updatePrompt(id, input);
    
    // 通知提示词更新，触发UI刷新
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' });
    } catch (notifyError) {
      console.warn('通知提示词更新失败，这可能会导致UI不同步:', notifyError);
    }
    
    console.log(`提示词保存成功，ID: ${id}`);
    
    return updatedPrompt;
  } catch (error) {
    if (error instanceof PromptError) {
      throw error;
    }
    console.error('Error updating prompt:', error);
    throw new PromptError('更新提示词失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 删除提示词
 */
export async function deletePrompt(id: string): Promise<boolean> {
  try {
    // 直接使用ChromeStorageService删除提示词
    await storageService.deletePrompt(id);
    
    // 通知提示词更新，触发UI刷新
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' });
    } catch (notifyError) {
      console.warn('通知提示词更新失败，这可能会导致UI不同步:', notifyError);
    }
    
    return true;
  } catch (error) {
    console.error(`删除提示词失败(ID:${id}):`, error);
    throw new PromptError('删除提示词失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 软删除提示词
 */
export async function purgePrompt(id: string): Promise<boolean> {
  // 在这个简化版本中，直接使用deletePrompt实现
  return deletePrompt(id);
}

/**
 * 更新提示词使用次数
 */
export async function incrementPromptUse(id: string): Promise<boolean> {
  try {
    const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
    const index = prompts.findIndex(p => p.id === id);
    
    if (index === -1) {
      return false;
    }

    const prompt = prompts[index];
    
    prompts[index] = {
      ...prompts[index],
      useCount: (prompts[index].useCount || 0) + 1,
      lastUsed: Date.now()
    };
    
    await storageService.set(STORAGE_KEYS.PROMPTS, prompts);
    
    // 🚀 Analytics埋点：追踪提示词使用事件
    try {
      const { trackPromptAction } = await import('@/services/analytics');
      trackPromptAction('used', id, {
        title: prompt.title,
        category: prompt.category,
        source: prompt.source,
        useCount: prompts[index].useCount,
        tags: prompt.tags
      });
    } catch (analyticsError) {
      console.error('[Analytics] Failed to track prompt usage:', analyticsError);
    }
    
    return true;
  } catch (error) {
    console.error(`更新提示词使用次数失败(ID:${id}):`, error);
    return false;
  }
}

/**
 * 切换提示词收藏状态
 */
export async function toggleFavorite(id: string): Promise<boolean> {
  try {
    // 获取提示词
    const prompt = await storageService.getPrompt(id);
    if (!prompt) {
      return false;
    }
    
    // 检查当前收藏状态
    const currentFavorite = prompt.isFavorite || prompt.favorite || false;
    
    if (currentFavorite) {
      // 如果已收藏，则取消收藏状态
      await storageService.updatePrompt(id, { 
        isFavorite: false,
        favorite: false
      });
    } else {
      // 如果未收藏，则标记为收藏
      await storageService.updatePrompt(id, { 
        isFavorite: true,
        favorite: true
      });
    }
    
    // 通知提示词更新，触发UI刷新
    try {
      chrome.runtime.sendMessage({ type: 'PROMPT_UPDATED' });
    } catch (notifyError) {
      console.warn('通知提示词更新失败，这可能会导致UI不同步:', notifyError);
    }
    
    return true;
  } catch (error) {
    console.error(`切换提示词收藏状态失败(ID:${id}):`, error);
    throw new PromptError('切换提示词收藏状态失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 添加优化历史
 */
export async function addOptimizationHistory(promptId: string, content: string): Promise<boolean> {
  try {
    const prompts = await storageService.get<Prompt[]>(STORAGE_KEYS.PROMPTS) || [];
    const index = prompts.findIndex(p => p.id === promptId);
    
    if (index === -1) {
      return false;
    }
    
    const prompt = prompts[index];
    const history = prompt.optimizationHistory || [];
    
    prompts[index] = {
      ...prompt,
      optimizationHistory: [
        ...history,
        {
          version: history.length + 1,
          content,
          timestamp: Date.now()
        }
      ]
    };
    
    await storageService.set(STORAGE_KEYS.PROMPTS, prompts);
    return true;
  } catch (error) {
    console.error(`添加优化历史失败(ID:${promptId}):`, error);
    return false;
  }
}

/**
 * 导入提示词数据
 */
export async function importPrompts(prompts: Prompt[]): Promise<number> {
  try {
    // 检查现有提示词ID，避免冲突
    const existingPrompts = await storageService.getAllPrompts();
    const existingIds = existingPrompts.map(p => p.id);
    
    // 过滤掉已存在的提示词
    const newPrompts = prompts.filter(p => !existingIds.includes(p.id));
    
    if (newPrompts.length === 0) {
      return 0;
    }
    
    // 使用新存储方式保存每个提示词
    await Promise.all(newPrompts.map(prompt => 
      storageService.savePrompt(prompt)
    ));
    
    return newPrompts.length;
  } catch (error) {
    console.error('导入提示词失败:', error);
    throw new PromptError('导入提示词失败', PromptErrorCode.IMPORT_ERROR);
  }
}

/**
 * 导出提示词数据
 */
export async function exportPrompts(ids?: string[]): Promise<Prompt[]> {
  try {
    // 使用storageService.getAllPrompts()代替直接访问存储
    // 这能确保获取到所有正确的提示词，包括单独存储的条目
    const prompts = await storageService.getAllPrompts();
    
    // 如果提供了ID列表，则只导出指定ID的提示词
    if (ids && ids.length > 0) {
      return prompts.filter(p => ids.includes(p.id));
    }
    
    // 返回所有提示词
    return prompts;
  } catch (error) {
    console.error('导出提示词失败:', error);
    throw new PromptError('Failed to export prompts', PromptErrorCode.EXPORT_ERROR);
  }
}

/**
 * 获取存储使用情况
 */
export async function getStorageUsage(): Promise<{ used: number, total: number, percentage: number, count: number }> {
  try {
    // 使用新版存储服务获取所有提示词
    const prompts = await storageService.getAllPrompts();
    
    // 计算存储使用情况
    const promptsString = JSON.stringify(prompts);
    const bytesUsed = new Blob([promptsString]).size;
    
    // 使用配置的存储限制
    const totalBytes = STORAGE_LIMITS.SYNC_STORAGE_MAX_BYTES;
    const percentage = Math.round((bytesUsed / totalBytes) * 100);
    
    return {
      used: bytesUsed,
      total: totalBytes,
      percentage: percentage,
      count: prompts.length
    };
  } catch (error) {
    console.error('获取存储使用情况失败:', error);
    
    // 返回默认值
    return {
      used: 0,
      total: STORAGE_LIMITS.SYNC_STORAGE_MAX_BYTES,
      percentage: 0,
      count: 0
    };
  }
}

/**
 * 清空所有提示词
 */
export async function deletePrompts(): Promise<boolean> {
  try {
    // 获取所有提示词
    const prompts = await storageService.getAllPrompts();
    
    // 使用软删除方式逐个删除
    await Promise.all(prompts.map(prompt => 
      storageService.deletePrompt(prompt.id)
    ));
    
    return true;
  } catch (error) {
    console.error('清空提示词失败:', error);
    throw new PromptError('清空提示词失败', PromptErrorCode.STORAGE_ERROR);
  }
}

/**
 * 为提示词生成标题
 * @param content 提示词内容
 * @returns 生成的标题
 */
export async function generateTitleForPrompt(content: string): Promise<string> {
  // 如果内容为空或仅包含空格，则直接返回"未命名提示词"
  if (!content || content.trim().length === 0) {
    return '未命名提示词';
  }

  try {
    // 首先尝试使用豆包API生成标题
    const title = await generateTitle(content);
    
    // 验证结果并返回
    if (title && title.trim().length > 0) {
      return title;
    } else {
      throw new Error('豆包生成的标题为空');
    }
  } catch (error) {
    // 豆包API失败，尝试使用本地生成（实际已在低级别实现，这里做双重保障）
    console.error('[PromptService] 豆包API标题生成失败，尝试备选方案:', error);
    
    try {
      // 尝试从本地标题生成器导入
      const { generateTitle: generateLocalTitle } = await import('./title-generator');
      const localTitle = await generateLocalTitle(content);
      return localTitle;
    } catch (localError) {
      console.error('[PromptService] 本地标题生成也失败:', localError);
      // 最终降级处理
      // 如果内容超过30个字符，取前27个字符加省略号作为标题，否则直接用内容
      return content.length > 30 ? content.substring(0, 27) + '...' : content;
    }
  }
}

// 常见停用词列表
const stopWords = [
  // 英文停用词
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 'which', 'this', 'that', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  
  // 中文停用词
  '的', '了', '和', '与', '或', '是', '在', '有', '中', '上', '下', '前', '后', '里', '一个', '一种', '这个', '那个',
  '会', '不会', '可以', '不可以', '应该', '不应该', '能', '不能', '要', '不要', '将', '把', '被', '使', '使用',
  '如何', '什么', '哪些', '为什么', '怎么', '怎样', '几个', '多少', '如果', '因为', '所以', '但是', '而且', '以及'
];

export async function clearPromptHistory(daysToKeep: number = 30): Promise<void> {
  const oldPrompts = await getPrompts({
    sortBy: 'time',
    limit: 1000,
    onlyFavorites: false,
    favorite: false,
  });
  const now = Date.now();
  const cutoff = now - daysToKeep * 24 * 60 * 60 * 1000;
  const activeOldPrompts = oldPrompts.filter((p: Prompt) => p.isActive !== false);
  const remainingPrompts = activeOldPrompts.filter((p: Prompt) => (p.lastUsed || p.createdAt || 0) >= cutoff);
  await deletePrompts();
  await importPrompts(remainingPrompts);
}

export async function getFavoritePrompts(): Promise<Prompt[]> {
  const allPrompts = await getPrompts();
  return allPrompts.filter((p: Prompt) => p.isFavorite || p.favorite);
}

export async function getRecentPrompts(limit: number = 10): Promise<Prompt[]> {
  const allPrompts = await getPrompts();
  const sorted = allPrompts.sort((a: Prompt, b: Prompt) => (b.lastUsed || b.updatedAt || 0) - (a.lastUsed || a.updatedAt || 0));
  return sorted.slice(0, limit);
}

export async function getMostUsedPrompts(limit: number = 10): Promise<Prompt[]> {
  const allPrompts = await getPrompts();
  const sorted = allPrompts.sort((a: Prompt, b: Prompt) => (b.useCount || 0) - (a.useCount || 0));
  return sorted.slice(0, limit);
}

export async function findPromptByTitle(title: string): Promise<Prompt | null> {
  const allPrompts = await getPrompts();
  return allPrompts.find((prompt: Prompt) => prompt.title.toLowerCase() === title.toLowerCase()) || null;
} 