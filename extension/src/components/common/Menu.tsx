import React, { useEffect, useRef } from 'react';

interface MenuProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface MenuItemProps {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * 下拉菜单组件
 * 
 * 用于显示一个上下文菜单或下拉选项
 * 
 * @example
 * ```jsx
 * const [isMenuOpen, setIsMenuOpen] = useState(false);
 * 
 * // 在组件中
 * <div className="relative">
 *   <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
 *     Options
 *   </button>
 *   
 *   <Menu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
 *     <button className="menu-item">Option 1</button>
 *     <button className="menu-item">Option 2</button>
 *   </Menu>
 * </div>
 * ```
 */
export function Menu({ children, isOpen, onClose, className = '' }: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // 点击外部关闭菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    // ESC键关闭菜单
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={menuRef}
      className={`absolute top-full right-0 mt-1 w-48 z-dropdown bg-white dark:bg-magic-800 border border-gray-200 dark:border-magic-700/30 rounded-md shadow-lg overflow-hidden ${className}`}
    >
      <div className="py-1">
        {children}
      </div>
    </div>
  );
}

export function MenuItem({ children, onClick, selected = false, className = '' }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm ${
        selected 
          ? 'bg-purple-600 dark:bg-magic-600 text-white' 
          : 'text-gray-700 dark:text-magic-300 hover:bg-gray-100 dark:hover:bg-magic-700 hover:text-gray-900 dark:hover:text-white'
      } transition-colors ${className}`}
    >
      {children}
    </button>
  );
} 