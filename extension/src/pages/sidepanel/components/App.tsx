import React, { useState, useRef, useEffect } from 'react';
import { Settings, Mail, HelpCircle, Heart, Gift } from 'lucide-react';
import { OptimizeSection } from './OptimizeSection';
import { LibraryTab } from './LibraryTab';
import { Navigation } from './Navigation';
import { SettingsDrawer } from './SettingsDrawer';
import LoginButton from './LoginButton';
import AuthDrawer from './AuthModal';
import { SyncStatusIndicator, Tooltip } from '../../../components/common';
import { UpgradeButton, ProBadge, PlanCardConnector, MembershipCenter } from '../../../components/membership';
import { RewardsCenter } from '../../../components/rewards';
import { usePromptsData } from '../../../hooks/usePromptsData';
import { useOptimize } from '../../../hooks/useOptimize';
import { useMembership } from '../../../hooks/useMembership';
import { useAuth } from '../../../hooks/useAuth';
import type { OptimizationVersion } from '../../../services/optimization';
import { DevMembershipSwitcher } from '../../../components/dev/DevMembershipSwitcher';
import { useAppContext } from '../../../hooks/AppContext';
import { FeatureType, featureUsageService } from '@/services/featureUsage';

// 默认导出App组件以便sidepanel/index.tsx可以正确导入
const App: React.FC = () => {
  // Get state and actions from AppContext
  const { 
    state: appState, // Use appState to avoid naming conflicts
    setActiveTab, 
    openAuthDrawer, // Use from context
    closeAuthDrawer // Use from context
  } = useAppContext();
  const { activeTab, isAuthOpen } = appState; // Destructure needed state
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMembershipCenterOpen, setIsMembershipCenterOpen] = useState(false);
  const [isRewardsCenterOpen, setIsRewardsCenterOpen] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const logoTimeoutRef = useRef<number | null>(null);

  // 获取提示词库数据
  const { addPrompt, refresh } = usePromptsData();
  
  // 获取优化功能
  const { 
    optimizeInput, 
    setOptimizeInput,
    isOptimizing,
    optimizationVersions,
    optimizationMode,
    setOptimizationMode,
    apiError,
    startOptimize,
    continueOptimization,
    generateTitle,
    updateVersion
  } = useOptimize();

  // 获取会员状态和认证状态
  const { isProMember } = useMembership();
  const { isAuthenticated } = useAuth();

  // 处理ProBadge点击事件
  const handleProBadgeClick = () => {
    // 仅当用户是Pro会员时才打开会员中心
    if (isProMember) {
      setIsMembershipCenterOpen(true);
    } else {
      // 非会员点击时，可以使用开发工具
      console.log('点击了PRO标识，请使用右下角的会员状态测试工具切换会员状态');
    }
  };

  // 处理礼物按钮点击事件
  const handleRewardsClick = () => {
    if (!isAuthenticated) {
      // 未认证用户，显示认证引导
      openAuthDrawer();
    } else {
      // 已认证用户，打开奖励中心
      setIsRewardsCenterOpen(true);
    }
  };

  // 监听提示词更新消息
  useEffect(() => {
    console.log('[SidePanel] 设置提示词更新消息监听器');
    
    const handlePromptUpdated = (message: any) => {
      if (message.type === 'PROMPT_UPDATED') {
        console.log('[SidePanel] 收到提示词更新消息:', message);
        
        // 延迟刷新，确保存储已完成更新
        setTimeout(() => {
          console.log('[SidePanel] 开始刷新提示词数据');
          refresh();
        }, 300);
      }
    };
    
    // 添加消息监听器
    chrome.runtime.onMessage.addListener(handlePromptUpdated);
    
    // 添加额外的刷新逻辑，确保初始加载时能正确获取数据
    setTimeout(() => {
      console.log('[SidePanel] 初始化时额外刷新提示词数据');
      refresh();
    }, 500);
    
    // 清理函数
    return () => {
      console.log('[SidePanel] 移除提示词更新消息监听器');
      chrome.runtime.onMessage.removeListener(handlePromptUpdated);
    };
  }, [refresh]);

  // 处理UpgradeButton点击事件
  const handleUpgradeButtonClick = () => {
    // 如果已是Pro会员，打开会员中心
    if (isProMember) {
      setIsMembershipCenterOpen(true);
    }
    // 如果不是Pro会员，PlanCardConnector会处理点击事件
  };

  const handleLogoHover = () => {
    if (!isLogoHovered) {
      setIsLogoHovered(true);
      // 清除之前的timeout（如果有）
      if (logoTimeoutRef.current) {
        window.clearTimeout(logoTimeoutRef.current);
      }
      // 设置新的timeout，动画结束后重置状态
      logoTimeoutRef.current = window.setTimeout(() => {
        setIsLogoHovered(false);
      }, 800); // 与动画时长一致
    }
  };

  // 开始优化提示词
  const handleStartOptimize = async () => {
    if (!optimizeInput.trim()) return;
    await startOptimize(optimizeInput, optimizationMode);
  };

  // 继续优化提示词
  const handleContinueOptimize = async (version: OptimizationVersion) => {
    await continueOptimization(version, optimizationMode);
  };

  // 复制提示词
  const handleCopy = (content: string) => {
    featureUsageService.trackFeature(
      FeatureType.PROMPT_COPY,
      async () => {
        await navigator.clipboard.writeText(content);
        return { success: true };
      },
      {
        metadata: {
          copySource: 'optimization_result',
          promptLength: content.length,
          hasNewlines: content.includes('\n')
        }
      }
    ).catch(err => {
      console.error('复制失败:', err);
    });
    // 这里可以添加复制成功的提示
  };
  
  // 保存到收藏夹
  const handleSaveToLibrary = async (content: string) => {
    const result = await featureUsageService.trackFeature(
      FeatureType.PROMPT_SAVE_FROM_OPTIMIZE,
      async () => {
        // 使用智能标题生成
        const title = await generateTitle(content);
        
        // 实际调用添加提示词到收藏夹的API
        await addPrompt({
          title,
          content,
          isFavorite: true,
          favorite: true
        });
        
        return { success: true };
      },
      {
        metadata: {
          contentLength: content.length,
          hasNewlines: content.includes('\n'),
          source: 'optimization'
        }
      }
    );
    
    if (!result.success) {
      console.error("Failed to save to library:", result.error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-magic-50 text-magic-700 dark:bg-magic-900 dark:text-magic-200">
      <header className="py-1.5 px-2 border-b border-magic-200 dark:border-magic-700/30 bg-white dark:bg-magic-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div 
              className="cursor-pointer" 
              onMouseEnter={handleLogoHover}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 375 375" 
                className={`w-4 h-4 mr-1.5 ${isLogoHovered ? 'logo-hover text-indigo-400' : 'text-purple-500 dark:text-purple-400'}`}
              >
                <g fill="currentColor">
                  <path d="M 182.5625 -350.109375 C 202.226562 -350.109375 220.644531 -346.441406 237.8125 -339.109375 C 254.988281 -331.773438 270.160156 -321.601562 283.328125 -308.59375 C 296.503906 -295.59375 306.84375 -280.503906 314.34375 -263.328125 C 321.851562 -246.160156 325.609375 -227.738281 325.609375 -208.0625 C 325.609375 -188.726562 321.9375 -170.472656 314.59375 -153.296875 C 307.257812 -136.128906 297.085938 -121.039062 284.078125 -108.03125 C 271.078125 -95.03125 256.070312 -84.859375 239.0625 -77.515625 C 222.0625 -70.179688 203.726562 -66.515625 184.0625 -66.515625 L 184.0625 0 L 15 0 L 15 -350.109375 Z" transform="translate(27.953696, 359.759055)"/>
                </g>
                <path fill="white" d="M 593.433594 -31.90625 C 582.988281 -25.886719 558.664062 -50.234375 558.664062 -50.234375 C 558.664062 -50.234375 549.914062 -83.503906 560.378906 -89.511719 L 612.476562 -119.445312 C 590.066406 -134.105469 560.46875 -135.972656 535.691406 -121.742188 C 511.554688 -107.867188 498.277344 -82.367188 498.835938 -56.367188 C 414.484375 3.226562 324.761719 54.777344 230.792969 97.605469 C 208.636719 83.988281 179.902344 82.613281 155.757812 96.480469 C 130.960938 110.730469 117.6875 137.246094 119.046875 163.976562 L 171.136719 134.042969 C 181.601562 128.046875 205.917969 152.394531 205.917969 152.394531 C 205.917969 152.394531 214.667969 185.671875 204.214844 191.671875 L 152.121094 221.585938 C 174.507812 236.25 204.097656 238.148438 228.894531 223.898438 C 252.492188 210.359375 265.644531 185.691406 265.703125 160.316406 C 350.527344 100.316406 440.808594 48.488281 535.367188 5.429688 C 557.324219 18.15625 585.230469 19.21875 608.824219 5.6875 C 633.605469 -8.550781 646.902344 -35.078125 645.535156 -61.820312 Z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">AetherFlow</h1>
          </div>
          
          <div className="flex items-center">
            {/* PRO标识，显示在用户头像左侧 */}
            <div className="mr-2">
              {isProMember ? (
                // 会员状态 - 显示tooltip并可点击打开会员中心
                <Tooltip content="Membership Center" position="bottom" size="md">
                  <ProBadge 
                    isActive={isProMember}
                    onClick={handleProBadgeClick}
                    size="sm"
                  />
                </Tooltip>
              ) : (
                // 非会员状态 - 使用PlanCardConnector显示升级卡片
                <PlanCardConnector triggerType="hover" source="badge">
                  <ProBadge 
                    isActive={isProMember}
                    onClick={handleProBadgeClick}
                    size="sm"
                  />
                </PlanCardConnector>
              )}
            </div>
            {/* Use openAuthDrawer from context */}
            <LoginButton onAuthClick={() => openAuthDrawer()} />
          </div>
        </div>
      </header>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 overflow-auto">
        {activeTab === 'library' ? (
          <LibraryTab /> 
        ) : (
          <OptimizeSection 
            input={optimizeInput}
            onInputChange={setOptimizeInput}
            isOptimizing={isOptimizing}
            onStartOptimize={handleStartOptimize}
            onContinueOptimize={handleContinueOptimize}
            optimizationVersions={optimizationVersions}
            onUpdateVersion={updateVersion}
            onCopy={handleCopy}
            onSaveToLibrary={handleSaveToLibrary}
            optimizationMode={optimizationMode}
            onOptimizationModeChange={setOptimizationMode}
            apiError={apiError}
          />
        )}
      </main>

      <footer className="py-1.5 px-2 border-t border-magic-200 dark:border-magic-700/30 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center space-x-1.5">
          {/* 云同步指示器，保持简洁 */}
          <SyncStatusIndicator />
          {/* 升级按钮，使用更简洁的样式 */}
          {isProMember ? (
            // 会员状态 - 显示tooltip并可点击打开会员中心
            <Tooltip content="Membership Center" position="top" size="md">
              <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-800/30 dark:hover:to-blue-800/30 border border-purple-200/50 dark:border-purple-700/30 rounded px-1.5 py-0.5 transition-all cursor-pointer"
                   onClick={handleUpgradeButtonClick}>
                <UpgradeButton 
                  isProMember={isProMember} 
                  onClick={handleUpgradeButtonClick}
                  variant="icon"
                  className="!p-0"
                />
              </div>
            </Tooltip>
          ) : (
            // 非会员状态 - 使用PlanCardConnector显示升级卡片
            <PlanCardConnector triggerType="hover" source="upgrade_button">
              <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-800/30 dark:hover:to-blue-800/30 border border-purple-200/50 dark:border-purple-700/30 rounded px-1.5 py-0.5 transition-all">
                <UpgradeButton 
                  isProMember={isProMember} 
                  onClick={isProMember ? handleUpgradeButtonClick : undefined}
                  variant="icon"
                  className="!p-0"
                />
                {!isProMember && (
                  <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    Upgrade 30% OFF
                  </span>
                )}
              </div>
            </PlanCardConnector>
          )}
        </div>
        
        <div className="flex items-center space-x-0.5">
          {/* Rewards Button - With improved tooltip */}
          <Tooltip content="Rewards Center" position="top" size="sm">
            <button 
              onClick={handleRewardsClick}
              className="flex items-center justify-center w-7 h-7 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-magic-100 dark:hover:bg-magic-700/30 rounded-md transition-all"
            >
              <Gift size={14} />
            </button>
          </Tooltip>

          {/* Give us a 5-star Button - With improved tooltip */}
          <Tooltip content="Give us a 5-star" position="top" size="sm">
            <button
              onClick={() => {
                if (chrome && chrome.runtime && chrome.runtime.id) {
                  const extensionId = chrome.runtime.id;
                  const reviewUrl = `https://chrome.google.com/webstore/detail/${extensionId}/reviews`;
                  window.open(reviewUrl, '_blank', 'noopener,noreferrer');
                } else {
                  console.warn('无法获取扩展ID，无法打开评论页面。请确保在Chrome扩展环境中运行，或检查API可用性。');
                  // 可选：提供一个备用链接
                  // window.open('https://aetherflow-app.com/support', '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex items-center justify-center w-7 h-7 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-magic-100 dark:hover:bg-magic-700/30 rounded-md transition-all"
            >
              <Heart size={14} />
            </button>
          </Tooltip>

          {/* Help Center Button - With improved tooltip */}
          <Tooltip content="Need Help" position="top" size="sm">
            <button 
              onClick={() => {
                window.open('https://aetherflow-app.com/', '_blank');
              }}
              className="flex items-center justify-center w-7 h-7 text-magic-600 hover:text-magic-700 dark:text-magic-300 dark:hover:text-magic-200 hover:bg-magic-100 dark:hover:bg-magic-700/30 rounded-md transition-all"
            >
              <HelpCircle size={14} />
            </button>
          </Tooltip>

          {/* Feedback Button - With improved tooltip */}
          <Tooltip content="Feedback" position="top" size="sm">
            <button 
              onClick={() => {
                window.open('https://aetherflow-app.com/contact', '_blank');
              }}
              className="flex items-center justify-center w-7 h-7 text-magic-600 hover:text-magic-700 dark:text-magic-300 dark:hover:text-magic-200 hover:bg-magic-100 dark:hover:bg-magic-700/30 rounded-md transition-all"
            >
              <Mail size={14} />
            </button>
          </Tooltip>

          {/* Settings Button - With improved tooltip */}
          <Tooltip content="Settings" position="top" size="sm">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center justify-center w-7 h-7 text-magic-600 hover:text-magic-700 dark:text-magic-300 dark:hover:text-magic-200 hover:bg-magic-100 dark:hover:bg-magic-700/30 rounded-md transition-all"
            >
              <Settings size={14} />
            </button>
          </Tooltip>
        </div>
      </footer>

      {/* App-level drawers */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      
      {/* Use isAuthOpen and closeAuthDrawer from context */}
      <AuthDrawer
        isOpen={isAuthOpen}
        onClose={closeAuthDrawer} 
      />

      {/* 会员中心抽屉 - 仅Pro会员可见 */}
      {isProMember && (
        <MembershipCenter
          isOpen={isMembershipCenterOpen}
          onClose={() => setIsMembershipCenterOpen(false)}
        />
      )}

      {/* 奖励中心抽屉 - 所有用户可见 */}
      <RewardsCenter
        isOpen={isRewardsCenterOpen}
        onClose={() => setIsRewardsCenterOpen(false)}
      />

      {/* 开发环境专用的会员状态测试工具 */}
      {process.env.NODE_ENV === 'development' && <DevMembershipSwitcher />}
    </div>
  );
};

export default App; 