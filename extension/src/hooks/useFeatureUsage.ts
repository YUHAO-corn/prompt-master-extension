import { useCallback } from 'react';
import { featureUsageService } from '../services/featureUsage';
import type { FeatureType, FeatureUsageOptions, FeatureExecutor } from '../services/featureUsage';

/**
 * React Hook for Feature Usage Tracking
 * 
 * 提供在 React 组件中使用功能使用追踪服务的便捷方法
 */
export function useFeatureUsage() {
  /**
   * 追踪功能使用
   */
  const trackFeature = useCallback(async <T>(
    featureType: FeatureType,
    executor: FeatureExecutor<T>,
    options?: FeatureUsageOptions
  ) => {
    return await featureUsageService.trackFeature(featureType, executor, options);
  }, []);

  /**
   * 创建一个包装后的功能执行函数
   * 这个方法特别适合包装现有的功能函数
   */
  const wrapFeature = useCallback(<T>(
    featureType: FeatureType,
    originalFunction: FeatureExecutor<T>,
    options?: FeatureUsageOptions
  ) => {
    return featureUsageService.wrapFunction(featureType, originalFunction, options);
  }, []);

  return {
    trackFeature,
    wrapFeature
  };
} 