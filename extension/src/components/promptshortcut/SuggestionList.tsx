import React, { useRef, useEffect } from 'react';
import SuggestionItem from './SuggestionItem'; // Import SuggestionItem

interface Suggestion {
  id: string;
  title: string;
  content: string; // Ensure content is here if passing whole suggestion up
  createdAt?: number;
  // Add other relevant fields from your Prompt type if needed for display
}

interface SuggestionListProps {
  suggestions: Suggestion[]; // Assumed to always have items when rendered
  highlightedIndex: number | null;
  onSuggestionClick: (suggestion: Suggestion) => void; // Added prop
  searchTerm: string; // Added searchTerm prop
}

declare global {
  interface Window {
    promptShortcutUpdatePosition?: () => void;
  }
}

const SuggestionList: React.FC<SuggestionListProps> = ({
  suggestions,
  highlightedIndex,
  onSuggestionClick,
  searchTerm,
}) => {
  // 添加容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  // 添加项目引用映射
  const itemRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  
  // 监听高亮索引变化，实现自动滚动
  useEffect(() => {
    if (highlightedIndex !== null && containerRef.current && itemRefs.current[highlightedIndex]) {
      const container = containerRef.current;
      const item = itemRefs.current[highlightedIndex];
      
      if (item) {
        // 计算项目是否在可视区域内
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        
        // 检查是否需要滚动
        if (itemRect.bottom > containerRect.bottom) {
          // 需要向下滚动
          item.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else if (itemRect.top < containerRect.top) {
          // 需要向上滚动
          item.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [highlightedIndex]);

  // 当建议列表内容变化时，触发位置更新
  useEffect(() => {
    // 等待DOM更新后再触发位置调整
    const timer = setTimeout(() => {
      try {
        // 尝试调用内容脚本中注入的updatePosition全局函数
        if (window.promptShortcutUpdatePosition) {
          console.log('[PromptShortcut] 列表内容变化，触发位置更新');
          window.promptShortcutUpdatePosition();
        }
      } catch (error) {
        console.error('[PromptShortcut] 触发位置更新失败:', error);
      }
    }, 10); // 短暂延迟确保DOM已更新

    return () => clearTimeout(timer);
  }, [suggestions.length]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div 
      className="mt-1 max-h-60 overflow-auto scrollbar-thin w-full" 
      style={{ 
        borderRadius: '0', 
        overflow: 'auto',
        // 智能限制最大高度，避免超出屏幕
        maxHeight: `min(180px, calc(100vh - 100px))`
      }}
      ref={containerRef}
    >
      <div className="w-full">
        {suggestions.map((suggestion, index) => (
          <div 
            key={suggestion.id}
            ref={el => itemRefs.current[index] = el}
          >
            <SuggestionItem
              suggestion={suggestion}
              isHighlighted={index === highlightedIndex}
              onClick={() => onSuggestionClick(suggestion)} // Call onSuggestionClick with the suggestion
              searchTerm={searchTerm} // Pass searchTerm down
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestionList; 