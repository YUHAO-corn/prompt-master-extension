// extension/src/background/contentScriptManager.ts

// 跟踪内容脚本状态
const contentScriptRegistry = new Map<number, boolean>();

// 检查内容脚本状态并记录
export async function checkContentScriptStatus(tabId: number): Promise<void> {
  console.log(`[AetherFlow-DEBUG] 主动检查内容脚本状态: ID=${tabId}`);
  try {
    const ready = await isContentScriptReady(tabId);
    console.log(`[AetherFlow-DEBUG] 内容脚本状态检查结果: ID=${tabId}, 就绪=${ready}`);
  } catch (error) {
    console.error(`[AetherFlow-DEBUG] 检查内容脚本状态出错: ID=${tabId}`, error);
  }
}

// 检查内容脚本是否就绪 (也供外部模块如 notificationService 调用)
export function isContentScriptReady(tabId: number): Promise<boolean> {
  console.log(`[AetherFlow-DEBUG] 开始检查内容脚本就绪状态: ID=${tabId}, 已注册=${contentScriptRegistry.has(tabId)}`);

  // 首先检查注册表中是否已记录此标签页
  if (contentScriptRegistry.has(tabId)) {
    console.log(`[AetherFlow-DEBUG] 内容脚本已在注册表中: ID=${tabId}`);
    return Promise.resolve(true);
  }

  // 否则发送ping消息检查
  return new Promise(resolve => {
    try {
      console.log(`[AetherFlow-DEBUG] 发送PING消息检查内容脚本: ID=${tabId}`);
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, response => {
        if (chrome.runtime.lastError) {
          console.log(`[AetherFlow-DEBUG] 内容脚本未就绪: ID=${tabId}, 错误=${chrome.runtime.lastError.message}`);
          resolve(false);
        } else {
          console.log(`[AetherFlow-DEBUG] 内容脚本已就绪: ID=${tabId}, 响应=`, response);
          // 记录此标签页的内容脚本已就绪
          contentScriptRegistry.set(tabId, true);
          resolve(true);
        }
      });
    } catch (error) {
      console.error(`[AetherFlow-DEBUG] 检查内容脚本就绪状态时出错: ID=${tabId}`, error);
      resolve(false);
    }
  });
}

// 供外部消息处理器调用，当内容脚本明确发送 'CONTENT_SCRIPT_READY' 消息时
export function markContentScriptReady(tabId: number, url?: string) {
    if (!contentScriptRegistry.has(tabId)) {
        contentScriptRegistry.set(tabId, true);
        console.log(`[AetherFlow] 内容脚本已就绪 (通过消息): 标签页ID ${tabId}, URL ${url || '未知'}`);
    }
}


// 初始化内容脚本状态跟踪的监听器
function setupContentScriptTracking() {
  // 记录页面加载和内容脚本注册情况
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log(`[AetherFlow-DEBUG] 页面更新: ID=${tabId}, 状态=${changeInfo.status}, URL=${tab.url?.substring(0, 50)}`);

    // 当页面完成加载时，尝试检查内容脚本是否就绪
    // 这作为一种补充，主要依赖内容脚本自己发送 'CONTENT_SCRIPT_READY' 消息
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
      console.log(`[AetherFlow-DEBUG] 页面加载完成: ID=${tabId}, 延迟检查内容脚本`);
      // 稍微延迟检查，给内容脚本一点时间注入和发送 PING 响应
      setTimeout(() => {
        checkContentScriptStatus(tabId);
      }, 1500); // 稍微增加延迟
    } else if (changeInfo.status === 'loading') {
       // 如果页面开始重新加载，我们应该认为内容脚本不再就绪，将其从注册表中移除
       if (contentScriptRegistry.has(tabId)) {
           console.log(`[AetherFlow-DEBUG] 页面重新加载，移除注册: ID=${tabId}`);
           contentScriptRegistry.delete(tabId);
       }
    }
  });

  // 监听标签页关闭，移除注册表中的记录
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (contentScriptRegistry.has(tabId)) {
      console.log(`[AetherFlow-DEBUG] 标签页关闭，移除注册: ID=${tabId}`);
      contentScriptRegistry.delete(tabId);
    }
  });

  console.log('[AetherFlow] 内容脚本状态跟踪监听器已设置。');
}


// 导出初始化函数
export function initializeContentScriptTracking() {
    setupContentScriptTracking();
} 