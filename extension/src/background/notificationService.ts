import { isContentScriptReady } from './contentScriptManager';

/**
 * 强制显示通知，绕过内容脚本，直接注入DOM。
 * @param tabId 目标标签页ID
 * @param message 通知消息
 * @param type 通知类型 ('success' | 'error')
 * @returns 是否成功执行注入
 */
async function forceShowNotification(tabId: number, message: string, type: 'success' | 'error'): Promise<boolean> {
  try {
    console.log(`[AetherFlow] 强制显示通知: ID=${tabId}, 消息=${message}`);
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, typ) => {
        console.log('[AetherFlow-INJECT] 强制显示通知:', msg);
        const existingNotification = document.getElementById('aetherflow-notification');
        if (existingNotification) {
          existingNotification.remove(); // Use remove() for simplicity
        }

        const notification = document.createElement('div');
        notification.id = 'aetherflow-notification';
        Object.assign(notification.style, {
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          padding: '12px 20px',
          borderRadius: '4px',
          zIndex: '2147483647',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.3s ease-in-out',
          opacity: '0',
          transform: 'translateY(20px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: typ === 'success' ? '#4CAF50' : '#F44336',
          color: 'white',
          border: `1px solid ${typ === 'success' ? '#43A047' : '#E53935'}`
        });

        const icon = typ === 'success' ? '✓' : '✗';
        notification.textContent = `${icon} ${msg}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = '1';
          notification.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
          notification.style.opacity = '0';
          notification.style.transform = 'translateY(20px)';
          setTimeout(() => notification.remove(), 300);
        }, 3000);

        return true; // Indicate success from injected script
      },
      args: [message, type]
    });
    // Check if injection succeeded and the function returned true
    return result && result[0] && result[0].result === true;
  } catch (error) {
    console.error(`[AetherFlow] 强制显示通知失败:`, error);
    return false;
  }
}

/**
 * 安全地向内容脚本发送通知。
 * 会先检查内容脚本是否就绪，如果未就绪或超时，则尝试强制注入通知。
 * @param tabId 目标标签页ID
 * @param message 通知消息
 * @param type 通知类型 ('success' | 'error')
 * @returns 是否成功发送或注入通知
 */
export async function safelySendNotification(tabId: number, message: string, type: 'success' | 'error'): Promise<boolean> {
  console.log(`[AetherFlow-DEBUG] 尝试发送通知: ID=${tabId}, 消息=${message}, 类型=${type}`);
  if (!tabId || tabId <= 0) {
    console.warn(`[AetherFlow-DEBUG] 无法发送通知，标签页ID无效: ${tabId}`);
    return false;
  }

  try {
    console.log(`[AetherFlow-DEBUG] 发送通知前检查内容脚本: ID=${tabId}`);
    // 设置超时，防止检查卡住
    const checkPromise = isContentScriptReady(tabId); // Use imported function
    const timeoutPromise = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1000)); // 1秒超时
    const isReady = await Promise.race([checkPromise, timeoutPromise]);

    if (!isReady) {
      console.warn(`[AetherFlow-DEBUG] 目标标签页内容脚本未就绪或检查超时，尝试强制注入: ID=${tabId}`);
      try {
        // 尝试通过executeScript强制注入通知函数
        return await forceShowNotification(tabId, message, type); // Use internal function
      } catch (injectError) {
        console.error(`[AetherFlow-DEBUG] 强制注入通知失败: ID=${tabId}`, injectError);
        return false;
      }
    }

    // 脚本就绪，发送通知
    console.log(`[AetherFlow-DEBUG] 内容脚本就绪，发送通知消息: ID=${tabId}`);
    return new Promise(resolve => {
      const timeoutId = setTimeout(() => {
        console.warn(`[AetherFlow-DEBUG] 发送通知消息超时: ID=${tabId}`);
        resolve(false); // Indicate failure on timeout
      }, 2000); // 2秒超时

      chrome.tabs.sendMessage(
        tabId,
        { type: 'SHOW_NOTIFICATION', data: { message, type } },
        response => {
          clearTimeout(timeoutId);
          if (chrome.runtime.lastError) {
            console.warn(`[AetherFlow-DEBUG] 发送通知消息错误: ID=${tabId}, 错误=${chrome.runtime.lastError.message}`);
            resolve(false);
          } else {
            console.log(`[AetherFlow-DEBUG] 通知消息已发送, 响应:`, response);
            // Assuming any response indicates success for now
            resolve(response?.success ?? true); // Resolve with response success or assume true
          }
        }
      );
    });
  } catch (error) {
    console.error(`[AetherFlow-DEBUG] 发送通知时出错: ID=${tabId}`, error);
    return false;
  }
}

// 没有需要在此模块初始化的内容，除非将来需要配置
// export function initializeNotificationService() { ... } 