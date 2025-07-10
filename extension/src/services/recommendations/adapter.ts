import { RecommendedPrompt } from './types';
import { Prompt } from '../prompt/types';

/**
 * 将RecommendedPrompt适配为与Prompt接口兼容的对象
 * 用于确保UI组件可以处理两种类型的提示词
 */
export function adaptRecommendedToPrompt(recommended: RecommendedPrompt): Prompt {
  return {
    id: recommended.id,
    title: recommended.title,
    content: recommended.content,
    createdAt: recommended.createdAt,
    updatedAt: recommended.createdAt,
    useCount: recommended.useCount,
    lastUsed: 0,
    isActive: true,
    isFavorite: false,
    tags: recommended.tags || [],
    category: recommended.category,
    // 添加标识字段，用于在UI中区分推荐提示词
    isRecommended: true,
  };
}

/**
 * 批量将RecommendedPrompt数组适配为Prompt数组
 */
export function adaptRecommendedArrayToPrompts(recommendedPrompts: RecommendedPrompt[]): Prompt[] {
  return recommendedPrompts.map(adaptRecommendedToPrompt);
} 