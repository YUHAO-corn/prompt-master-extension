import React, { useRef, useEffect } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onEnter?: () => void;
  onTab?: () => void;
  onEscape?: () => void;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  onArrowDown,
  onArrowUp,
  onEnter,
  onTab,
  onEscape,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 处理输入变化 - 总是保持斜杠前缀
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 获取当前输入值
    let currentValue = e.target.value;
    
    // 如果用户尝试删除斜杠前缀，通知父组件处理关闭逻辑
    if (!currentValue.startsWith('/')) {
      console.log('[PromptShortcut] 用户删除了斜杠前缀，准备关闭浮层');
      onEscape?.(); // 触发关闭逻辑
      return;
    }
    
    // 移除斜杠前缀，只传递实际搜索内容
    let searchTerm = currentValue.substring(1);
    onChange(searchTerm);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault(); // 防止光标移动到末尾
        onArrowDown?.();
        break;
      case 'ArrowUp':
        e.preventDefault(); // 防止光标移动到开头
        onArrowUp?.();
        break;
      case 'Enter':
        e.preventDefault(); // 防止表单提交
        onEnter?.();
        break;
      case 'Tab':
        e.preventDefault(); // 防止失去焦点
        onTab?.();
        break;
      case 'Escape':
        e.preventDefault(); // 防止其他默认行为
        onEscape?.();
        break;
      default:
        break;
    }
  };

  // 合成实际显示的值（包含斜杠前缀）
  const displayValue = `/${value}`;

  return (
    <input
      ref={inputRef}
      className="w-full bg-magic-700 text-magic-100 py-1 px-2 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-blue placeholder-magic-400"
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck="false"
    />
  );
};

export default SearchInput; 