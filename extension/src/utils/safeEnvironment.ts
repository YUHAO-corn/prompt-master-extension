/**
 * 安全环境工具 - 提供在不同环境下安全访问浏览器API的方法
 * 特别是在Service Worker环境（没有window对象）中提供替代实现
 */

// 检测是否在Service Worker环境中
export const isServiceWorkerEnvironment = typeof window === 'undefined';

// 检测是否在扩展环境中
export const isChromeExtensionEnvironment = 
  typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

/**
 * 安全获取localStorage
 * 在Service Worker中返回一个内存存储的替代实现
 */
class MemoryStorage {
  private storage: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.storage[key] || null;
  }

  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }

  removeItem(key: string): void {
    delete this.storage[key];
  }

  clear(): void {
    this.storage = {};
  }
}

// 内存中的localStorage替代品
const memoryLocalStorage = new MemoryStorage();

// 安全的localStorage - 在Service Worker中使用内存存储
export const safeLocalStorage = isServiceWorkerEnvironment
  ? memoryLocalStorage
  : window.localStorage;

/**
 * 安全地获取当前位置信息
 * 在Service Worker环境下返回null
 */
export const safeLocation = isServiceWorkerEnvironment 
  ? null 
  : window.location;

/**
 * 安全地执行仅在window环境下工作的代码
 * @param callback 需要执行的函数
 * @param fallback 在Service Worker环境中的替代行为
 */
export function runInWindowEnvironment<T>(
  callback: () => T, 
  fallback: () => T
): T {
  if (isServiceWorkerEnvironment) {
    return fallback();
  }
  return callback();
}

/**
 * 日志输出工具，自动添加环境标记
 */
export const safeLogger = {
  log: (...args: any[]) => {
    const prefix = isServiceWorkerEnvironment ? '[SW]' : '[Window]';
    console.log(prefix, ...args);
  },
  error: (...args: any[]) => {
    const prefix = isServiceWorkerEnvironment ? '[SW]' : '[Window]';
    console.error(prefix, ...args);
  },
  warn: (...args: any[]) => {
    const prefix = isServiceWorkerEnvironment ? '[SW]' : '[Window]';
    console.warn(prefix, ...args);
  }
};

/**
 * 确保代码即使在Service Worker环境中也能安全运行
 * 如果是不安全的代码，在Service Worker中会被跳过
 * @param unsafeCode 可能使用window的不安全代码
 */
export function safeExecution(unsafeCode: () => void): void {
  if (!isServiceWorkerEnvironment) {
    try {
      unsafeCode();
    } catch (error) {
      console.error('安全执行失败:', error);
    }
  }
} 