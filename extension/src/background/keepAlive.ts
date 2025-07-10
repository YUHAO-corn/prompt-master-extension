// extension/src/background/keepAlive.ts

import { checkContentScriptStatus } from './contentScriptManager';
import { processPendingCaptures } from './promptHandler';

/**
 * 设置Service Worker保活机制，防止长时间不活动后休眠
 * Chrome扩展的Service Worker会在不活动后休眠，这会导致功能失效
 */
function setupServiceWorkerKeepAlive() {
  console.log('[AetherFlow] 设置Service Worker保活机制');

  // 记录心跳次数
  let heartbeatCount = 0;

  // 设置定期唤醒闹钟
  chrome.alarms.create('aetherflow-keepalive', {
    periodInMinutes: 1 // 每1分钟唤醒一次
  });

  // 监听闹钟事件
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'aetherflow-keepalive') {
      heartbeatCount++;

      // 每10次心跳打印一次日志，避免日志过多
      if (heartbeatCount % 10 === 0) {
        console.log(`[AetherFlow] Service Worker心跳 #${heartbeatCount} (通过alarms API)`);
      }

      // 执行一些轻量级操作保持活跃
      chrome.storage.local.get('lastHeartbeat', (result) => {
        chrome.storage.local.set({
          'lastHeartbeat': Date.now(),
          'heartbeatCount': heartbeatCount
        });
      });

      // 检查所有标签页的内容脚本状态
      refreshContentScriptsStatus();

      // 处理暂存的捕获请求
      processPendingCaptures();
    }
  });

  // 额外使用消息机制作为备份
  // const sendHeartbeat = () => {
  //   // 向自己发送消息保持活跃
  //   chrome.runtime.sendMessage({ type: 'HEARTBEAT', count: heartbeatCount })
  //     .catch(error => {
  //       // 忽略错误，这里只是为了保持活跃
  //     });
  // };

  // 设置定时器，每60秒发送一次心跳
  // setInterval(sendHeartbeat, 60000); // Commented out: Broadcasting HEARTBEAT is likely redundant due to chrome.alarms and causes unnecessary pings.

  // 监听HEARTBEAT消息，用于响应自己发送的心跳
  // 注意：这个监听器可能需要移到主监听器模块，以避免重复注册
  // chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  //   if (message && message.type === 'HEARTBEAT') {
  //     // 立即响应，保持活跃
  //     sendResponse({ alive: true, count: message.count });
  //     return true;
  //   }
  //   return false; // Important: Only return true for async responses or handled sync messages
  // }); // Commented out: This listener corresponds to the removed setInterval broadcast. Central listener in listeners.ts might still handle HEARTBEAT if sent from elsewhere, but this specific listener is now redundant.

  // 刷新所有标签页的内容脚本状态
  function refreshContentScriptsStatus() {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && tab.url && tab.url.startsWith('http')) {
          checkContentScriptStatus(tab.id).catch(() => {
            // 忽略错误，这只是一个状态检查
          });
        }
      });
    });
  }

  // 立即注册一个一次性的闹钟，确保启动后很快就执行一次
  chrome.alarms.create('aetherflow-keepalive-initial', {
    delayInMinutes: 0.1 // 6秒后执行一次
  });
}

// 导出初始化函数
export function initializeKeepAlive() {
    setupServiceWorkerKeepAlive();
} 