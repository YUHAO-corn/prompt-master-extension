import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Copy, Trash2, Plus, ArrowDownUp, Star, FileText, Highlighter, Sparkles, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { Input } from '../../../components/common/Input';
import { Card } from '../../../components/common/Card';
import { LoadingIndicator } from '../../../components/common/LoadingIndicator';
import { PromptFormModal } from './PromptFormModal';
import { PromptDetailDrawer } from './PromptDetailDrawer';
import { Prompt } from '../../../services/prompt/types';
import { Menu, MenuItem } from '../../../components/common/Menu';
import { usePromptsData, SortCriteria } from '../../../hooks/usePromptsData';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { calculateByteLength, smartTruncate } from '../../../utils/stringUtils';
import { TITLE_LIMITS } from '../../../utils/constants';
import { authService } from '../../../services/auth';
import { safeLogger } from '../../../utils/safeEnvironment';
import { useAuth } from '../../../hooks/useAuth';
import { useMembership } from '../../../hooks/useMembership';
import { useQuota } from '../../../hooks/useQuota';
import { useRecommendedPrompts } from '../../../hooks/useRecommendedPrompts';
import { FeatureType, featureUsageService } from '@/services/featureUsage';
import { useAppContext } from '../../../hooks/AppContext';

type SortOption = 'createdDesc' | 'createdAsc' | 'useCount';

// 定义免费用户配额常量 (可以从 useQuota 获取，但常量更简单)
const FREE_USER_PROMPT_LIMIT = 5; 

