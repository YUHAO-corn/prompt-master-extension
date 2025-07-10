import { sendReliableMessage } from './messaging';

// 健康检查结果接口
export interface HealthCheckResult {
  contentScriptLoaded: boolean;
  backgroundResponsive: boolean;
  storageFunctional: boolean;
  domAccessible: boolean;
  timestamp: number;
}

// 执行健康检查
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    contentScriptLoaded: true,
    backgroundResponsive: false,
    storageFunctional: false,
    domAccessible: false,
    timestamp: Date.now()
  };
  
  try {
    // 检查后台脚本响应
    const pingResponse = await sendReliableMessage<{ status: string }>('PING', null, {
      timeoutMs: 2000,
      maxRetries: 1
    });
    result.backgroundResponsive = pingResponse?.status === 'PONG';
  } catch (error) {
    console.error('Background script health check failed:', error);
  }
  
  try {
    // 检查存储功能
    await chrome.storage.local.set({ healthCheck: true });
    const testRead = await chrome.storage.local.get('healthCheck');
    result.storageFunctional = testRead.healthCheck === true;
    await chrome.storage.local.remove('healthCheck');
  } catch (error) {
    console.error('Storage health check failed:', error);
  }
  
  try {
    // 检查DOM访问
    result.domAccessible = document.readyState !== 'loading' && 
                          !!document.body && 
                          !!document.documentElement;
  } catch (error) {
    console.error('DOM access health check failed:', error);
  }
  
  return result;
}

// 尝试自动恢复
export async function attemptAutoRecovery(health: HealthCheckResult): Promise<boolean> {
  if (!health.backgroundResponsive) {
    try {
      // 尝试唤醒后台脚本
      await wakeupBackgroundScript();
      
      // 重新检查后台脚本响应
      const pingResponse = await sendReliableMessage<{ status: string }>('PING', null, {
        timeoutMs: 2000,
        maxRetries: 1
      });
      
      if (pingResponse?.status !== 'PONG') {
        console.error('Background script recovery failed');
        return false;
      }
    } catch (error) {
      console.error('Background script recovery attempt failed:', error);
      return false;
    }
  }
  
  if (!health.storageFunctional) {
    try {
      // 尝试重置存储
      await chrome.storage.local.clear();
      const testWrite = await chrome.storage.local.set({ recoveryTest: true });
      const testRead = await chrome.storage.local.get('recoveryTest');
      await chrome.storage.local.remove('recoveryTest');
      
      if (!testRead.recoveryTest) {
        console.error('Storage recovery failed');
        return false;
      }
    } catch (error) {
      console.error('Storage recovery attempt failed:', error);
      return false;
    }
  }
  
  return true;
}

// 唤醒后台脚本
async function wakeupBackgroundScript(): Promise<void> {
  try {
    // 发送唤醒消息
    await chrome.runtime.sendMessage({ type: 'WAKEUP' });
    
    // 等待后台脚本初始化
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Failed to wakeup background script:', error);
    throw error;
  }
}

// 设置自动恢复系统
export function setupAutoRecoverySystem() {
  // 每5分钟执行一次健康检查
  setInterval(async () => {
    const health = await performHealthCheck();
    
    // 如果发现问题，尝试自动恢复
    if (!health.backgroundResponsive || !health.storageFunctional) {
      console.log('[AetherFlow-DEBUG] 检测到系统异常，尝试自动恢复:', health);
      const recovered = await attemptAutoRecovery(health);
      
      if (!recovered) {
        console.error('自动恢复失败，系统可能需要手动干预');
      } else {
        console.log('自动恢复成功');
      }
    }
  }, 5 * 60 * 1000); // 5分钟
} 