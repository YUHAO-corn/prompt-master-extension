// extension/src/background/contextMenu.ts

import { safelySendNotification } from './notificationService';

/**
 * 设置上下文菜单项。
 */
function setupContextMenu() {
  // 先尝试移除旧的，再创建新的，确保只有一个菜单项
  chrome.contextMenus.remove('captureSelection', () => {
    // 忽略移除错误 (可能首次运行不存在)
    if (chrome.runtime.lastError) {
      console.debug('移除旧右键菜单项时出错 (可能不存在):', chrome.runtime.lastError.message);
    }
    // 创建新的菜单项
    chrome.contextMenus.create({
      id: 'captureSelection',
      title: 'AetherFlow: Capture selection', // 使用英文或根据需要国际化
      contexts: ['selection'] // 只在有选中文本时显示
    }, () => {
        if (chrome.runtime.lastError) {
            console.warn("创建右键菜单项时出错:", chrome.runtime.lastError.message);
        } else {
            console.log("[AetherFlow] 上下文菜单项 'captureSelection' 已创建或更新。");
        }
    });
  });
}

/**
 * 处理上下文菜单点击事件。
 * 点击后，向对应标签页的内容脚本发送消息，请求显示捕获模态框。
 */
function onContextMenuClicked(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (info.menuItemId === 'captureSelection' && info.selectionText && tab?.id) {
    const tabId = tab.id;
    const content = info.selectionText;
    const sourceUrl = tab.url;
    console.log(`[AetherFlow] Context Menu: 请求为 Tab ${tabId} 的选中文本显示捕获模态框`, content.substring(0, 50) + '...');

    chrome.tabs.sendMessage(
      tabId,
      {
        type: 'SHOW_CAPTURE_MODAL_FROM_CONTEXT',
        payload: {
          content: content,
          sourceUrl: sourceUrl
        }
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(`[AetherFlow] 发送 SHOW_CAPTURE_MODAL 消息到 Tab ${tabId} 失败:`, chrome.runtime.lastError.message);
          // 发送消息失败时，尝试给用户一个通知
          safelySendNotification(tabId, 'Could not open AetherFlow capture window.', 'error');
        } else {
          console.log(`[AetherFlow] SHOW_CAPTURE_MODAL 消息成功发送到 Tab ${tabId}, 响应:`, response);
        }
      }
    );
  } else {
    console.warn("[AetherFlow] 上下文菜单点击被忽略: 缺少 selectionText 或 tab ID.");
  }
}

/**
 * 初始化上下文菜单功能：设置菜单项并添加点击监听器。
 */
export function initializeContextMenu() {
  setupContextMenu();
  // 确保只添加一次监听器
  // Note: chrome.contextMenus.onClicked.hasListener might not be reliable in all contexts,
  // especially after SW restarts. Relying on setupContextMenu to handle potential duplicates might be safer.
  // For simplicity, let's just add the listener. If called multiple times (e.g., on SW restart),
  // setupContextMenu should handle the menu item creation idempotently.
  // Removing the check: if (!chrome.contextMenus.onClicked.hasListener(onContextMenuClicked)) { ... }
  chrome.contextMenus.onClicked.addListener(onContextMenuClicked);
  console.log("[AetherFlow] 上下文菜单点击监听器已添加/重新添加。");
}
