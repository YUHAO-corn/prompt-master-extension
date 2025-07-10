import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { cloudStorageService } from '../../../services/storage/cloudStorage';
import { SyncStatusMessage } from '../../../services/storage/cloudStorage';
import { useTheme } from '../../../hooks/useTheme';

interface SyncStatusIndicatorProps {
  className?: string;
}

/**
 * 同步状态指示器组件
 * 显示云同步状态，并提供手动触发同步的功能
 */
const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ className = '' }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatusMessage>({ 
    status: 'idle', 
    timestamp: Date.now() 
  });
  const [isHovered, setIsHovered] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 获取当前主题状态
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // 监听同步状态变化
  useEffect(() => {
    const unsubscribe = cloudStorageService.onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status.status === 'syncing') {
        setIsSyncing(true);
      } else {
        // 延迟关闭同步状态，以便显示完成动画
        setTimeout(() => {
          setIsSyncing(false);
        }, 1000);
      }
    });
    
    // 清理函数
    return unsubscribe;
  }, []);

  // 获取状态图标 - 更新以支持浅色主题
  const getStatusIcon = () => {
    switch (syncStatus.status) {
      case 'synced':
        return <Cloud size={18} className={isDarkTheme ? "text-green-400" : "text-green-500"}><Check size={12} /></Cloud>;
      case 'syncing':
        return <RefreshCw size={18} className={isDarkTheme ? "text-blue-400" : "text-blue-500 animate-spin"} />;
      case 'error':
        return <AlertTriangle size={18} className={isDarkTheme ? "text-red-400" : "text-red-500"} />;
      case 'offline':
        return <CloudOff size={18} className={isDarkTheme ? "text-gray-400" : "text-gray-500"} />;
      case 'idle':
      default:
        return <Cloud size={18} className={isDarkTheme ? "text-gray-400" : "text-gray-500"} />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    if (syncStatus.message) {
      return syncStatus.message;
    }
    
    switch (syncStatus.status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Failed';
      case 'offline':
        return 'Offline';
      case 'idle':
      default:
        return 'Not Synced';
    }
  };

  // 手动触发同步
  const handleSync = async () => {
    if (syncStatus.status === 'syncing' || isSyncing) {
      return;
    }
    
    try {
      setIsSyncing(true);
      await cloudStorageService.syncAllPrompts();
    } catch (error) {
      console.error('手动同步失败:', error);
    }
  };

  // 计算样式类 - 更新以支持浅色主题
  const getContainerClass = () => {
    let baseClass = 'flex items-center rounded-full px-2 py-1 transition-all duration-300 cursor-pointer ';
    
    if (isHovered) {
      // 悬停时根据主题使用不同的背景色
      baseClass += isDarkTheme ? 'bg-magic-700 ' : 'bg-magic-200 ';
    }
    
    if (isSyncing) {
      baseClass += 'opacity-100 ';
    } else {
      baseClass += 'opacity-80 hover:opacity-100 ';
    }
    
    return baseClass + className;
  };

  // 当主题变化时重新渲染
  useEffect(() => {
    // 仅需监听主题变化，不需要实际执行任何操作
  }, [theme]);

  return (
    <div
      className={getContainerClass()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSync}
      title="click to sync"
    >
      <div className="mr-1.5">
        {getStatusIcon()}
      </div>
      
      <div className={`overflow-hidden transition-all duration-300 ${isHovered ? 'max-w-xs' : 'max-w-0'}`}>
        <span className={`text-xs whitespace-nowrap ${isDarkTheme ? 'text-magic-200' : 'text-magic-700'}`}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
};

export default SyncStatusIndicator; 