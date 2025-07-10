import { RecommendedPrompt } from './types';
import recommendedPromptsData from './data/recommendedPrompts.json';

// 确保导入的JSON数据符合RecommendedPrompt类型
const RECOMMENDED_PROMPTS: RecommendedPrompt[] = recommendedPromptsData.map(item => ({
  ...item,
  // 确保所有必要字段都存在
  createdAt: item.createdAt || new Date('2023-01-01').getTime(),
  useCount: item.useCount || 0
}));

/**
 * 推荐提示词服务 - 提供加载和搜索推荐提示词的功能
 */
export const recommendedPromptsService = {
  /**
   * 获取所有推荐提示词
   * @returns 推荐提示词数组
   */
  getAll: (): RecommendedPrompt[] => RECOMMENDED_PROMPTS,
  
  /**
   * 搜索推荐提示词
   * @param term 搜索关键词
   * @returns 匹配的推荐提示词数组
   */
  search: (term: string): RecommendedPrompt[] => {
    if (!term) return RECOMMENDED_PROMPTS;
    
    const lowerTerm = term.toLowerCase();
    return RECOMMENDED_PROMPTS.filter(
      prompt => prompt.title.toLowerCase().includes(lowerTerm) || 
                prompt.content.toLowerCase().includes(lowerTerm) ||
                prompt.tags?.some(tag => tag.toLowerCase().includes(lowerTerm))
    );
  },
  
  /**
   * 根据ID获取特定推荐提示词
   * @param id 推荐提示词ID
   * @returns 匹配的推荐提示词，如果未找到则返回undefined
   */
  getById: (id: string): RecommendedPrompt | undefined => {
    return RECOMMENDED_PROMPTS.find(prompt => prompt.id === id);
  }
}; 