import { useEffect, useState, useCallback } from 'react';
import { cloudStorageService } from '../services/storage/cloudStorage';
import { SyncStatusMessage, SyncStats } from '../services/storage/cloudStorage';

/**
 * 用于管理云同步状态的钩子函数
 * 提供同步状态、上次同步时间等信息，以及手动触发同步的方法
 */
export function useCloudSync() {
  // 状态
  const [syncStatus, setSyncStatus] = useState<SyncStatusMessage>(cloudStorageService.getSyncStatus());
  const [isSyncing, setIsSyncing] = useState<boolean>(syncStatus.status === 'syncing');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(cloudStorageService.isAuthenticated());
  const [pendingOperationsCount, setPendingOperationsCount] = useState<number>(0);

  // 同步状态变化监听
  useEffect(() => {
    // 订阅同步状态变化
    const unsubscribe = cloudStorageService.onSyncStatusChange((status) => {
      setSyncStatus(status);
      setIsSyncing(status.status === 'syncing');
      
      // 如果同步成功，更新上次同步时间
      if (status.status === 'synced') {
        setLastSyncTime(status.timestamp);
        setSyncError(null);
      } else if (status.status === 'error') {
        setSyncError(status.message || '同步失败');
      }
    });
    
    return unsubscribe;
  }, []);

  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 身份验证状态监听 - 使用cloudStorageService.isAuthenticated()方法
  useEffect(() => {
    // 初始化时检查一次认证状态
    setIsAuthenticated(cloudStorageService.isAuthenticated());
    
    // 通过同步状态变化间接监听认证状态变化
    // 当用户登录或登出时，syncStatus会更新
    const unsubscribe = cloudStorageService.onSyncStatusChange((status) => {
      // 根据同步状态和消息判断用户认证状态
      if (status.message === 'logged out') {
        setIsAuthenticated(false);
      } else if (status.status !== 'offline' && status.status !== 'error') {
        // 非离线和错误状态可能表示用户已认证
        setIsAuthenticated(cloudStorageService.isAuthenticated());
      }
    });
    
    return unsubscribe;
  }, []);

  // 监听待处理操作
  useEffect(() => {
    const updatePendingOperationsCount = () => {
      // 使用公开的pendingOperations getter方法获取待处理操作列表
      const operations = cloudStorageService.pendingOperations;
      setPendingOperationsCount(operations.length);
    };
    
    // 初始化时获取一次
    updatePendingOperationsCount();
    
    // 通过同步状态变化间接监听待处理操作变化
    const unsubscribe = cloudStorageService.onSyncStatusChange(() => {
      updatePendingOperationsCount();
    });
    
    return unsubscribe;
  }, []);

  // 手动触发同步
  const syncAll = useCallback(async (): Promise<SyncStats> => {
    if (!isOnline) {
      setSyncError('当前处于离线状态，无法同步');
      throw new Error('当前处于离线状态，无法同步');
    }
    
    if (!isAuthenticated) {
      setSyncError('未登录，无法同步');
      throw new Error('未登录，无法同步');
    }
    
    setSyncError(null);
    
    try {
      return await cloudStorageService.syncAllPrompts();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '同步失败');
      throw error;
    }
  }, [isOnline, isAuthenticated]);

  return {
    syncStatus,
    isSyncing,
    lastSyncTime,
    syncError,
    isOnline,
    isAuthenticated,
    pendingOperationsCount,
    syncAll
  };
} 