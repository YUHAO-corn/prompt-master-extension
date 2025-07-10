import { Message, MessageCallback, MessageResponse, MessageType } from './types';

/**
 * 添加消息监听器
 * @param callback 消息处理回调函数
 */
export function addMessageListener(callback: MessageCallback): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Messaging] 收到消息:', message.type);
    const response = callback(message, sender, sendResponse);
    if (response instanceof Promise) {
      // 异步响应处理
      response
        .then(() => {
          console.log('[Messaging] 异步操作完成');
        })
        .catch(error => {
          console.error('[Messaging] 异步操作失败:', error);
        });
      return true; // 告诉Chrome我们会异步调用sendResponse
    }
    return response;
  });
}

/**
 * 发送消息并等待响应
 * @param message 要发送的消息
 * @returns 消息响应
 */
export function sendMessage<T, R>(message: Message<T>): Promise<R> {
  return new Promise((resolve, reject) => {
    // 生成唯一请求ID
    const requestId = Date.now().toString() + Math.random().toString().slice(2);
    const messageWithId = { ...message, requestId };
    
    // 设置超时处理
    const timeout = setTimeout(() => {
      reject(new Error(`消息超时: ${message.type}`));
    }, 5000);
    
    try {
      chrome.runtime.sendMessage(messageWithId, (response: MessageResponse<R>) => {
        clearTimeout(timeout);
        
        // 处理Chrome运行时错误
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        
        // 处理业务逻辑错误
        if (!response || response.success === false) {
          return reject(new Error(response?.error || '未知错误'));
        }
        
        // 返回成功响应数据
        resolve(response.data as R);
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * 向内容脚本发送消息
 * @param tabId 目标标签页ID
 * @param message 要发送的消息
 * @returns 消息响应
 */
export function sendMessageToTab<T, R>(tabId: number, message: Message<T>): Promise<R> {
  return new Promise((resolve, reject) => {
    // 生成唯一请求ID
    const requestId = Date.now().toString() + Math.random().toString().slice(2);
    const messageWithId = { ...message, requestId };
    
    // 设置超时处理
    const timeout = setTimeout(() => {
      reject(new Error(`向标签页发送消息超时: ${message.type}`));
    }, 5000);
    
    try {
      chrome.tabs.sendMessage(tabId, messageWithId, (response: MessageResponse<R>) => {
        clearTimeout(timeout);
        
        // 处理Chrome运行时错误
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        
        // 处理业务逻辑错误
        if (!response || response.success === false) {
          return reject(new Error(response?.error || '未知错误'));
        }
        
        // 返回成功响应数据
        resolve(response.data as R);
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

/**
 * 广播消息到所有上下文
 * 包括后台、所有内容脚本等
 * @param message 要广播的消息
 */
export function broadcastMessage<T>(message: Message<T>): void {
  // 广播到后台
  chrome.runtime.sendMessage(message);
  
  // 广播到所有标签页
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // 忽略错误，某些标签页可能无法接收消息
        });
      }
    });
  });
}

/**
 * 创建标准的成功响应对象
 */
export function createSuccessResponse<T>(data: T, requestId?: string): MessageResponse<T> {
  return {
    success: true,
    data,
    requestId
  };
}

/**
 * 创建标准的错误响应对象
 */
export function createErrorResponse(error: Error | string, requestId?: string): MessageResponse {
  return {
    success: false,
    error: typeof error === 'string' ? error : error.message,
    requestId
  };
}

// 导出类型
export * from './types';
