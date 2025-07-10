/**
 * 尝试为给定的标签页打开侧边栏。
 * @param tab 目标标签页对象。
 * @param promptLogin 是否提示用户登录。
 */
export async function openSidePanelForTab(tab: chrome.tabs.Tab, promptLogin?: boolean) {
  if (!tab || !tab.windowId || !tab.id) {
    console.error('[SidePanelManager] 无法打开侧边栏：缺少标签页、窗口ID或标签页ID');
    throw new Error('Missing tab, window ID, or tab ID.');
  }
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    console.log(`[SidePanelManager] 侧边栏已在窗口 ${tab.windowId} 中打开或聚焦`);

    if (promptLogin) {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'SHOW_AUTH_MODAL_WITH_PROMPT',
          payload: { message: 'Please log in to use this feature.' }
        }).catch(error => {
          console.error(`[SidePanelManager] Error sending SHOW_AUTH_MODAL_WITH_PROMPT via runtime.sendMessage:`, error);
        });
      }, 200);
    }
  } catch (error) {
    console.error(`[SidePanelManager] 在窗口 ${tab.windowId} 中打开侧边栏时出错:`, error);
    throw error; // Re-throw the error for the caller (e.g., message listener) to handle
  }
}

/**
 * 初始化侧边栏相关功能：设置行为并监听图标点击。
 */
export function initializeSidePanel() {
  // 1. 设置侧边栏行为：点击扩展图标时打开侧边栏
  // 注意：这个设置本身就会让图标点击打开侧边栏，下面的 onClicked 监听器是为了额外的日志记录或将来可能的逻辑扩展
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: Error) => {
    console.error('[SidePanelManager] 设置侧边栏行为失败:', error);
  });

  // 2. 监听扩展图标点击事件 (主要用于日志记录或未来扩展)
  // 如果 setPanelBehavior 正常工作，这个监听器里的 openSidePanelForTab 调用可能不是严格必需的，
  // 但保留它可以提供明确的日志或处理 setPanelBehavior 可能失败的情况。
  if (!chrome.action.onClicked.hasListener(handleActionClick)) {
      chrome.action.onClicked.addListener(handleActionClick);
      console.log('[SidePanelManager] 图标点击监听器已添加。');
  } else {
       console.log('[SidePanelManager] 图标点击监听器已存在。');
  }
}

// 处理图标点击事件的内部函数
async function handleActionClick(tab: chrome.tabs.Tab) {
    console.log('[SidePanelManager] 扩展图标被点击 (来自 onClicked 监听器)');
    try {
        // 再次尝试打开，确保万无一失，并处理可能的错误
        await openSidePanelForTab(tab);
    } catch(error) {
        console.error('[SidePanelManager] 处理图标点击时打开侧边栏出错:', error);
        // 这里可以考虑发送一个通知给用户，如果打开失败
    }
} 