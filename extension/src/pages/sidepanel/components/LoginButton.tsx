import React, { useState, useEffect, useRef } from 'react';
import { User, LogIn, UserCircle, Award } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useMembership } from '../../../hooks/useMembership';
import { createPortal } from 'react-dom';
import { LoadingIndicator } from '../../../components/common/LoadingIndicator';
import { safeLogger } from '@/utils/safeEnvironment';

interface LoginButtonProps {
  className?: string;
  onAuthClick?: () => void;
}

const LoginButton: React.FC<LoginButtonProps> = ({ className = '', onAuthClick }) => {
  const { user, loading: authLoading, logout } = useAuth();
  const { isProMember, loading: membershipLoading } = useMembership();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Combine loading states
  const isLoading = authLoading || membershipLoading;
  
  // 监听点击事件，点击菜单和按钮之外的区域时关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMenuOpen && 
        menuRef.current && 
        buttonRef.current && 
        !menuRef.current.contains(event.target as Node) && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    
    // 添加全局点击事件监听器
    document.addEventListener('mousedown', handleClickOutside);
    
    // 清理事件监听
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  // Toggle user menu
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      safeLogger.log('[LoginButton] Logout button clicked, calling logout()...');
      await logout();
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // 格式化长邮箱地址
  const formatEmail = (email: string | null | undefined): string => {
    if (!email) return '';
    
    // 如果邮箱长度超过20个字符，则进行截断处理
    if (email.length > 20) {
      const [username, domain] = email.split('@');
      if (username && domain) {
        // 保留用户名开头的几个字符和完整域名
        const truncatedUsername = username.length > 10 
          ? `${username.substring(0, 8)}...` 
          : username;
        return `${truncatedUsername}@${domain}`;
      }
    }
    return email;
  };
  
  // 用户菜单，使用Portal渲染到body
  const UserMenu = () => {
    if (!isMenuOpen) return null;
    
    // 使用Portal将菜单渲染到body末尾，避免被其他元素遮挡
    return createPortal(
      <div 
        className="fixed inset-0 w-full h-full z-highest"
        onClick={() => setIsMenuOpen(false)}
      >
        <div 
          ref={menuRef}
          className="absolute right-3 top-12 w-[180px] rounded-md shadow-lg bg-white dark:bg-magic-800/90 backdrop-blur-[15px] ring-1 ring-gray-200 dark:ring-magic-700 z-dropdown-menu"
          onClick={e => e.stopPropagation()}
        >
          <div className="py-1" role="menu" aria-orientation="vertical">
            <div 
              className="px-4 py-2 text-sm text-gray-500 dark:text-magic-300 border-b border-gray-200 dark:border-magic-700 border-opacity-10 truncate overflow-hidden"
              title={user?.email || ''}
            >
              {formatEmail(user?.email)}
            </div>
            <button
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-magic-200 hover:bg-gray-100 dark:hover:bg-magic-700 hover:border-l-2 hover:border-purple-500"
              role="menuitem"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };
  
  // 决定显示内容
  const renderContent = () => {
    if (isLoading) {
      return <LoadingIndicator size="md" className="text-gray-500" />;
    }

    if (user) {
      // 如果用户已登录 (不再检查 isAnonymous)
      // Logged in: show user avatar or initial
      const userInitial = user.displayName?.[0] || user.email?.[0] || '?';
      
      if (isProMember) {
        // --- PRO User Avatar ---
        return (
          <div className={`relative ${className}`}>
            <button
              ref={buttonRef}
              onClick={toggleMenu}
              className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:opacity-90 hover:shadow-[0_0_15px_rgba(99,102,241,0.6)] transition-all"
              title={`Pro User: ${user.email || user.displayName}`}
            >
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-full h-full rounded-full object-cover" 
                />
              ) : (
                <span className="text-sm font-semibold">{userInitial.toUpperCase()}</span>
              )}
              {/* Pro Badge Overlay */}
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full p-0.5 shadow-md">
                <Award size={10} className="text-white" strokeWidth={2} /> 
              </div>
            </button>
            <UserMenu />
          </div>
        );
      } else {
        // --- FREE User Avatar ---
        return (
          <div className={`relative ${className}`}>
            <button
              ref={buttonRef}
              onClick={toggleMenu}
              className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium hover:opacity-90 hover:shadow-[0_0_10px_rgba(150,150,150,0.4)] transition-all"
              title={`User: ${user.email || user.displayName}`}
            >
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-full h-full rounded-full object-cover" 
                />
              ) : (
                <span className="text-sm">{userInitial.toUpperCase()}</span>
              )}
            </button>
            <UserMenu />
          </div>
        );
      }
    }
    
    // Not logged in or anonymous: show login button
    return (
      <div className={className}>
        <button
          onClick={onAuthClick}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-b from-gray-500 to-gray-600 text-white hover:shadow-[0_2px_8px_rgba(79,70,229,0.3)] transition-all transform hover:rotate-[5deg]"
          title="Login / Register"
        >
          <UserCircle className="w-5 h-5" />
        </button>
      </div>
    );
  };
  
  return renderContent();
};

export default LoginButton; 