export function LibraryTab() {
  const { 
    loading: isPromptsLoading,
    prompts,
    incrementUseCount, 
    deletePrompt, 
    toggleFavorite,
    searchPrompts,
    sortCriteria,
    setSortCriteria
  } = usePromptsData();
  
  // 加载推荐提示词
  const {
    adaptedPrompts: recommendedPrompts,
    loading: isRecommendedPromptsLoading,
    searchRecommendedPrompts
  } = useRecommendedPrompts();
  
  // 添加批量加载状态变量
  const INITIAL_LOAD_COUNT = 20;
  const LOAD_MORE_COUNT = 20;
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(INITIAL_LOAD_COUNT);
  
  const { user, loading: isAuthLoading } = useAuth();
  const { isProMember, loading: isMembershipLoading } = useMembership();
  const { quotaInfo, loading: isQuotaLoading, error: quotaError } = useQuota();
  const { openAuthDrawer } = useAppContext();
  
  // 状态管理
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(undefined);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | undefined>(undefined);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  
  // 确认对话框状态
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'unfavorite'>('delete');
  
  // --- State for Expanded Cards ---
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // --- End of State ---

  // 修改合并提示词的逻辑，只显示部分推荐提示词
  const allPrompts = useMemo(() => {
    // 限制显示的推荐提示词数量
    const visibleRecommended = recommendedPrompts.slice(0, visibleRecommendedCount);
    
    return [
      ...prompts, // 用户提示词在前
      ...visibleRecommended // 限制数量的推荐提示词在后
    ];
  }, [prompts, recommendedPrompts, visibleRecommendedCount]);

  // 修正: 添加一个 useEffect 来处理搜索过滤 (如果需要实时过滤)
  const [displayPrompts, setDisplayPrompts] = useState<Prompt[]>(allPrompts);

  useEffect(() => {
    // 当 searchTerm 变化时，同时过滤用户提示词和推荐提示词
    if (searchTerm) {
      // 异步过滤两种提示词
      Promise.all([
        searchPrompts({ searchTerm }),
        searchRecommendedPrompts(searchTerm)
      ]).then(([userFiltered, recommendedFiltered]) => {
        // 用户提示词在前，推荐提示词在后
        setDisplayPrompts([...userFiltered, ...recommendedFiltered]);
      });
    } else {
      // 没有搜索词时，显示所有已排序的提示词
      setDisplayPrompts(allPrompts);
    }
  }, [searchTerm, allPrompts, searchPrompts, searchRecommendedPrompts]);
  
  // 修正: 修改 getSortOptionName，移除 updatedAt 相关逻辑
  const getSortOptionName = (criteria: SortCriteria): string => {
    const { key, order } = criteria;
    if (key === 'createdAt' && order === 'desc') return 'Created Date (New→Old)';
    if (key === 'createdAt' && order === 'asc') return 'Created Date (Old→New)';
    if (key === 'useCount' && order === 'desc') return 'Usage Frequency';
    return 'Created Date (New→Old)'; // 默认显示创建时间
  };

  // 修正: 修改 mapUiOptionToSortCriteria，移除 updatedAt，更新默认值
  const mapUiOptionToSortCriteria = (option: SortOption): SortCriteria => {
    switch (option) {
      case 'createdDesc': return { key: 'createdAt', order: 'desc' };
      case 'createdAsc': return { key: 'createdAt', order: 'asc' };
      case 'useCount': return { key: 'useCount', order: 'desc' };
      default: return { key: 'createdAt', order: 'desc' }; // 新默认值
    }
  };
  
  // 处理复制提示词
  const handleCopy = async (promptId: string, content: string, isRecommended: boolean) => {
    try {
      await featureUsageService.trackFeature(
        FeatureType.PROMPT_COPY,
        async () => {
          await navigator.clipboard.writeText(content);
          
          // 只对用户创建的提示词增加使用次数
          if (!isRecommended) {
            await incrementUseCount(promptId);
          }
          
          return { success: true };
        },
        {
          metadata: {
            promptId,
            copySource: 'library_card',
            promptLength: content.length,
            isRecommended,
            hasNewlines: content.includes('\n')
          }
        }
      );
      
      // 可以在这里添加复制成功的提示
    } catch (error) {
      console.error('复制失败:', error);
    }
  };
  
  // 处理查看提示词详情
  const handleViewDetail = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsDetailOpen(true);
  };
  
  // 处理编辑提示词
  const handleEdit = (prompt: Prompt) => {
    // 不再打开模态框，仅在直接编辑时透过updatePromptHook更新提示词数据
    console.log('Prompt edited:', prompt.id);
  };
  
  // 处理添加新提示词
  const handleAddNew = () => {
    // 检查用户是否已认证
    if (!user) {
      openAuthDrawer('Please sign in to create and save prompts to your library.');
      return;
    }
    
    setEditingPrompt(undefined);
    setIsFormOpen(true);
  };
  
  // 处理删除提示词
  const handleDelete = async (id: string) => {
    setPromptToDelete(id);
    setConfirmAction('delete');
    setConfirmDialogOpen(true);
  };
  
  // 确认操作
  const confirmAction1 = async () => {
    if (promptToDelete) {
      if (confirmAction === 'delete') {
        await deletePrompt(promptToDelete);
      } else if (confirmAction === 'unfavorite') {
        await toggleFavorite(promptToDelete);
      }
      setPromptToDelete(null);
      setConfirmDialogOpen(false);
    }
  };
  
  // 关闭详情抽屉
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedPrompt(undefined);
  };
  
  // 关闭表单模态框
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingPrompt(undefined);
  };

  // 处理收藏切换
  const handleToggleFavorite = async (promptId: string, isFavorited: boolean) => {
    if (isFavorited) {
      // 如果已收藏，则显示确认对话框
      setPromptToDelete(promptId);
      setConfirmAction('unfavorite');
      setConfirmDialogOpen(true);
    } else {
      // 如果未收藏，直接收藏
      await toggleFavorite(promptId);
    }
  };
  
  // 格式化内容预览，保留原始格式
  const formatContentPreview = (content: string) => {
    // 仅去除多余的空行，保留正常换行
    return content.replace(/\n{3,}/g, '\n\n');
  };
  
  // 修改formatTitle函数
  const formatTitle = (title: string) => {
    if (!title) return '';
    
    // 使用统一的字节限制和截断逻辑，不添加省略号
    return smartTruncate(title, TITLE_LIMITS.DISPLAY, false);
  };

  // --- Toggle Card Expansion Function ---
  const toggleCardExpansion = (promptId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(promptId)) {
        newSet.delete(promptId);
      } else {
        newSet.add(promptId);
      }
      return newSet;
    });
  };
  // --- End of Toggle Function ---

  // --- NEW: 调整初始加载状态逻辑 --- 
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const initialLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 现在需要等待 Auth, Prompts, Membership, Quota 和 RecommendedPrompts 都加载完成
    if (isInitialLoading && !isAuthLoading && !isPromptsLoading && !isMembershipLoading && !isQuotaLoading && !isRecommendedPromptsLoading) { 
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current);
      }
      setIsInitialLoading(false);
    }
  }, [isInitialLoading, isAuthLoading, isPromptsLoading, isMembershipLoading, isQuotaLoading, isRecommendedPromptsLoading]);

  // --- Effect for the safety timeout (Fallback Path) ---
  useEffect(() => {
    safeLogger.log('[LibraryTab] Mount effect: Setting initial load timeout (10s)');
    initialLoadTimeoutRef.current = setTimeout(() => {
      // Use functional update: check current state inside timeout
      setIsInitialLoading(currentIsInitial => {
        if (currentIsInitial) {
          safeLogger.warn('[LibraryTab] Initial loading timeout (10s) reached. Forcing loading state off.');
          return false; // Force initial loading off
        }
        return currentIsInitial; // Already false, no change needed
      });
    }, 10000); // 10 seconds

    // Cleanup function: essential to clear timeout on unmount
    return () => {
      if (initialLoadTimeoutRef.current) {
        safeLogger.log('[LibraryTab] Cleanup effect: Clearing initial load timeout.');
        clearTimeout(initialLoadTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this effect runs only once on mount

  // --- Empty State Component ---
  const renderEmptyState = () => {
    if (searchTerm) {
      // Search returned no results
      return (
        <div className="text-center text-gray-500 dark:text-magic-400 py-16 flex flex-col items-center">
          <Search size={48} className="mb-4 text-gray-400 dark:text-magic-500" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-magic-300 mb-2">No Prompts Found</h3>
          <p className="text-sm mb-4">Your search for "{searchTerm}" did not match any prompts.</p>
          <button 
            onClick={() => setSearchTerm('')} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 dark:bg-magic-600 dark:hover:bg-magic-500 text-white rounded-md transition-colors text-sm"
          >
            Clear Search
          </button>
        </div>
      );
    } else {
      // Library is empty (New user guidance)
      return (
        <div className="text-center text-gray-500 dark:text-magic-400 py-12 flex flex-col items-center">
          {/* You can replace FileText with a more relevant custom illustration/icon */}
          <FileText size={56} className="mb-6 text-gray-400 dark:text-magic-500 opacity-70" /> 
          <h3 className="text-xl font-semibold text-gray-700 dark:text-magic-200 mb-3">Your Prompt Library is Empty</h3>
          <p className="text-sm mb-8 max-w-md mx-auto">Start building your collection! Here's how you can add prompts:</p>
          
          <div className="space-y-5 text-left max-w-sm w-full">
            {/* Method 1: Add New */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1 p-1.5 bg-gray-200 dark:bg-magic-700/50 rounded-full">
                 <Plus size={16} className="text-gray-600 dark:text-magic-300" />
              </div>
              <div>
                <h4 className="font-medium text-gray-700 dark:text-magic-300 text-sm">Add New Manually</h4>
                <p className="text-xs text-gray-500 dark:text-magic-400">Click the <span className="font-bold">+ Add New</span> button above to create a prompt from scratch.</p>
              </div>
            </div>

            {/* Method 2: Capture from Web (Updated) */}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1 p-1.5 bg-gray-200 dark:bg-magic-700/50 rounded-full">
                 {/* Use Highlighter icon or similar for selection step */}
                 <Highlighter size={16} className="text-gray-600 dark:text-magic-300" /> 
              </div>
              <div>
                <h4 className="font-medium text-gray-700 dark:text-magic-300 text-sm">Capture from Webpage</h4>
                <p className="text-xs text-gray-500 dark:text-magic-400">
                  Highlight text on any webpage, then click the 
                  {/* Inline Capture icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="inline-block mx-1 relative bottom-[-2px]">
                    <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                    <line x1="12" x2="12" y1="7" y2="13" stroke="var(--aetherflow-toolbar-bg, white)" strokeWidth="3"/> 
                    <line x1="9" x2="15" y1="10" y2="10" stroke="var(--aetherflow-toolbar-bg, white)" strokeWidth="3"/>
                  </svg> 
                  icon on the toolbar that appears.
                </p>
              </div>
            </div>

             {/* Optional: Add more methods if applicable */}

          </div>
        </div>
      );
    }
  };
  // --- End of Empty State Component ---

  // --- UPDATED: Loading State Check ---
  if (isInitialLoading) {
    return (
      <div className="px-4 py-16 text-center text-gray-500 dark:text-magic-400">
        Loading prompts...
      </div>
    );
  }

  return (
    <div className="px-4 pt-2 pb-4">
      {/* 搜索栏和操作按钮 */}
      <div className="mb-6 flex items-center space-x-3">
        <div className="relative flex-1">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prompts..."
              icon={<Search size={15} className="text-purple-500" />}
              className={`h-9 rounded-lg shadow-sm border-gray-200 dark:border-magic-700/50 ${searchTerm ? 'pr-8' : ''} focus:border-purple-400 focus:ring focus:ring-purple-200 dark:focus:ring-magic-800/50 hover:border-gray-300 dark:hover:border-magic-600`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-magic-400 dark:hover:text-magic-200"
                title="Clear search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </button>
            )}
          </div>
          {searchTerm && displayPrompts.length > 0 && (
            <div className="absolute -bottom-6 left-0 text-xs text-gray-500 dark:text-gray-400">
              Found {displayPrompts.length} results
            </div>
          )}
        </div>
        
        {/* 添加提示词按钮 - 轻量级无文字 */}
        <button
          onClick={handleAddNew}
          className="h-9 w-9 flex items-center justify-center bg-purple-600 hover:bg-purple-500 dark:bg-magic-700 dark:hover:bg-magic-600 rounded-lg text-white dark:text-magic-200 transition-colors shadow-sm"
          title="Add to Library"
        >
          <Plus size={16} />
        </button>
        
        {/* 排序按钮 - 轻量级无文字 */}
        <div className="relative">
          <button
            onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
            className="h-9 w-9 flex items-center justify-center bg-purple-600 hover:bg-purple-500 dark:bg-magic-700 dark:hover:bg-magic-600 rounded-lg text-white dark:text-magic-200 transition-colors shadow-sm"
            title={`Sort: ${getSortOptionName(sortCriteria)}`}
          >
            <ArrowDownUp size={16} />
          </button>
          
          {/* 排序菜单 */}
          <Menu isOpen={isSortMenuOpen} onClose={() => setIsSortMenuOpen(false)}>
            {/* 修正: 移除 Last Edited 选项 */}
            {/* <MenuItem ... onClick={() => { setSortCriteria(mapUiOptionToSortCriteria('updatedDesc')); ... }}>Last Edited (New→Old)</MenuItem> */}
            {/* <MenuItem ... onClick={() => { setSortCriteria(mapUiOptionToSortCriteria('updatedAsc')); ... }}>Last Edited (Old→New)</MenuItem> */}
            
            {/* 修正: 添加 text-xs 类缩小字体 */}
            <MenuItem 
              className="text-xs" // 添加字体大小类
              selected={sortCriteria.key === 'createdAt' && sortCriteria.order === 'desc'} 
              onClick={() => { setSortCriteria(mapUiOptionToSortCriteria('createdDesc')); setIsSortMenuOpen(false); }}
            >
              Created Date (New→Old)
            </MenuItem>
            <MenuItem 
              className="text-xs" // 添加字体大小类
              selected={sortCriteria.key === 'createdAt' && sortCriteria.order === 'asc'} 
              onClick={() => { setSortCriteria(mapUiOptionToSortCriteria('createdAsc')); setIsSortMenuOpen(false); }}
            >
              Created Date (Old→New)
            </MenuItem>
            <MenuItem 
              className="text-xs" // 添加字体大小类
              selected={sortCriteria.key === 'useCount' && sortCriteria.order === 'desc'} 
              onClick={() => { setSortCriteria(mapUiOptionToSortCriteria('useCount')); setIsSortMenuOpen(false); }}
            >
              Usage Frequency
            </MenuItem>
          </Menu>
        </div>
      </div>

      {/* 加载状态 - Show only for subsequent loads */}
      {!isInitialLoading && (isPromptsLoading || isRecommendedPromptsLoading) && (
        <div className="flex justify-center my-8">
          <LoadingIndicator />
        </div>
      )}

      {/* Prompt list or Empty State */}
      {!isInitialLoading && !isPromptsLoading && !isRecommendedPromptsLoading && (
        <div className="space-y-3">
          {displayPrompts.length === 0 && !searchTerm ? (
            renderEmptyState()
          ) : (
            <>
              {displayPrompts.map((prompt, index) => {
                const isExpanded = expandedCards.has(prompt.id);
                // Define a fallback limit in case quotaInfo is not loaded yet
                const FREE_USER_PROMPT_LIMIT_FALLBACK = 5;
                const currentLimit = quotaInfo?.limits?.maxPrompts ?? FREE_USER_PROMPT_LIMIT_FALLBACK;
                
                // 只对用户提示词应用锁定规则 (不对推荐提示词锁定)
                const isLocked = !prompt.isRecommended && !isProMember && (index >= currentLimit);
                
                // 是否为推荐提示词
                const isRecommended = !!prompt.isRecommended;

                const getPricingUrl = async (source: string): Promise<string> => {
                  // MODIFIED: Get base URL from environment variable
                  const baseUrl = process.env.PAYMENT_PAGE_BASE_URL;
                  // ADD: Log the base URL from env
                  console.log('[LibraryTab Debug] PAYMENT_PAGE_BASE_URL from env:', baseUrl);

                  // Ensure baseUrl is available
                  if (!baseUrl) {
                    console.error('PAYMENT_PAGE_BASE_URL not found in environment variables for LibraryTab!');
                    // Fallback to a default or handle the error, maybe throw or return a minimal path
                    // For now, throwing an error is safer to indicate misconfiguration.
                    // MODIFIED: Throw error if baseUrl is missing even for fallback
                    throw new Error('Missing PAYMENT_PAGE_BASE_URL environment variable in LibraryTab.');
                  }

                  // Construct the base URL for fallback/unauthenticated users
                  const basePricingUrl = `${baseUrl}/pricing.html?source=${source}`;
                  // ADD: Log the constructed basePricingUrl
                  console.log('[LibraryTab Debug] Constructed basePricingUrl (fallback):', basePricingUrl);

                  try {
                    const currentUser = await authService.getCurrentUser();
                    if (currentUser) {
                      const targetPath = '/pricing.html';
                      const params = { 
                        source: source,
                        // Removed uid and email from here as generateWebsiteAuthUrl adds idToken
                      };
                      return await authService.generateWebsiteAuthUrl(targetPath, params);
                    } else {
                      console.log('[LibraryTab Debug] User not logged in, returning basePricingUrl:', basePricingUrl);
                      return basePricingUrl;
                    }
                  } catch (error) {
                    console.error('[LibraryTab] 构建带认证的支付URL失败:', error);
                    // Use the constructed basePricingUrl in case of error
                    console.error('[LibraryTab Debug] Returning basePricingUrl in catch block:', basePricingUrl);
                    return basePricingUrl;
                  }
                };

                const handleUpgradeClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  const url = await getPricingUrl('locked_prompt_card');
                  window.open(url, '_blank');
                };

                return (
                  <Card
                    key={prompt.id}
                    title={formatTitle(prompt.title)}
                    isLocked={isLocked}
                    isRecommended={isRecommended}
                    onClick={(e) => {
                        if (isLocked) return;

                        const target = e.target as HTMLElement;
                        if (target.closest('.expand-toggle-button') || target.closest('.action-button')) {
                          return;
                        }
                        handleViewDetail(prompt);
                      }
                    }
                    className="group"
                  >
                    {isLocked && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 rounded-md p-4 text-center">
                        <Lock size={24} className="text-white mb-2" />
                        <p className="text-white text-xs mb-3 font-medium">
                          This prompt is locked. Upgrade to Pro to unlock all prompts.
                        </p>
                        <button 
                          onClick={handleUpgradeClick}
                          className="action-button bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold py-1.5 px-4 rounded-md transition-colors shadow-sm"
                        >
                          Upgrade
                        </button>
                      </div>
                    )}

                    <div className={`relative ${isLocked ? 'pointer-events-none' : ''}`}>                    
                      {/* 提示词内容区域 - 固定行数而非高度 */}
                      <div className={`${isExpanded ? '' : 'relative'}`}>
                        <p className={`text-[10px] text-gray-700 dark:text-magic-200 whitespace-pre-line break-words ${
                          isExpanded ? '' : 'line-clamp-5'
                        }`}>
                          {formatContentPreview(prompt.content)}
                        </p>
                        
                        {/* 添加渐变遮罩，仅在未展开时显示 */}
                        {!isExpanded && (
                          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white dark:from-magic-900 to-transparent"></div>
                        )}
                      </div>

                      {/* 展开/折叠按钮，居中显示 */}
                      <div className="flex justify-center mt-1 mb-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCardExpansion(prompt.id);
                          }}
                          className="expand-toggle-button action-button flex items-center space-x-1 px-2 py-0.5 text-[10px] rounded-full text-gray-500 dark:text-magic-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-magic-800/80 transition-colors border border-gray-200 dark:border-magic-700/30"
                        >
                          <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      </div>

                      {/* 元数据区 - 使用图标优化显示 */}
                      <div className="text-xs text-gray-500 dark:text-magic-500 flex justify-between items-center border-t border-gray-100 dark:border-magic-800 pt-2">
                        <div className="flex items-center gap-3">
                          {isRecommended ? (
                            // 推荐提示词不再需要显示标识，因为已经在标题区显示
                            <span className="text-[10px] flex items-center opacity-70">
                              {new Date(prompt.updatedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            // 用户提示词显示使用次数和更新时间
                            <>
                              <span className="text-[10px] flex items-center">
                                <FileText size={10} className="mr-1 opacity-70" />
                                {prompt.useCount || 0} uses
                              </span>
                              <span className="text-[10px] flex items-center opacity-70">
                                {new Date(prompt.updatedAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>

                        {/* 操作按钮 - 常态显示，hover增强 */}
                        <div className="flex items-center space-x-1">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation();
                              handleCopy(prompt.id, prompt.content, isRecommended);
                            }}
                            className="action-button p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-magic-700/50 rounded-full transition-all duration-200"
                            title="Copy prompt content"
                          >
                            <Copy size={14} />
                          </button>
                          {/* 只为用户提示词显示删除按钮 */}
                          {!isRecommended && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation();
                                handleDelete(prompt.id);
                              }}
                              className="action-button p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200"
                              title="Remove from Library"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
              
              {/* 加载更多按钮 - 仅在未搜索且有更多推荐提示词可加载时显示 */}
              {!searchTerm && visibleRecommendedCount < recommendedPrompts.length && (
                <button 
                  onClick={() => setVisibleRecommendedCount(prev => prev + LOAD_MORE_COUNT)}
                  className="w-full mt-4 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-purple-600 dark:text-magic-400 hover:bg-purple-50 dark:hover:bg-magic-800/50 border border-dashed border-purple-200 dark:border-magic-700/50 rounded-md transition-all hover:shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                  <span>Load more recommendations</span>
                  <span className="text-gray-500 dark:text-magic-500 font-normal">({visibleRecommendedCount}/{recommendedPrompts.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setPromptToDelete(null);
        }}
        onConfirm={confirmAction1}
        message="Are you sure you want to remove this prompt from your library?"
        confirmText="Remove"
        cancelText="Cancel"
        fastAnimation={true}
      />

      {/* 提示词详情抽屉 */}
      {selectedPrompt && (
        <PromptDetailDrawer
          isOpen={isDetailOpen}
          prompt={selectedPrompt}
          onClose={handleCloseDetail}
          onEdit={() => {
            // 只有用户提示词才能编辑
            if (!selectedPrompt.isRecommended) {
              setEditingPrompt(selectedPrompt);
              setIsFormOpen(true);
              setIsDetailOpen(false);
            }
          }}
        />
      )}

      {/* 提示词表单模态框 */}
      <PromptFormModal
        isOpen={isFormOpen}
        prompt={editingPrompt}
        onClose={handleCloseForm}
        currentPromptCount={prompts.length}
      />
    </div>
  );
} 