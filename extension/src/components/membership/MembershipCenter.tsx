import React, { useState, useRef, useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { MembershipState } from '../../services/membership/types';
import { useMembership } from '../../hooks/useMembership';
import { useAuth } from '../../hooks/useAuth';
import { useQuota } from '../../hooks/useQuota';
import { LoadingIndicator } from '../common/LoadingIndicator';
import { ErrorMessage } from '../common/ErrorMessage';
import { Button } from '../common/Button';

interface MembershipCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 会员中心抽屉组件 - 仅Pro会员可见
 * B7任务实现 - 会员中心基础版(MVP)
 */
export function MembershipCenter({ isOpen, onClose }: MembershipCenterProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { membershipState, loading: membershipLoading, error: membershipError } = useMembership();
  const { user, loading: authLoading, error: authError } = useAuth();
  const { quotaInfo, loading: quotaLoading, error: quotaError } = useQuota();

  // 配置Paddle客户门户URL
  // 实际环境中应从配置服务或API获取此URL
  const PADDLE_PORTAL_URL = 'https://checkout.paddle.com/subscription/manage';

  // 设置挂载状态以触发动画
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      // 延迟卸载以允许过渡动画完成
      const timer = setTimeout(() => {
        setMounted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 处理点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node) && isOpen) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 添加ESC键关闭功能
  useEffect(() => {
    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // 格式化日期
  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // 如果没有挂载，则不显示
  if (!mounted) return null;

  const isOverallLoading = membershipLoading || authLoading || quotaLoading;
  const overallError = membershipError || authError || quotaError;

  // 加载状态处理
  const renderContent = () => {
    return (
      <div className="space-y-6">
        {/* 会员状态概览区域 */}
        <div className="bg-white dark:bg-magic-800 border border-gray-200 dark:border-magic-700/30 rounded-lg p-4 shadow-sm">
          <div className="text-lg font-semibold text-amber-500 dark:text-amber-400 mb-2 flex items-center">
            Pro Member
          </div>
          <div className="text-sm text-gray-500 dark:text-magic-400 mb-4">
            Account: {user?.email || 'Not available'}
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            <span className="text-gray-500 dark:text-magic-400">Current Plan:</span>
            <span className="text-gray-700 dark:text-magic-200 font-medium">
              {membershipState?.plan === 'monthly' ? 'Monthly' : 
               membershipState?.plan === 'annual' ? 'Annual' : 'Unknown'}
            </span>

            <span className="text-gray-500 dark:text-magic-400">Renews on:</span>
            <span className="text-gray-700 dark:text-magic-200 font-medium">
              {membershipState?.expiresAt ? formatDate(membershipState.expiresAt) : 'Unknown'}
            </span>

            <span className="text-gray-500 dark:text-magic-400">Member since:</span>
            <span className="text-gray-700 dark:text-magic-200 font-medium">
              {membershipState?.startedAt ? formatDate(membershipState.startedAt) : 'Unknown'}
            </span>
          </div>
        </div>

        {/* 会员特权展示区域 */}
        <div className="p-4">
          <h3 className="text-base font-semibold text-gray-800 dark:text-magic-200 mb-3">Pro Benefits</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-700 dark:text-magic-200">100 prompt storage</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-700 dark:text-magic-200">50 daily optimizations</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-700 dark:text-magic-200">Prompt export feature</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-700 dark:text-magic-200">Priority support</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="text-green-500">✓</span>
              <span className="text-gray-700 dark:text-magic-200">Early access to new features</span>
            </li>
          </ul>
        </div>

        {/* 配额用量展示区域 (使用 useQuota 更新限制) */}
        <div className="bg-white dark:bg-magic-800 border border-gray-200 dark:border-magic-700/30 rounded-lg p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 dark:text-magic-200 mb-3">My Usage</h3>
          {quotaLoading ? (
            <div className="space-y-5">
              <div className="flex items-center justify-center h-10 text-sm text-gray-500 dark:text-magic-400"> <LoadingIndicator size="sm" /> Loading usage...</div>
              <div className="flex items-center justify-center h-10 text-sm text-gray-500 dark:text-magic-400"> <LoadingIndicator size="sm" /> Loading usage...</div>
            </div>
          ) : quotaError ? (
            <ErrorMessage 
              message={`Failed to load usage: ${quotaError instanceof Error ? quotaError.message : String(quotaError)}`}
            />
          ) : quotaInfo ? (
            <div className="space-y-5">
              {/* 存储用量 UI 元素 */}
              <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
                <div className="w-12 h-12 rounded-full border-4 border-gray-300 dark:border-magic-600 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border-4 border-purple-500 dark:border-primary-500 border-l-transparent rotate-45"></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-magic-200">Stored Prompts</div>
                  <div className="text-xs text-gray-500 dark:text-magic-400">
                    {quotaInfo.usage?.storedPromptsCount ?? '--'} / {quotaInfo.limits.maxPrompts === Infinity ? 'Unlimited' : quotaInfo.limits.maxPrompts}
                  </div>
                </div>
              </div>

              {/* 优化用量 UI 元素 */}
              <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
                <div className="w-12 h-12 rounded-full border-4 border-gray-300 dark:border-magic-600 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border-4 border-purple-500 dark:border-primary-500 border-l-transparent rotate-45"></div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-magic-200">Optimizations Today</div>
                  <div className="text-xs text-gray-500 dark:text-magic-400">
                    {quotaInfo.usage?.dailyOptimizationCount ?? '--'} / {quotaInfo.limits.dailyOptimizations === Infinity ? 'Unlimited' : quotaInfo.limits.dailyOptimizations}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ErrorMessage message="Could not retrieve usage information." />
          )}
        </div>

        {/* 订阅管理入口 */}
        <div className="flex justify-center py-2">
          <Button
            onClick={() => window.open(PADDLE_PORTAL_URL, '_blank')}
            icon={<ExternalLink size={16} />}
            className="w-4/5"
          >
            Manage Subscription
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className={`fixed inset-0 bg-black/50 z-drawer-backdrop transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* 会员中心抽屉 - 使用 w-[320px] 宽度 */}
      <div 
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 w-[320px] bg-gradient-to-br from-gray-50 to-white dark:from-magic-800 dark:to-magic-900 border-l border-gray-200 dark:border-magic-700/30 shadow-xl z-drawer-container transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 抽屉头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-magic-700/30">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-magic-200">Membership Center</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-magic-700/50 rounded-full transition-colors"
            aria-label="Close Membership Center"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-magic-400" />
          </button>
        </div>
        
        {/* 抽屉内容 - 可滚动 */}
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-64px)]">
          {isOverallLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingIndicator size="lg" />
            </div>
          ) : overallError ? (
            <ErrorMessage 
              message={overallError instanceof Error ? overallError.message : String(overallError)} 
              className="mt-4"
            />
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </>
  );
} 