import { isServiceWorkerEnvironment } from './safeEnvironment';

/**
 * 防抖函数工具
 * 
 * 将多次高频率调用转换为最后一次调用执行，常用于：
 * - 搜索框输入时等用户输入完毕再查询
 * - 滚动事件处理，避免过于频繁的触发
 * - 窗口尺寸调整时的重新布局
 * - 防止多次点击导致的重复操作
 * 
 * @param func 需要防抖的函数
 * @param wait 等待时间(毫秒)
 * @param immediate 是否立即执行，true表示立即执行，false表示延迟执行
 * @returns 返回防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300,
  immediate: boolean = false
): (...args: Parameters<T>) => void {
  let timeout: number | ReturnType<typeof setTimeout> | null = null;

  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    // 清除之前的延迟执行
    if (timeout !== null) {
      // 根据环境使用不同的 clearTimeout
      if (isServiceWorkerEnvironment) {
        clearTimeout(timeout as ReturnType<typeof setTimeout>);
      } else {
        window.clearTimeout(timeout as number);
      }
      timeout = null;
    }

    // 创建定时器函数 - 适配不同环境
    const createTimeout = (callback: () => void, delay: number): number | ReturnType<typeof setTimeout> => {
      if (isServiceWorkerEnvironment) {
        return setTimeout(callback, delay);
      } else {
        return window.setTimeout(callback, delay);
      }
    };

    if (immediate && timeout === null) {
      // 立即执行模式 & 首次调用
      func.apply(context, args);
      timeout = createTimeout(() => {
        timeout = null;
      }, wait);
    } else {
      // 延迟执行模式
      timeout = createTimeout(() => {
        func.apply(context, args);
        timeout = null;
      }, wait);
    }
  };
} 