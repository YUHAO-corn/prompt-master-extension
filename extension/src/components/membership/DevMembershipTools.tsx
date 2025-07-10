import React, { useState, useEffect } from 'react';
import { useMembership } from '../../hooks/useMembership';

/**
 * 开发环境专用的会员状态测试工具
 * 仅在开发环境中显示，方便测试不同会员状态下的UI表现
 */
export const DevMembershipTools: React.FC = () => {
  // 默认设置为隐藏，避免初始渲染问题
  const [isVisible, setIsVisible] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const { membershipState, isProMember, _devTools, refresh } = useMembership();

  // 检查是否为开发环境，以及设置键盘快捷键
  useEffect(() => {
    // 检测条件，确保在本地开发和Chrome扩展开发环境中都能工作
    const isDevelopment = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' || 
      window.localStorage.getItem('DEV_MODE') === 'true';
    
    // 设置开发模式状态
    setIsDev(isDevelopment);
    
    // 如果在开发环境中，设置键盘事件监听器
    if (isDevelopment) {
      // 可以在开发环境中设置标记
      try {
        window.localStorage.setItem('DEV_MODE', 'true');
      } catch (e) {
        console.warn('无法设置DEV_MODE标记:', e);
      }
      
      // 定义键盘事件处理函数
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'm') {
          setIsVisible(prev => !prev);
          e.preventDefault();
        }
      };
      
      // 添加事件监听器
      window.addEventListener('keydown', handleKeyDown);
      
      // 返回清理函数
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    
    return undefined;
  }, []);

  // 显示/隐藏工具面板
  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  // 如果不是开发环境，不显示任何内容
  if (!isDev) {
    return null;
  }

  // 会员状态测试工具的主体内容
  return isVisible ? (
    <div className="fixed bottom-16 right-4 z-50 bg-magic-800 border border-magic-600 rounded-lg shadow-lg p-4 w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-magic-200">会员状态测试工具</h3>
        <button 
          onClick={toggleVisibility}
          className="text-magic-400 hover:text-magic-200"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="p-2 bg-magic-700/50 rounded">
          <p className="font-medium">当前状态: {membershipState ? (
            <span className={`font-bold ${isProMember ? 'text-yellow-400' : 'text-magic-400'}`}>
              {membershipState.status?.toUpperCase() ?? '未知'}
            </span>
          ) : (
            <span className="text-magic-500">加载中...</span>
          )}</p>
          {membershipState?.plan && (
            <p>计划: {membershipState.plan}</p>
          )}
          {membershipState?.expiresAt && (
            <p>到期时间: {new Date(membershipState.expiresAt).toLocaleDateString()}</p>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          <button 
            onClick={_devTools.setProMembership}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-2 rounded text-xs"
          >
            设为Pro会员
          </button>
          
          <button 
            onClick={_devTools.setFreeMembership}
            className="bg-magic-600 hover:bg-magic-700 text-white py-1 px-2 rounded text-xs"
          >
            设为免费会员
          </button>
          
          <button 
            onClick={_devTools.setExpiringSoon}
            className="bg-amber-600 hover:bg-amber-700 text-white py-1 px-2 rounded text-xs"
          >
            设为即将到期
          </button>
          
          <button 
            onClick={refresh}
            className="bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded text-xs"
          >
            刷新状态
          </button>
        </div>
        
        <p className="text-[10px] text-magic-400 mt-2">
          按下 <kbd className="px-1 py-0.5 bg-magic-700 rounded">Ctrl+M</kbd> 可切换显示/隐藏
        </p>
      </div>
    </div>
  ) : (
    <div 
      className="fixed bottom-4 right-4 w-10 h-10 flex items-center justify-center bg-magic-700/80 hover:bg-magic-600 rounded-full cursor-pointer z-50 shadow-lg"
      onClick={toggleVisibility}
      title="会员状态测试工具 (仅开发环境)"
    >
      <span className="text-xs font-bold text-yellow-400">PRO</span>
    </div>
  );
}; 