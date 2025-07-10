import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Sparkles, Lightbulb, Scissors } from 'lucide-react';
import type { OptimizationMode } from '../../../services/optimization';

interface OptimizationModeOption {
  id: OptimizationMode;
  name: string;
  icon: React.ReactNode;
  description: string;
}

interface OptimizationModeSelectorProps {
  selectedMode: OptimizationMode;
  onSelectMode: (mode: OptimizationMode) => void;
  buttonClassName?: string;
  iconOnly?: boolean;
}

export function OptimizationModeSelector({
  selectedMode,
  onSelectMode,
  buttonClassName = '',
  iconOnly = true
}: OptimizationModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 优化模式选项
  const modeOptions: OptimizationModeOption[] = [
    {
      id: 'standard',
      name: 'Standard Mode',
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      description: 'Balanced optimization'
    },
    {
      id: 'creative',
      name: 'Creative Mode',
      icon: <Lightbulb className="w-4 h-4 text-blue-400" />,
      description: 'Enhanced creativity'
    },
    {
      id: 'concise',
      name: 'Concise Mode',
      icon: <Scissors className="w-4 h-4 text-green-400" />,
      description: 'Eliminate redundancy'
    }
  ];
  
  // 获取当前选中的模式
  const currentMode = modeOptions.find(mode => mode.id === selectedMode) || modeOptions[0];
  
  // 切换下拉菜单
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };
  
  // 选择模式
  const handleSelectMode = (mode: OptimizationMode, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectMode(mode);
    setIsOpen(false);
  };
  
  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        (buttonRef.current && !buttonRef.current.contains(event.target as Node)) &&
        (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
      ) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 下拉菜单位置
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0
  });
  
  // 更新下拉菜单位置
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 160; // 估算的下拉菜单高度 (3个选项 + padding)
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      
      // 检查底部是否有足够空间
      if (spaceBelow < dropdownHeight + 10) { // 底部空间不足，向上展开
        // 向上定位
        setDropdownPosition({
          top: rect.top - dropdownHeight - 5, // 在按钮上方显示
          right: window.innerWidth - rect.right
        });
      } else { // 底部空间充足，向下展开
        // 向下定位
        setDropdownPosition({
          top: rect.bottom + 5,
          right: window.innerWidth - rect.right
        });
      }
    }
  }, [isOpen]);
  
  // 渲染下拉菜单
  const renderDropdown = () => {
    if (!isOpen) return null;
    
    const menu = (
      <div 
        ref={dropdownRef}
        className="fixed w-52 bg-white dark:bg-magic-800 rounded-lg shadow-lg border border-gray-200 dark:border-magic-600/30 p-1"
        style={{
          zIndex: 'var(--z-dropdown-selector)',
          top: dropdownPosition.top,
          right: dropdownPosition.right,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          animation: 'fadeIn 150ms ease-out'
        }}
      >
        {modeOptions.map(mode => (
          <div
            key={mode.id}
            onClick={(e) => handleSelectMode(mode.id, e)}
            className={`
              flex items-start px-3 py-2 rounded-md cursor-pointer transition-colors
              ${selectedMode === mode.id 
                ? 'bg-purple-100 dark:bg-magic-600/15 border-l-2 border-purple-500 dark:border-magic-500' 
                : 'hover:bg-gray-100 dark:hover:bg-magic-700/50'
              }
            `}
          >
            <div className="flex-shrink-0 pt-0.5">{mode.icon}</div>
            <div className="ml-2">
              <div className="text-sm font-medium text-gray-800 dark:text-magic-200">{mode.name}</div>
              <div className="text-xs text-gray-600 dark:text-magic-400">{mode.description}</div>
            </div>
          </div>
        ))}
      </div>
    );
    
    return ReactDOM.createPortal(
      menu,
      document.body
    );
  };
  
  return (
    <div className="relative inline-block">
      {/* 模式选择按钮 */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`inline-flex items-center justify-center space-x-1 px-2 py-2 rounded text-sm text-gray-700 dark:text-magic-200 hover:bg-gray-100 dark:hover:bg-magic-600/30 transition-colors ${buttonClassName}`}
        title={currentMode.name}
      >
        {currentMode.icon}
        {!iconOnly && <span className="ml-1">{currentMode.name}</span>}
        <ChevronDown className="w-3 h-3 text-gray-500 dark:text-magic-400 ml-1" />
      </button>
      
      {/* 使用Portal渲染下拉菜单 */}
      {renderDropdown()}
    </div>
  );
} 