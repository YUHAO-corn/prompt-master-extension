import React, { useState, useEffect } from 'react';
import { useCloudSync } from '../../../hooks';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../../../hooks/useTheme';

type TooltipProps = {
  children: React.ReactNode;
  content: string;
  isError?: boolean;
};

// 简单的悬停提示组件 - 更新以支持浅色主题
const Tooltip: React.FC<TooltipProps> = ({ children, content, isError }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div 
          className={`absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-2 rounded-lg text-sm 
                     bg-white dark:bg-slate-900 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 shadow-lg transition-opacity duration-150 
                     ${isError ? 'w-[180px]' : 'w-[140px]'}`}
        >
          {content}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-white dark:bg-slate-900 border-r border-b border-gray-200 dark:border-gray-700"></div>
        </div>
      )}
    </div>
  );
};

// 同步状态指示器组件
interface SyncStatusIndicatorProps {
  className?: string;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ className = '' }) => {
  const { 
    syncStatus, 
    lastSyncTime, 
    syncAll, 
    syncError, 
    isSyncing,
    pendingOperationsCount,
    isOnline
  } = useCloudSync();
  
  // 获取当前主题
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  // 处理点击事件
  const handleClick = async () => {
    if (syncStatus.status === 'error') {
      // 重置错误状态（通过重新同步）
    }
    
    if (syncStatus.status !== 'syncing' && isOnline) {
      try {
        await syncAll();
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  };
  
  // 计算tooltip内容
  const getTooltipContent = () => {
    switch (syncStatus.status) {
      case 'idle':
        if (lastSyncTime) {
          return `Last synced: ${formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}`;
        }
        return 'Click to sync';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return syncError ? `Sync error: ${syncError}` : 'Sync error, click to retry';
      case 'offline':
        return 'Offline mode';
      default:
        return 'Click to sync';
    }
  };
  
  // 获取同步状态图标和颜色 - 更新以支持浅色主题
  const getStatusStyles = () => {
    switch (syncStatus.status) {
      case 'idle':
        return {
          bgColor: isDarkTheme ? '#64748b' : '#94a3b8', // slate-500 in dark, slate-400 in light
          fillColor: isDarkTheme ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          borderColor: isDarkTheme ? '#64748b' : '#94a3b8',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        };
      case 'syncing':
        return {
          bgColor: isDarkTheme ? '#6366f1' : '#818cf8', // indigo-600 in dark, indigo-400 in light
          fillColor: isDarkTheme ? 'rgba(99, 102, 241, 0.1)' : 'rgba(129, 140, 248, 0.1)',
          borderColor: isDarkTheme ? '#6366f1' : '#818cf8',
          icon: (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )
        };
      case 'error':
        return {
          bgColor: isDarkTheme ? '#f43f5e' : '#fb7185', // rose-600 in dark, rose-400 in light
          fillColor: isDarkTheme ? 'rgba(244, 63, 94, 0.1)' : 'rgba(251, 113, 133, 0.1)',
          borderColor: isDarkTheme ? '#f43f5e' : '#fb7185',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        };
      case 'offline':
        return {
          bgColor: isDarkTheme ? '#6b7280' : '#9ca3af', // gray-500 in dark, gray-400 in light
          fillColor: isDarkTheme ? 'rgba(107, 114, 128, 0.1)' : 'rgba(156, 163, 175, 0.1)',
          borderColor: isDarkTheme ? '#6b7280' : '#9ca3af',
          icon: (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l22 22m-4-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10M10 10l4 4m0-4l-4 4" 
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        };
      default:
        return {
          bgColor: isDarkTheme ? '#64748b' : '#94a3b8', // 默认浅色和深色主题的颜色
          fillColor: isDarkTheme ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)',
          borderColor: isDarkTheme ? '#64748b' : '#94a3b8',
          icon: null
        };
    }
  };
  
  const { bgColor, fillColor, borderColor, icon } = getStatusStyles();
  
  // 当主题变化时重新渲染
  useEffect(() => {
    // 仅需监听主题变化，不需要实际执行任何操作
  }, [theme]);
  
  // 渲染指示器
  return (
    <Tooltip content={getTooltipContent()} isError={syncStatus.status === 'error'}>
      <button
        onClick={handleClick}
        disabled={syncStatus.status === 'syncing'}
        aria-label={`Sync status: ${syncStatus.status}`}
        className={`relative flex items-center justify-center w-7 h-7 rounded-full 
                   focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
                   focus-visible:ring-2 transition-transform duration-200 hover:scale-105
                   ${syncStatus.status === 'syncing' ? 'cursor-wait' : 'cursor-pointer'}
                   ${className}`}
        style={{ color: bgColor }}
      >
        {/* 圆环指示器 */}
        <div 
          className="absolute inset-0.5 rounded-full"
          style={{ backgroundColor: fillColor, border: `1.5px solid ${borderColor}` }}
        />
        
        {/* 状态图标 */}
        <div className="relative z-10">
          {icon}
        </div>
        
        {/* 待处理操作指示器 */}
        {pendingOperationsCount > 0 && syncStatus.status !== 'syncing' && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">{pendingOperationsCount > 9 ? '9+' : pendingOperationsCount}</span>
          </div>
        )}
      </button>
    </Tooltip>
  );
};

export default SyncStatusIndicator; 