import { useState, useEffect } from 'react';

/**
 * 计算提示词浮层位置的钩子
 * @param inputElement 输入元素
 * @param floatWidth 浮层宽度
 * @param floatHeight 浮层高度
 */
export function usePromptPosition(
  inputElement: HTMLElement,
  floatWidth: number = 320,
  floatHeight: number = 300
) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showAbove, setShowAbove] = useState(false);

  useEffect(() => {
    // 计算显示位置
    const calculatePosition = () => {
      const inputRect = inputElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 计算光标位置
      let cursorLeft = inputRect.left;
      let cursorTop = inputRect.bottom;
      
      try {
        if (window.getSelection && inputElement.isContentEditable) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            if (rects.length > 0) {
              cursorLeft = rects[0].left;
              cursorTop = rects[0].bottom;
            }
          }
        } else if (inputElement instanceof HTMLTextAreaElement || inputElement instanceof HTMLInputElement) {
          // 对于textarea和input，我们只能近似光标位置
          cursorLeft = inputRect.left + 20; // 简单偏移
        }
      } catch (e) {
        console.error('[AetherFlow] 计算光标位置失败:', e);
      }
      
      // 调整水平位置，确保不超出右边界
      if (cursorLeft + floatWidth > viewportWidth - 20) {
        cursorLeft = Math.max(20, viewportWidth - floatWidth - 20);
      }
      
      // 确定是显示在输入框上方还是下方
      let positionTop;
      let shouldShowAbove = false;
      
      // 如果底部空间不足则显示在输入框上方
      if (cursorTop + floatHeight > viewportHeight - 20) {
        shouldShowAbove = true;
        // 将浮层下边缘固定在光标上方
        positionTop = inputRect.top - 10;
      } else {
        // 正常情况，上边缘固定在光标下方
        positionTop = cursorTop;
      }
      
      setPosition({
        top: positionTop + window.scrollY,
        left: cursorLeft + window.scrollX
      });
      
      setShowAbove(shouldShowAbove);
    };

    // 初始计算
    calculatePosition();
    
    // 监听窗口大小变化重新计算位置
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
    
    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [inputElement, floatWidth, floatHeight]);

  return { position, showAbove };
} 