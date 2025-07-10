import { Message } from '../services/messaging/types';
import { setupMessageListeners, sendReadyMessage as sendReady } from './messaging';
import { setupDOMObserver, setupDocumentListeners, cleanupDOMObserver } from './domObserver';
import { setupAutoRecoverySystem as setupHealthCheck } from './healthCheck';
import { setupFallbackFunctionality as setupFallback } from './utils';
import { initCaptureFeature } from './capture';
import { init as initPromptShortcut } from './promptShortcutContentScript';
// TODO: contentService需要重构，临时注释处理
// import { contentService } from '../services/content';

// console.log('[AetherFlow-DEBUG] 内容脚本开始加载', {
//   url: window.location.href,
//   domain: window.location.hostname,
//   time: new Date().toISOString(),
//   userAgent: navigator.userAgent
// });

// 立即设置消息监听器
setupMessageListeners();

// 简化的通知函数 - 用于向用户显示通知
function showNotification(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
  // 创建一个简单的通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 15px;
    background-color: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
    color: white;
    border-radius: 4px;
    z-index: 9999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // 3秒后自动移除
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

// 初始化函数
function initialize() {
  if (window.aetherflowInitialized) {
    // console.log('[AetherFlow-DEBUG] 内容脚本已初始化，跳过');
    return;
  }

  // 设置消息监听器
  setupMessageListeners();

  // 设置DOM观察器
  setupDOMObserver();

  // 设置文档状态监听
  setupDocumentListeners();

  // 设置自动恢复系统
  setupHealthCheck();

  // 设置备用功能
  setupFallback();

  // Initialize Capture Feature
  initCaptureFeature();

  // 初始化PromptShortcut功能
  initPromptShortcut();

  // 标记初始化完成
  window.aetherflowInitialized = true;

  // console.log('[AetherFlow-DEBUG] 内容脚本初始化完成', {
  //   time: new Date().toISOString(),
  //   url: window.location.href
  // });
}

// 全局标记内容脚本初始化状态
declare global {
  interface Window {
    aetherflowInitialized?: boolean;
    aetherflowRefreshHintShown?: boolean;
    aetherflowStorageHintShown?: boolean;
    aetherflowBackgroundCheck?: any;
    aetherflowLastBackgroundAlive?: number;
  }
}

// 监听页面完全加载完成事件
window.addEventListener('load', () => {
  // console.log('[AetherFlow-DEBUG] 页面加载完成事件触发:', {
  //   time: new Date().toISOString(),
  //   url: window.location.href
  // });
  
  // 延迟发送就绪消息，确保DOM完全加载
  setTimeout(() => {
    sendReady();
  }, 500);
});

// 监听重新初始化事件
window.addEventListener('aetherflow-reinitialize', () => {
  // console.log('[AetherFlow-DEBUG] 收到重新初始化事件', {
  //   time: new Date().toISOString(),
  //   url: window.location.href
  // });
  
  // 清理现有观察器
  cleanupDOMObserver();
  
  // 重置初始化状态
  window.aetherflowInitialized = false;
  
  // 重新初始化
  initialize();
  
  // 重新发送就绪消息
  sendReady();
});

// 立即发送就绪消息
sendReady();

// 立即初始化
initialize();
