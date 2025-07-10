import { FeatureType, FeatureUsageRecord, FeatureUsageResult, FeatureUsageOptions, FeatureExecutor } from './types';
import { trackFeatureUsage } from '../analytics';
import { User } from '../auth/types';

/**
 * 功能使用追踪服务 - 专注于功能使用统计
 * 
 * 职责：
 * 1. 记录功能使用情况（用于奖励系统和数据分析）
 * 2. 不干扰原有业务逻辑的执行
 * 
 * 不负责：
 * - 用户认证检查（由各功能自行处理）
 * - 权限控制（由各功能自行处理）
 */
export class FeatureUsageService {
  private static instance: FeatureUsageService;
  
  private constructor() {}
  
  public static getInstance(): FeatureUsageService {
    if (!FeatureUsageService.instance) {
      FeatureUsageService.instance = new FeatureUsageService();
    }
    return FeatureUsageService.instance;
  }
  
  private async notifyFeatureUsage(type: FeatureType, metadata?: any): Promise<void> {
    // 在开发环境或者总是发送（简化检查）
    try {
      const logMessage = {
        type: 'FEATURE_USAGE_LOG',
        payload: {
          timestamp: new Date().toISOString(),
          featureType: type,
          metadata: metadata || {},
          source: 'feature_usage_service'
        }
      };
      
      // 添加奖励流程追踪日志
      console.log(`[REWARDS_FLOW] Step 1: FeatureUsageService sending message to SW`, {
        featureType: type,
        metadata: metadata || {},
        timestamp: logMessage.payload.timestamp
      });
      
      // 检测当前环境：如果在background script中，直接调用任务检测逻辑
      if (typeof window === 'undefined' && typeof chrome !== 'undefined' && chrome.runtime) {
        // 我们在background script（Service Worker）中
        console.log(`[REWARDS_FLOW] Step 1: Running in background script, calling task detection directly`);
        
        // 直接调用已存在的任务检测逻辑，而不是发送消息
        try {
          // 动态导入现有的任务检测函数
          const { handleTaskDetection } = await import('../../background/listeners');
          await handleTaskDetection(type, metadata);
          console.log(`[REWARDS_FLOW] Step 1: Direct task detection completed for feature: ${type}`);
        } catch (directError) {
          console.error(`[REWARDS_FLOW] Step 1: Direct task detection FAILED for feature: ${type}`, directError);
        }
      } else {
        // 我们在UI环境中（sidepanel、content script等），发送消息到SW
        await chrome.runtime.sendMessage(logMessage);
        console.log('[FeatureUsage][DEV] 已发送功能使用日志到SW:', logMessage);
        console.log(`[REWARDS_FLOW] Step 1: Message sent successfully to SW for feature: ${type}`);
      }
    } catch (error) {
      console.warn('[FeatureUsage][DEV] 发送SW日志失败:', error);
      console.error(`[REWARDS_FLOW] Step 1: FAILED to send message to SW for feature: ${type}`, error);
    }
  }
  
  /**
   * 功能使用追踪 - 包装并统计功能使用
   * @param featureType 功能类型
   * @param executor 原有功能执行函数
   * @param options 追踪选项
   * @returns 功能使用结果
   */
  public async trackFeature<T>(
    featureType: FeatureType,
    executor: FeatureExecutor<T>,
    options: FeatureUsageOptions = {}
  ): Promise<FeatureUsageResult<T>> {
    console.log(`[FeatureUsage] 开始追踪功能: ${featureType}`);
    const startTime = Date.now();
    let success = false;
    let result: T | undefined;
    let error: string | undefined;
    
    try {
      // 执行原有功能（完全不干扰）
      result = await executor();
      success = true;
      
      return {
        success: true,
        data: result
      };
      
    } catch (err: any) {
      success = false;
      error = err.message || '功能执行失败';
      
      // 重新抛出原始错误，保持原有错误处理逻辑
      throw err;
      
    } finally {
      // 在finally块中处理所有追踪逻辑，确保不影响主功能
      const executionTime = Date.now() - startTime;
      const trackingMetadata = {
        ...options.metadata,
        executionTime,
        success,
        error
      };
      
      // 异步处理通知和记录，不等待结果
      Promise.all([
        this.notifyFeatureUsage(featureType, trackingMetadata).catch(err => 
          console.warn('[FeatureUsage] Notification failed:', err)
        ),
        !options.skipTracking ? this.recordUsage(featureType, success, trackingMetadata).catch(err => 
          console.warn('[FeatureUsage] Recording failed:', err)
        ) : Promise.resolve()
      ]).catch(() => {
        // 忽略追踪错误，不影响主功能
      });
    }
  }
  
  /**
   * 记录功能使用情况
   */
  private async recordUsage(
    featureType: FeatureType,
    success: boolean,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // 获取当前用户（如果有的话）
      let userId = 'anonymous';
      try {
        const authResponse = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
        // 修复：正确解析从CentralStateManager返回的认证状态数据格式
        // authResponse.payload 包含 { userId, isAuthenticated, user }
        const user: User | null = authResponse?.payload?.user || null;
        if (user && user.uid) {
          userId = user.uid;
        }
        console.log('[FeatureUsage] Retrieved user for tracking:', userId);
      } catch (error) {
        // 获取用户信息失败时，使用 anonymous，不影响追踪
        console.warn('[FeatureUsage] Failed to get user auth state:', error);
      }
      
      // 创建使用记录
      const record: FeatureUsageRecord = {
        userId,
        featureType,
        timestamp: new Date(),
        success,
        metadata
      };
      
      // 发送到 Analytics
      trackFeatureUsage(featureType, success ? 'success' : 'failed', {
        userId: record.userId,
        ...metadata
      });
      
      // 可选：将来可以添加到本地存储或发送到后端进行更详细的分析
      console.log('[FeatureUsageService] Usage recorded:', record);
      
    } catch (err) {
      console.error('[FeatureUsageService] Failed to record usage:', err);
      // 不抛出错误，避免影响主要功能
    }
  }
  
  /**
   * 便捷方法：创建一个自动追踪的函数包装器
   */
  public wrapFunction<T>(
    featureType: FeatureType,
    originalFunction: FeatureExecutor<T>,
    options?: FeatureUsageOptions
  ): FeatureExecutor<T> {
    return async (): Promise<T> => {
      const result = await this.trackFeature(featureType, originalFunction, options);
      return result.data as T;
    };
  }
}

// 导出单例实例
export const featureUsageService = FeatureUsageService.getInstance(); 