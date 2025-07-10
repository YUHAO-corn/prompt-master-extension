import React, { useEffect, useState } from 'react';
import SearchInput from './SearchInput';
import SuggestionList from './SuggestionList';
import { usePromptShortcut } from '@/hooks/usePromptShortcut';

// 导入统一设计风格样式
import '@/styles/promptShortcutUI.css';

interface PromptShortcutOverlayProps {
  onSelectPrompt?: (promptContent: string) => void;
  onClose?: () => void;
}

const PromptShortcutOverlay: React.FC<PromptShortcutOverlayProps> = ({ onSelectPrompt, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  
  // 打开侧边栏并提示登录
  const handleOpenSidebar = () => {
    console.log('[PromptShortcut] 请求打开侧边栏并提示登录');
    chrome.runtime.sendMessage({ 
      type: 'OPEN_SIDEBAR', 
      payload: { promptLogin: true }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[PromptShortcut] 打开侧边栏错误:', chrome.runtime.lastError);
      } else {
        console.log('[PromptShortcut] 侧边栏打开响应:', response);
        // 可选：关闭PromptShortcut浮层
        onClose?.();
      }
    });
  };
  
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        console.log('[PromptShortcut] 请求检查用户认证状态');
        setIsCheckingAuth(true);
        
        // 使用与floatingToolbar相同的CHECK_AUTH_STATE消息类型
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATE' });
        
        console.log('[PromptShortcut] 认证状态检查响应:', response);
        
        if (response && response.success && response.user) {
          console.log('[PromptShortcut] 用户已认证, userId:', response.user.uid);
          setIsAuthenticated(true);
        } else {
          console.log('[PromptShortcut] 用户未认证或认证失败');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('[PromptShortcut] 认证状态检查错误:', error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthState();

    // 监听认证状态变化
    const handleAuthChange = (message: any) => {
      if (message && message.type === 'CENTRAL_AUTH_STATE_UPDATED') {
        console.log('[PromptShortcut] 收到认证状态更新:', message.payload);
        setIsAuthenticated(message.payload.isAuthenticated || false);
      }
    };

    chrome.runtime.onMessage.addListener(handleAuthChange);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleAuthChange);
    };
  }, []);
  
  const {
    searchTerm,
    suggestions,
    highlightedIndex,
    handleSearchChange,
    handleArrowDown,
    handleArrowUp,
    handleEnterOrTab,
    handleEscape,
    handleSelectSuggestion,
    isLoading,
    authError
  } = usePromptShortcut({
    onSelectPrompt,
    onClose,
    isAuthenticated
  });

  const renderContent = () => {
    // 检查认证状态中 - 不显示任何提示
    if (isCheckingAuth) {
      return null;
    }
    
    // 未认证或认证错误，显示登录提示
    if (!isAuthenticated || authError) {
      return (
        <div className="py-2 text-center">
          <div className="italic mb-1 text-magic-300 text-sm">Please sign in to use prompt shortcuts</div>
          <button 
            onClick={handleOpenSidebar}
            className="bg-brand-blue text-white text-xs py-1 px-3 rounded"
          >
            Sign in
          </button>
        </div>
      );
    }

    // 如果有搜索结果，显示建议列表
    if (suggestions.length > 0) {
      return (
        <SuggestionList 
          suggestions={suggestions} 
          highlightedIndex={highlightedIndex}
          onSuggestionClick={handleSelectSuggestion}
          searchTerm={searchTerm}
        />
      );
    }

    // 无输入或无匹配结果时，不显示任何额外内容
    return null;
  };

  // 添加内联样式覆盖任何可能导致圆形裁剪的样式
  const overlayStyle = {
    borderRadius: '6px', // 确保边框圆角大小合适
    overflow: 'hidden',
    boxSizing: 'border-box' as const,
    width: '250px', // 减小宽度，与CSS保持一致
  };

  return (
    <div 
      className="bg-magic-800 p-2 text-magic-100 flex flex-col" 
      style={overlayStyle}
    >
      <div className="w-full box-border">
        <SearchInput 
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Type to search..."
          onArrowDown={handleArrowDown}
          onArrowUp={handleArrowUp}
          onEnter={handleEnterOrTab}
          onTab={handleEnterOrTab}
          onEscape={handleEscape}
        />
      </div>
      {renderContent()}
    </div>
  );
};

export default PromptShortcutOverlay; 