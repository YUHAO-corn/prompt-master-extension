// 节流函数，限制函数调用频率
export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      lastArgs = null;
      
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func.apply(this, lastArgs);
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

// 全局状态管理
export const globalState = {
  // 选中文本状态
  selection: {
    text: '',
    hasSelection: false
  }
};

// 声明全局类型
declare global {
  interface Window {
    aetherflowInitialized?: boolean;
    aetherflowRefreshHintShown?: boolean;
    aetherflowStorageHintShown?: boolean; // 存储提示显示标记
    aetherflowBackgroundCheck?: any; // 后台脚本检查计时器
    aetherflowLastBackgroundAlive?: number; // 上次后台脚本活跃时间
  }
}

// 设置备用功能
export function setupFallbackFunctionality() {
  // 捕获提示词的备用方案
  const capturePromptFallback = async (content: string): Promise<boolean> => {
    try {
      const key = `fallback_prompt_${Date.now()}`;
      await chrome.storage.local.set({ [key]: content });
      return true;
    } catch (error) {
      console.error('Fallback prompt capture failed:', error);
      return false;
    }
  };

  // 导出为全局函数，以便在通信失败时使用
  (window as any).aetherflowFallbacks = {
    capturePrompt: capturePromptFallback
  };
} 