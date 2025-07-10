/**
 * 环境检测工具函数
 * 用于识别代码运行的环境，以便适配不同的数据获取策略
 */

/**
 * 检查当前是否在扩展环境中运行
 * 比如在popup、options、sidepanel等扩展页面中
 * 而非在content script(注入到网页的脚本)中
 */
export function isExtensionContext(): boolean {
  // 扩展环境特征检查
  // 1. 检查URL是否带有chrome-extension://前缀
  // 2. 检查是否存在chrome.extension.getURL函数
  // 3. 检查是否能访问chrome.runtime.id
  if (typeof window !== 'undefined') {
    // 检查URL
    if (window.location.href.startsWith('chrome-extension://')) {
      return true;
    }
    
    // 检查chrome API能力
    try {
      if (
        chrome?.extension?.getURL && 
        typeof chrome.extension.getURL === 'function' &&
        chrome?.runtime?.id
      ) {
        return true;
      }
    } catch (e) {
      // 忽略错误，在有些环境尝试访问这些API会引发异常
    }
  }
  
  return false;
}

/**
 * 检查当前是否在Chrome扩展的背景页(Background Script)中运行
 */
export function isBackgroundContext(): boolean {
  // 背景页特征检查
  try {
    // 检查是否有特定的后台页面标识
    if (
      typeof chrome !== 'undefined' && 
      chrome?.extension?.getBackgroundPage && 
      chrome.extension.getBackgroundPage() === window
    ) {
      return true;
    }
  } catch (e) {
    // 忽略错误
  }
  
  // 也可以通过页面URL判断（仅适用于旧版MV2扩展）
  if (
    typeof window !== 'undefined' && 
    window.location.pathname.endsWith('background.html')
  ) {
    return true;
  }
  
  return false;
}

/**
 * 检查当前是否在Chrome扩展的内容脚本(Content Script)中运行
 */
export function isContentScriptContext(): boolean {
  // 内容脚本特征检查
  // 1. 不是扩展页面 
  // 2. 能够访问chrome.runtime API
  try {
    if (
      !isExtensionContext() && 
      typeof chrome !== 'undefined' && 
      chrome?.runtime?.id
    ) {
      return true;
    }
  } catch (e) {
    // 忽略错误
  }
  
  return false;
}

/**
 * 检查当前是否在开发环境中
 */
export function isDevelopmentEnvironment(): boolean {
  // 开发环境特征检查
  if (typeof window !== 'undefined') {
    // 检查是否为localhost
    if (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1'
    ) {
      return true;
    }
    
    // 检查是否有开发者标记
    try {
      return window.localStorage.getItem('DEV_MODE') === 'true';
    } catch (e) {
      // 忽略错误
    }
  }
  
  return false;
} 