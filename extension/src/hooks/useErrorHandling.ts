import { useState, useCallback, useRef } from 'react';
import { useAppContext } from './AppContext';
import { useLoading } from './useLoading';

// 错误类型定义
export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

// 错误对象接口
export interface ErrorData {
  type: ErrorType;
  message: string;
  original?: any;
  retry?: () => Promise<any>;
}

/**
 * 使用此hook处理异步操作中的错误和加载状态
 */
export function useErrorHandling() {
  const { setError } = useAppContext();
  const { withLoading } = useLoading();
  const [currentError, setCurrentError] = useState<ErrorData | null>(null);
  const retryFnRef = useRef<(() => Promise<any>) | null>(null);
  
  /**
   * 分析错误类型
   * @param error 捕获的错误
   */
  const analyzeError = useCallback((error: any): ErrorType => {
    if (!navigator.onLine) {
      return ErrorType.NETWORK;
    }
    
    const errorMessage = error?.message || '';
    
    if (
      errorMessage.includes('Failed to fetch') || 
      errorMessage.includes('Network error') ||
      errorMessage.includes('timeout') ||
      error?.name === 'AbortError'
    ) {
      return ErrorType.NETWORK;
    }
    
    if (error?.status >= 400 || errorMessage.includes('API')) {
      return ErrorType.API;
    }
    
    if (errorMessage.includes('validation') || error?.validationErrors) {
      return ErrorType.VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }, []);
  
  /**
   * 获取错误类型对应的默认错误信息
   * @param type 错误类型
   */
  const getDefaultErrorMessage = useCallback((type: ErrorType): string => {
    switch (type) {
      case ErrorType.NETWORK:
        return '网络连接失败，请检查您的网络连接';
      case ErrorType.API:
        return 'API请求失败，请稍后重试';
      case ErrorType.VALIDATION:
        return '输入数据验证失败，请检查输入内容';
      case ErrorType.UNKNOWN:
      default:
        return '发生未知错误，请稍后重试';
    }
  }, []);
  
  /**
   * 处理错误，设置错误状态并提供重试机制
   * @param error 捕获的错误
   * @param customMessage 自定义错误信息
   * @param retryFn 重试函数
   */
  const handleError = useCallback((error: any, customMessage?: string, retryFn?: () => Promise<any>) => {
    const errorType = analyzeError(error);
    const message = customMessage || error?.message || getDefaultErrorMessage(errorType);
    
    const errorData: ErrorData = {
      type: errorType,
      message,
      original: error
    };
    
    if (retryFn) {
      errorData.retry = retryFn;
      retryFnRef.current = retryFn;
    }
    
    setCurrentError(errorData);
    setError(message);
    
    return errorData;
  }, [analyzeError, getDefaultErrorMessage, setError]);
  
  /**
   * 重试上一次失败的操作
   */
  const retry = useCallback(async () => {
    if (!retryFnRef.current) return null;
    
    setCurrentError(null);
    setError(null);
    
    try {
      return await retryFnRef.current();
    } catch (error) {
      handleError(error, undefined, retryFnRef.current);
      return null;
    }
  }, [handleError, setError]);
  
  /**
   * 清除当前错误状态
   */
  const clearError = useCallback(() => {
    setCurrentError(null);
    setError(null);
  }, [setError]);
  
  /**
   * 包装异步函数，统一处理加载状态和错误
   * @param asyncFn 需要执行的异步函数
   * @param errorMessage 发生错误时显示的错误信息
   * @param useGlobalLoading 是否使用全局加载状态
   * @param retryCount 失败时最大重试次数
   */
  const withErrorHandling = useCallback(<T, Args extends any[]>(
    asyncFn: (...args: Args) => Promise<T>,
    errorMessage?: string,
    useGlobalLoading = true,
    retryCount = 0
  ) => {
    return async (...args: Args): Promise<T | null> => {
      let attempts = 0;
      const executeWithRetry = async (): Promise<T | null> => {
        try {
          attempts++;
          const wrappedFn = withLoading(asyncFn, useGlobalLoading);
          return await wrappedFn(...args);
        } catch (error) {
          console.error(`Error in ${asyncFn.name || 'async function'}:`, error);
          
          // 检查是否还有重试机会
          if (attempts <= retryCount && analyzeError(error) === ErrorType.NETWORK) {
            console.log(`Retrying (${attempts}/${retryCount})...`);
            return executeWithRetry();
          }
          
          // 创建重试函数
          const retryFn = () => executeWithRetry();
          
          // 处理错误
          handleError(error, errorMessage, retryFn);
          return null;
        }
      };
      
      return executeWithRetry();
    };
  }, [withLoading, analyzeError, handleError]);
  
  /**
   * 检测网络状态
   */
  const checkNetworkStatus = useCallback(() => {
    return {
      isOnline: navigator.onLine,
      canRetry: !!retryFnRef.current
    };
  }, []);
  
  return {
    currentError,
    withErrorHandling,
    handleError,
    retry,
    clearError,
    checkNetworkStatus
  };
} 