import { getApps, getApp } from 'firebase/app';
import { getAnalytics, logEvent, setUserId } from 'firebase/analytics';
import { initializeFirebase } from '../auth/firebase';

// Analytics实例缓存
let analyticsInstance: any = null;

// 初始化Firebase Analytics
export const initializeAnalytics = () => {
  try {
    // 确保Firebase已初始化
    const app = getApps().length === 0 ? initializeFirebase() : getApp();
    
    if (!analyticsInstance) {
      analyticsInstance = getAnalytics(app);
      console.log('[Analytics] Firebase Analytics initialized successfully');
    }
    
    return analyticsInstance;
  } catch (error) {
    console.error('[Analytics] Failed to initialize Analytics:', error);
    return null;
  }
};

// 设置用户ID
export const setAnalyticsUserId = (userId: string) => {
  try {
    const analytics = initializeAnalytics();
    if (analytics) {
      setUserId(analytics, userId);
      console.log('[Analytics] User ID set:', userId);
    }
  } catch (error) {
    console.error('[Analytics] Failed to set user ID:', error);
  }
};

// 统一的事件追踪函数
export const trackEvent = (eventName: string, parameters?: { [key: string]: any }) => {
  try {
    const analytics = initializeAnalytics();
    if (analytics) {
      logEvent(analytics, eventName, parameters);
      console.log('[Analytics] Event tracked:', eventName, parameters);
    }
  } catch (error) {
    console.error('[Analytics] Failed to track event:', error);
  }
};

// 扩展安装事件
export const trackExtensionInstalled = (version: string) => {
  trackEvent('extension_installed', {
    version,
    timestamp: Date.now(),
    platform: 'chrome'
  });
};

// 用户登录事件
export const trackUserLogin = (userId: string, method: string) => {
  setAnalyticsUserId(userId);
  trackEvent('user_login', {
    method,
    timestamp: Date.now()
  });
};

// 功能使用事件
export const trackFeatureUsage = (feature: string, action?: string, metadata?: any) => {
  trackEvent('feature_usage', {
    feature,
    action,
    ...metadata,
    timestamp: Date.now()
  });
};

// 优化服务使用
export const trackOptimizationUsed = (promptId: string, optimizationType: string) => {
  trackEvent('optimization_used', {
    prompt_id: promptId,
    optimization_type: optimizationType,
    timestamp: Date.now()
  });
};

// 提示词相关事件
export const trackPromptAction = (action: string, promptId?: string, metadata?: any) => {
  trackEvent('prompt_action', {
    action, // 'created', 'used', 'favorited', 'shared'
    prompt_id: promptId,
    ...metadata,
    timestamp: Date.now()
  });
};

// 会员转化事件
export const trackMembershipConversion = (planType: string, from: string) => {
  trackEvent('membership_conversion', {
    plan_type: planType,
    conversion_source: from,
    timestamp: Date.now()
  });
};

// 快捷输入功能使用
export const trackShortcutUsage = (action: string, metadata?: any) => {
  trackEvent('shortcut_usage', {
    action, // 'triggered', 'search', 'selected', 'cancelled'
    ...metadata,
    timestamp: Date.now()
  });
}; 