import { useState, useEffect, useCallback } from 'react';
import { RecommendedPrompt, recommendedPromptsService } from '../services/recommendations';
import { Prompt } from '../services/prompt/types';
import { adaptRecommendedArrayToPrompts } from '../services/recommendations';

/**
 * 提供推荐提示词数据和操作的Hook
 */
export function useRecommendedPrompts() {
  const [recommendedPrompts, setRecommendedPrompts] = useState<RecommendedPrompt[]>([]);
  const [adaptedPrompts, setAdaptedPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 加载所有推荐提示词
  const loadRecommendedPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取所有推荐提示词
      const data = recommendedPromptsService.getAll();
      
      // 更新状态
      setRecommendedPrompts(data);
      
      // 将推荐提示词转换为Prompt格式
      const adapted = adaptRecommendedArrayToPrompts(data);
      setAdaptedPrompts(adapted);
    } catch (err) {
      console.error('加载推荐提示词失败:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // 搜索推荐提示词
  const searchRecommendedPrompts = useCallback(async (term: string): Promise<Prompt[]> => {
    try {
      // 搜索推荐提示词
      const results = recommendedPromptsService.search(term);
      
      // 将结果转换为Prompt格式
      return adaptRecommendedArrayToPrompts(results);
    } catch (err) {
      console.error('搜索推荐提示词失败:', err);
      return [];
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadRecommendedPrompts();
  }, [loadRecommendedPrompts]);

  return {
    recommendedPrompts,  // 原始推荐提示词数据
    adaptedPrompts,      // 转换为Prompt格式的数据，用于UI展示
    loading,
    error,
    refresh: loadRecommendedPrompts,
    searchRecommendedPrompts
  };
} 