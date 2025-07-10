import { Message } from '../services/messaging/types';
import { addMessageListener } from '../services/messaging';
import { showNotification } from './notification';

// 全局消息ID计数器
let messageIdCounter = 0;

// 生成唯一消息ID
export function generateMessageId(): string {
  return `msg_${Date.now()}_${messageIdCounter++}`;
}

/**
 * 可靠消息发送函数 - 带重试、超时和备用机制
 */
export async function sendReliableMessage<T>(
  type: string, 
  data: any, 
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    useStorageFallback?: boolean;
    storageKey?: string;
  } = {}
): Promise<T | null> {
  const {
    timeoutMs = 5000,
    maxRetries = 3,
    retryDelayMs = 1000,
    useStorageFallback = false,
    storageKey
  } = options;

  // 发送消息的核心逻辑
  const sendWithRetry = async (retryCount: number): Promise<T | null> => {
    try {
      const messageId = generateMessageId();
      const response = await new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeoutMs}ms`));
        }, timeoutMs);

        chrome.runtime.sendMessage(
          { type, data, messageId },
          (response: T | undefined) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (response === undefined) {
              reject(new Error('Empty response received'));
            } else {
              resolve(response);
            }
          }
        );
      });

      return response;
    } catch (error) {
      console.error(`Message send failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
      
      if (retryCount < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (retryCount + 1)));
        return sendWithRetry(retryCount + 1);
      }
      
      if (useStorageFallback) {
        return useStorageFallbackStrategy();
      }
      
      return null;
    }
  };

  // 存储备用策略
  const useStorageFallbackStrategy = async (): Promise<T | null> => {
    if (!storageKey) return null;
    
    try {
      const fallbackData = await chrome.storage.local.get(storageKey);
      return fallbackData[storageKey] as T;
    } catch (error) {
      console.error('Storage fallback failed:', error);
      return null;
    }
  };

  return sendWithRetry(0);
}

// 设置消息监听器
export function setupMessageListeners() {
  addMessageListener((message: Message, sender, sendResponse) => {
    // console.log('[AetherFlow-DEBUG] 接收消息(全局监听器):', {
    //   type: message.type,
    //   data: message.data,
    //   sender: sender?.tab?.id || '未知',
    //   time: new Date().toISOString()
    // });
    
    // 特别处理PING消息，优先级最高
    if (message.type === 'PING') {
      // console.log('[AetherFlow-DEBUG] 收到PING消息, 发送PONG响应');
      sendResponse({ status: 'PONG', ready: true, time: new Date().toISOString() });
      return true;
    }
    
    // 未初始化完成时，仅处理通知消息
    if (message.type === 'SHOW_NOTIFICATION' && message.data) {
      // console.log('[AetherFlow-DEBUG] 显示通知(初始化前):', message.data.message);
      showNotification(
        message.data.message || '操作完成', 
        (message.data.type as 'success' | 'error') || 'success'
      );
      sendResponse({ success: true, source: 'global_listener', time: new Date().toISOString() });
      return true;
    }
    
    // 其他消息在初始化后处理
    return false;
  });
}

// 发送内容脚本就绪消息
export function sendReadyMessage() {
  // console.log('[AetherFlow-DEBUG] 发送内容脚本就绪消息:', {
  //   url: window.location.href,
  //   time: new Date().toISOString()
  // });
  
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    data: {
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      time: new Date().toISOString()
    }
  }, response => {
    // console.log('[AetherFlow-DEBUG] 内容脚本就绪通知反馈:', {
    //   response,
    //   time: new Date().toISOString()
    // });
  });
} 