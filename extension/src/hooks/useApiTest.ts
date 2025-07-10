import { useState, useCallback } from 'react';
import { optimizePrompt, OptimizationMode } from '../services/optimization';
import { useAuth } from './useAuth';

/**
 * API测试钩子
 * 提供API测试功能，避免组件直接调用服务层
 */
export function useApiTest() {
  const [testInput, setTestInput] = useState('请优化我的提示词：我想让AI写一个故事。');
  const [testResult, setTestResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<OptimizationMode>('standard');
  const { user } = useAuth();

  const runTest = useCallback(async () => {
    if (!testInput.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setTestResult('');
    
    try {
      const currentUserId = user?.uid || null;
      const result = await optimizePrompt(testInput, mode, currentUserId);
      setTestResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '测试失败，请稍后重试';
      setError(errorMessage);
      console.error('API测试失败:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [testInput, mode, user]);

  return {
    testInput,
    setTestInput,
    testResult,
    isLoading,
    error,
    mode,
    setMode,
    runTest
  };
}

// 由于组件通常会需要类型，我们从钩子重新导出类型，避免组件直接从服务导入
export type { OptimizationMode }; 