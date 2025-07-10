// DOM变化观察器
let observer: MutationObserver;

// 设置DOM观察器
export function setupDOMObserver() {
  // 记录DOM变化，用于调试
  observer = new MutationObserver((mutations) => {
    // console.log('[AetherFlow-DEBUG] 检测到DOM变化:', {
    //   count: mutations.length,
    //   time: new Date().toISOString()
    // });
  });

  // 开始监听DOM变化
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
}

// 设置文档状态监听
export function setupDocumentListeners() {
  // 监听文档加载状态
  document.addEventListener('readystatechange', () => {
    // console.log('[AetherFlow-DEBUG] 文档状态变化:', {
    //   readyState: document.readyState,
    //   time: new Date().toISOString()
    // });
  });

  // 监听页面完全加载完成事件
  window.addEventListener('load', () => {
    // console.log('[AetherFlow-DEBUG] 页面加载完成事件触发:', {
    //   time: new Date().toISOString(),
    //   url: window.location.href
    // });
  });
}

// 清理DOM观察器
export function cleanupDOMObserver() {
  if (observer) {
    observer.disconnect();
  }
} 