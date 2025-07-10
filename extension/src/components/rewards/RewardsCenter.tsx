import React, { useState, useRef, useEffect } from 'react';
import { X, Gift, CheckCircle, Clock, Copy, ExternalLink, Youtube, HelpCircle } from 'lucide-react';
import { useRewards } from '../../hooks/useRewards';
import { useAuth } from '../../hooks/useAuth';
import { useInviteCode } from '../../hooks/useInviteCode';
import { TaskType } from '../../types/rewards';
import { LoadingIndicator } from '../common/LoadingIndicator';
import { Button } from '../common/Button';

interface RewardsCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 奖励中心抽屉组件 - 用户增长和活跃功能
 */
export function RewardsCenter({ isOpen, onClose }: RewardsCenterProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'invite' | 'help'>('tasks');
  const [copySuccess, setCopySuccess] = useState(false);
  
  const { user } = useAuth();
  const { 
    tasks, 
    loading, 
    error, 
    claimReward, 
    totalRewards, 
    claimedRewards, 
    availableRewards 
  } = useRewards();
  
  // 使用邀请码Hook
  const { 
    inviteLink, 
    loading: inviteLoading, 
    error: inviteError, 
    copyInviteLink 
  } = useInviteCode();

  // 设置挂载状态以触发动画
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
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

  // 如果没有挂载，则不显示
  if (!mounted) return null;

  // 计算进度百分比
  const getProgressPercentage = (task: any) => {
    if (task.maxProgress === 0) return 0;
    return Math.min((task.progress / task.maxProgress) * 100, 100);
  };

  // 获取任务状态图标
  const getTaskIcon = (task: any) => {
    if (task.claimed) {
      return <CheckCircle size={14} className="text-green-500" />;
    } else if (task.completed) {
      return <Gift size={14} className="text-amber-500" />;
    } else {
      return <Clock size={14} className="text-gray-400" />;
    }
  };

  // 获取任务状态按钮
  const getTaskButton = (task: any) => {
    // 邀请任务的特殊处理
    if (task.id === TaskType.INVITE_FRIEND) {
      const timesCompleted = task.progress;
      const maxTimes = task.maxProgress;
      const canClaimMore = timesCompleted < maxTimes;
      
      if (task.completed && !task.claimed && canClaimMore) {
        return (
          <Button
            variant="primary"
            className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            onClick={() => handleClaimReward(task.id)}
          >
            CLAIM NOW
          </Button>
        );
      } else if (task.claimed && canClaimMore) {
        return (
          <div className="flex flex-col items-end space-y-1">
            <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
              ✓ CLAIMED
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {timesCompleted}/{maxTimes} completed
            </span>
          </div>
        );
      } else if (!canClaimMore) {
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
            MAX REACHED
          </span>
        );
      } else {
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
            PENDING
          </span>
        );
      }
    }
    
    // 其他任务的原有逻辑
    if (task.claimed) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
          ✓ CLAIMED
        </span>
      );
    } else if (task.completed) {
      return (
        <Button
          variant="primary"
          className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          onClick={() => handleClaimReward(task.id)}
        >
          CLAIM NOW
        </Button>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
          PENDING
        </span>
      );
    }
  };

  // 处理奖励领取
  const handleClaimReward = async (taskId: TaskType) => {
    try {
      await claimReward(taskId);
    } catch (err) {
      console.error('Failed to claim reward:', err);
    }
  };

  // 处理复制邀请链接
  const handleCopyInviteLink = async () => {
    const success = await copyInviteLink();
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // 渲染奖励汇总区域
  const renderRewardsSummary = () => (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200/50 dark:border-purple-700/30 rounded-lg p-3 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
          💎 Your Rewards
        </h3>
        <div className="text-lg font-bold text-amber-500 dark:text-amber-400">
          {claimedRewards} / {totalRewards} days
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-300">
          Progress: {tasks.filter(t => t.completed).length}/{tasks.length} tasks
        </span>
        {availableRewards > 0 && (
          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
            {availableRewards} days ready!
          </span>
        )}
      </div>
    </div>
  );

  // 渲染任务卡片
  const renderTaskCard = (task: any) => (
    <div key={task.id} className="mb-3">
      <div className="bg-white dark:bg-magic-800 border border-gray-200 dark:border-magic-700/30 rounded-lg p-3 shadow-sm">
        {/* 任务标题区域 */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-magic-100">
            {task.title}
          </h4>
          {getTaskIcon(task)}
        </div>
        
        {/* 分隔线 */}
        <div className="border-b border-gray-100 dark:border-magic-700/50 mb-2"></div>
        
        {/* 信息和操作区域 */}
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-magic-300">
            {task.description}
          </p>
          
          {/* 进度条（仅对有进度的任务显示） */}
          {task.maxProgress > 1 && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-magic-400 mb-1">
                <span>Progress</span>
                <span>{task.progress}/{task.maxProgress}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-magic-700 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage(task)}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {/* 邀请任务的特殊奖励显示 */}
              {task.id === TaskType.INVITE_FRIEND ? (
                <span>💎 +{task.rewardDays} days each (max {task.maxProgress} times)</span>
              ) : (
                <span>💎 +{task.rewardDays} day{task.rewardDays > 1 ? 's' : ''}</span>
              )}
            </div>
            {getTaskButton(task)}
          </div>
        </div>
      </div>

      {/* 邀请任务特殊：添加跳转到邀请标签页的按钮 */}
      {task.id === TaskType.INVITE_FRIEND && (
        <div className="mt-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 rounded-lg p-2">
          <Button
            variant="secondary"
            onClick={() => setActiveTab('invite')}
            fullWidth
            className="text-xs py-2 bg-purple-100 dark:bg-purple-800/30 hover:bg-purple-200 dark:hover:bg-purple-700/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600"
            icon={<Copy size={12} />}
          >
            Go to Invite Friends
          </Button>
        </div>
      )}
    </div>
  );

  // 渲染任务标签页
  const renderTasksTab = () => (
    <div className="h-full">
      {renderRewardsSummary()}
      
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-magic-200 mb-3">
          📋 Complete Tasks to Earn Membership
        </h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingIndicator size="md" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm">
            Error: {error}
          </div>
        ) : (
          <div>
            {tasks.map(renderTaskCard)}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染邀请标签页
  const renderInviteTab = () => (
    <div className="text-center py-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-magic-200 mb-2">
          👥 Invite Friends
        </h3>
        <p className="text-xs text-gray-600 dark:text-magic-300 mb-4">
          Share AetherFlow with your friends and earn rewards when they sign up!
        </p>
      </div>
      
      {inviteLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingIndicator size="md" />
        </div>
      ) : inviteError ? (
        <div className="text-center py-8 text-red-500 text-sm">
          Error: {inviteError}
        </div>
      ) : (
        <div className="bg-white dark:bg-magic-800 border border-gray-200 dark:border-magic-700/30 rounded-lg p-3 mb-4">
          <div className="space-y-2">
            <div className="bg-gray-50 dark:bg-magic-700 border border-gray-200 dark:border-magic-600 rounded-md px-2 py-2 text-xs font-mono text-gray-700 dark:text-magic-200 break-all">
              {inviteLink || 'Generating invite link...'}
            </div>
            <Button
              variant={copySuccess ? "primary" : "secondary"}
              icon={<Copy size={12} />}
              onClick={handleCopyInviteLink}
              fullWidth
              className={`text-xs py-2 transition-all duration-200 ${
                copySuccess 
                  ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' 
                  : 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500 shadow-sm hover:shadow-md'
              }`}
              disabled={!inviteLink}
            >
              {copySuccess ? '✓ Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500 dark:text-magic-400">
        Your friends will get a special welcome, and you'll earn 5 days of Pro membership!
      </p>
    </div>
  );

  // 渲染帮助标签页
  const renderHelpTab = () => (
    <div className="text-center py-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-800 dark:text-magic-200 mb-2">
          🙋‍♂️ Need Help?
        </h3>
        <p className="text-xs text-gray-600 dark:text-magic-300 mb-4">
          Get help, tutorials, and support for AetherFlow.
        </p>
      </div>
      
      <div className="space-y-2">
        <Button
          variant="primary"
          icon={<Youtube size={14} />}
          onClick={() => window.open('https://youtu.be/rIrv8omQpvM?si=iHaWFw5NtfQm_-l2', '_blank')}
          fullWidth
          className="text-xs py-2"
        >
          Video Tutorials
        </Button>
        
        <Button
          variant="primary"
          icon={<ExternalLink size={14} />}
          onClick={() => window.open('https://aetherflow-app.com', '_blank')}
          fullWidth
          className="text-xs py-2"
        >
          Official Website
        </Button>
        
        <Button
          variant="primary"
          icon={<HelpCircle size={14} />}
          onClick={() => window.open('https://aetherflow-app.com/contact', '_blank')}
          fullWidth
          className="text-xs py-2"
        >
          Contact Support
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      
      {/* 抽屉主体 */}
      <div
        ref={drawerRef}
        className={`absolute right-0 top-0 h-full w-80 bg-magic-50 dark:bg-magic-900 shadow-xl transition-all duration-300 transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* 头部 */}
        <header className="bg-white dark:bg-magic-800 border-b border-magic-200 dark:border-magic-700/30 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800 dark:text-magic-200 flex items-center">
            <Gift className="mr-2 text-amber-500" size={18} />
            Rewards Center
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-magic-400 dark:hover:text-magic-200 transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* 标签页导航 */}
        <nav className="bg-white dark:bg-magic-800 border-b border-magic-200 dark:border-magic-700/30 px-4 flex-shrink-0">
          <div className="flex space-x-1">
            {[
              { id: 'tasks', label: '📋 Tasks', icon: Gift },
              { id: 'invite', label: '👥 Invite', icon: Copy },
              { id: 'help', label: '🙋‍♂️ Help', icon: HelpCircle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                    : 'text-gray-500 dark:text-magic-400 hover:text-gray-700 dark:hover:text-magic-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* 内容区域 - 修复滚动问题 */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4">
          {activeTab === 'tasks' && renderTasksTab()}
          {activeTab === 'invite' && renderInviteTab()}
          {activeTab === 'help' && renderHelpTab()}
        </main>
      </div>
    </div>
  );
} 