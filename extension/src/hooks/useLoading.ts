import { useState, useCallback } from 'react';
import { useAppContext } from './AppContext';

/**
 * 统一管理加载状态的hook
 * 支持全局加载状态和局部加载状态
 */
export function useLoading(defaultState = false) {
  const { setIsLoading } = useAppContext();
  const [localLoading, setLocalLoading] = useState(defaultState);
  
  /**
   * 包装异步函数，自动处理加载状态
   * @param asyncFn 需要执行的异步函数
   * @param useGlobalLoading 是否使用全局加载状态
   */
  const withLoading = useCallback(<T, Args extends any[]>(
    asyncFn: (...args: Args) => Promise<T>,
    useGlobalLoading = false
  ) => {
    return async (...args: Args): Promise<T> => {
      try {
        // 设置加载状态
        if (useGlobalLoading) {
          setIsLoading(true);
        } else {
          setLocalLoading(true);
        }
        
        // 执行异步函数
        return await asyncFn(...args);
      } finally {
        // 重置加载状态
        if (useGlobalLoading) {
          setIsLoading(false);
        } else {
          setLocalLoading(false);
        }
      }
    };
  }, [setIsLoading]);
  
  return {
    isLoading: localLoading,
    setLoading: setLocalLoading,
    withLoading
  };
} 