import React, { useState } from 'react';

export interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
  className?: string;
}

/**
 * 通用Tooltip组件 - 提供美观的hover提示
 * 支持多种位置、大小和主题适配
 */
export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  size = 'md',
  delay = 0,
  className = ''
}: TooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (delay > 0) {
      const id = setTimeout(() => {
        setShowTooltip(true);
      }, delay);
      setTimeoutId(id);
    } else {
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setShowTooltip(false);
  };

  // 获取位置相关的CSS类
  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
      case 'bottom':
        return 'top-full mt-2 left-1/2 transform -translate-x-1/2';
      case 'left':
        return 'right-full mr-2 top-1/2 transform -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 transform -translate-y-1/2';
      default:
        return 'bottom-full mb-2 left-1/2 transform -translate-x-1/2';
    }
  };

  // 获取箭头位置相关的CSS类
  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b';
      case 'bottom':
        return 'top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t';
      case 'left':
        return 'right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45 border-t border-r';
      case 'right':
        return 'left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-l';
      default:
        return 'bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 border-r border-b';
    }
  };

  // 获取大小相关的CSS类
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-2 py-1 text-xs max-w-[120px]';
      case 'md':
        return 'px-3 py-2 text-sm max-w-[160px]';
      case 'lg':
        return 'px-4 py-3 text-sm max-w-[200px]';
      default:
        return 'px-3 py-2 text-sm max-w-[160px]';
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && content && (
        <div 
          className={`absolute z-50 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-white 
                     border border-gray-200 dark:border-gray-700 shadow-lg 
                     transition-opacity duration-150 whitespace-nowrap
                     ${getPositionClasses()} ${getSizeClasses()}`}
        >
          {content}
          <div 
            className={`absolute w-2 h-2 bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700 ${getArrowClasses()}`}
          />
        </div>
      )}
    </div>
  );
} 