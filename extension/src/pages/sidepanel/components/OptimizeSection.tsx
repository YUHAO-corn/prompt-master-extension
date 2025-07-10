import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, Copy, Bookmark, AlertTriangle, Link as LinkIcon, Maximize2, Minimize2 } from 'lucide-react';
import type { Prompt } from '../../../services/prompt/types';
import { OptimizationDetailDrawer } from './OptimizationDetailDrawer';
import { OptimizationModeSelector } from './OptimizationModeSelector';
import { Toast } from '../../../components/common/Toast';
import type { OptimizationMode, OptimizationVersion } from '../../../services/optimization';
import { 
  isErrorVersion, 
  getVersionDisplayContent, 
  formatContentPreview, 
  formatVersionTitle,
  toggleFavoriteVersion,
  getFavoriteStatus
} from '../../../services/optimization';
import { useAppContext } from '../../../hooks/AppContext';

// 新增：优化加载动画组件
interface OptimizationLoadingProps {
  className?: string;
}

function OptimizationLoading({ className = '' }: OptimizationLoadingProps) {
  // 保存当前阶段状态
  const [currentStage, setCurrentStage] = useState(0);
  
  // 优化阶段文本
  const stageMessages = [
    'Analyzing text...',
    'Extracting key information...',
    'Optimizing expression...',
    'Formatting final result...'
  ];
  
  // 模拟优化进度
  useEffect(() => {
    // 如果已经到达最后一个阶段，不再继续
    if (currentStage >= stageMessages.length) return;
    
    // 每1.2秒进入下一个阶段
    const timer = setTimeout(() => {
      setCurrentStage(prev => prev + 1 < stageMessages.length ? prev + 1 : prev);
    }, 1200);
    
    return () => clearTimeout(timer);
  }, [currentStage]);
  
  return (
    <div className={`flex flex-col items-center py-4 ${className}`}>
      {/* 加载指示器 */}
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-purple-200 dark:border-purple-900/30"></div>
        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 dark:border-t-purple-400 animate-spin"></div>
      </div>
      
      {/* 阶段指示器 */}
      <div className="flex space-x-2 mb-3">
        {stageMessages.map((_, index) => (
          <div 
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              index <= currentStage 
                ? 'bg-purple-500 dark:bg-purple-400' 
                : 'bg-purple-200 dark:bg-purple-800/50'
            }`}
          ></div>
        ))}
      </div>
      
      {/* 阶段消息 */}
      <div className="text-sm text-magic-600 dark:text-magic-300 mb-6 h-5">
        {currentStage < stageMessages.length ? stageMessages[currentStage] : stageMessages[stageMessages.length-1]}
      </div>
      
      {/* 骨架屏 */}
      <div className="w-full space-y-2 max-w-md">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className="h-3 bg-magic-200/70 dark:bg-magic-700/50 rounded animate-pulse"
            style={{ width: `${Math.floor(Math.random() * 30) + 70}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

interface OptimizeSectionProps {
  input: string;
  onInputChange: (input: string) => void;
  isOptimizing: boolean;
  optimizationVersions: OptimizationVersion[];
  onStartOptimize: () => void;
  onContinueOptimize: (version: OptimizationVersion) => void;
  onUpdateVersion?: (versionId: number, updates: Partial<OptimizationVersion>) => void;
  onCopy: (content: string) => void;
  onSaveToLibrary?: (content: string) => void;
  optimizationMode: OptimizationMode;
  onOptimizationModeChange: (mode: OptimizationMode) => void;
  apiError?: string | null;
}

export function OptimizeSection({
  input,
  onInputChange,
  isOptimizing,
  optimizationVersions,
  onStartOptimize,
  onContinueOptimize,
  onUpdateVersion,
  onCopy,
  onSaveToLibrary,
  optimizationMode,
  onOptimizationModeChange,
  apiError
}: OptimizeSectionProps) {
  // 详情抽屉状态
  const [selectedVersion, setSelectedVersion] = useState<OptimizationVersion | undefined>(undefined);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // 添加收藏状态跟踪
  const [favoriteVersions, setFavoriteVersions] = useState<number[]>([]);
  
  // --- Toast State ---
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  // --- End of Toast State ---

  // --- Highlight State ---
  const [highlightedVersionId, setHighlightedVersionId] = useState<number | null>(null);
  // --- End of Highlight State ---

  // --- Expanded State for Cards ---
  // 修改：默认展开所有卡片
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(
    new Set(optimizationVersions.map(v => v.id))
  );
  
  // 监听新版本添加，自动添加到展开列表
  useEffect(() => {
    if (optimizationVersions.length > 0) {
      // 找出所有版本的ID
      const allVersionIds = new Set(optimizationVersions.map(v => v.id));
      // 确保所有版本都在展开列表中
      setExpandedVersions(prev => {
        const newSet = new Set(prev);
        optimizationVersions.forEach(v => {
          newSet.add(v.id);
        });
        return newSet;
      });
    }
  }, [optimizationVersions]);
  // --- End of Expanded State ---

  // --- Trigger Toast Function ---
  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    // Optional: Auto-hide is handled by the Toast component's duration prop
  };
  // --- End of Trigger Toast Function ---
  
  // Handle favorite toggle - Update to trigger toast on save
  const handleToggleFavorite = async (versionId: number, version: OptimizationVersion) => {
    const wasFavorite = getFavoriteStatus(versionId, favoriteVersions);
    const updatedFavorites = await toggleFavoriteVersion(
      version,
      favoriteVersions,
      onSaveToLibrary
    );
    setFavoriteVersions(updatedFavorites);
    const isNowFavorite = getFavoriteStatus(versionId, updatedFavorites);

    // Trigger toast only when saving (transitioning from not favorite to favorite)
    if (!wasFavorite && isNowFavorite) {
      triggerToast('Saved to Library', 'success');
    }
  };

  // 打开版本详情
  const handleOpenDetail = (version: OptimizationVersion) => {
    setSelectedVersion(version);
    setIsDetailOpen(true);
  };

  // 关闭版本详情
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
  };

  // --- Handle Highlighting Parent Version ---
  const handleHighlightParent = (parentId: number) => {
    setHighlightedVersionId(parentId);
  };
  // --- End of Handle Highlighting ---

  // --- Effect for Scrolling and Highlighting ---
  useEffect(() => {
    if (highlightedVersionId !== null) {
      const element = document.querySelector(`[data-version-id="${highlightedVersionId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        element.classList.add('highlight-version');
        
        const timer = setTimeout(() => {
          element.classList.remove('highlight-version');
          setHighlightedVersionId(null); // Reset after animation
        }, 1500); // Highlight duration

        return () => clearTimeout(timer);
      } else {
        // If element not found (e.g., not rendered yet), just reset
        setHighlightedVersionId(null);
      }
    }
  }, [highlightedVersionId]);
  // --- End of Effect ---

  // ADD: Get auth state and openAuthDrawer from context
  const { authUser, openAuthDrawer } = useAppContext();

  // Effect to handle error display
  const [showErrorDetail, setShowErrorDetail] = useState<string | null>(null);

  // ADD: Handle optimize with auth check
  const handleStartOptimizeWithAuth = () => {
    if (!authUser) {
      openAuthDrawer('Please sign in to use optimization features.');
      return;
    }
    onStartOptimize();
  };

  const handleContinueOptimizeWithAuth = (version: OptimizationVersion) => {
    if (!authUser) {
      openAuthDrawer('Please sign in to use optimization features.');
      return;
    }
    onContinueOptimize(version);
  };

  return (
    <div className="p-3">
      <div className="mb-3 space-y-2">
        <div className="relative">
          <textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder="Enter a prompt to optimize..."
            className="w-full h-28 p-3 bg-white dark:bg-magic-800/70 border border-gray-300 dark:border-magic-600 shadow-sm rounded-lg text-sm text-magic-700 dark:text-magic-200 placeholder-gray-500 dark:placeholder-magic-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none transition-colors"
          />
          <div className="absolute top-2 right-2 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
            {input.length > 0 ? `${input.length} chars` : ''}
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleStartOptimizeWithAuth}
            disabled={!input.trim() || isOptimizing}
            className="relative flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 active:scale-[0.98] disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg text-sm font-medium disabled:cursor-not-allowed transition-all duration-150"
          >
            <span className="flex items-center justify-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span>{isOptimizing ? 'Optimizing...' : 'Start Optimization'}</span>
            </span>
            {isOptimizing && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-fast" />
            )}
          </button>
          <div className="ml-2">
            <OptimizationModeSelector 
              selectedMode={optimizationMode}
              onSelectMode={onOptimizationModeChange}
            />
          </div>
        </div>
      </div>

      {apiError && (
        <div className="my-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700/50 rounded-lg flex items-center">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mr-2" />
          <span className="text-red-600 dark:text-red-300 text-sm">{apiError}</span>
        </div>
      )}

      {/* 修改：优化加载动画逻辑，确保在优化过程中始终显示 */}
      {isOptimizing && (
        <div className="my-6 p-4 bg-white dark:bg-magic-800/50 border border-magic-200 dark:border-magic-700/30 rounded-lg">
          <OptimizationLoading />
        </div>
      )}

      <div className="space-y-3">
        {optimizationVersions.length > 0 ? (
          optimizationVersions.map(version => {
            const hasError = isErrorVersion(version.content);
            const displayContent = getVersionDisplayContent(version);
            const isFavorite = getFavoriteStatus(version.id, favoriteVersions);
            const isHighlighted = highlightedVersionId === version.id;
            const isExpanded = expandedVersions.has(version.id); // Check if current version is expanded

            const handleToggleExpand = (e: React.MouseEvent, versionId: number) => {
              e.stopPropagation(); // Prevent card click event
              setExpandedVersions(prev => {
                const newSet = new Set(prev);
                if (newSet.has(versionId)) {
                  newSet.delete(versionId);
                } else {
                  newSet.add(versionId);
                }
                return newSet;
              });
            };
            
            return (
              <div
                key={version.id}
                data-version-id={version.id}
                className={`relative p-3 ${
                  hasError 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/30' 
                    : 'bg-white dark:bg-magic-800/50 border-magic-200 dark:border-magic-700/30'
                } border rounded-lg group transition-all duration-200 ${
                  version.isNew ? 'animate-magic-reveal' : ''
                } ${version.isLoading ? 'animate-pulse' : ''} ${isHighlighted ? 'highlight-version' : ''} hover:shadow-md`}
                onClick={() => !version.isLoading && handleOpenDetail(version)}
              >
                {/* 标题和操作按钮部分 */}
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-magic-600 dark:text-magic-300">
                      {formatVersionTitle(version.id, version.isEdited)}
                    </span>
                    {version.parentId !== undefined && version.parentId !== null && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHighlightParent(version.parentId!);
                        }}
                        className="flex items-center text-[10px] text-magic-500 dark:text-magic-400 hover:text-magic-600 dark:hover:text-magic-300 mt-0.5"
                        title={`Go to parent version (v${version.parentId})`}
                      >
                        <LinkIcon size={10} className="mr-1" />
                        Based on v{version.parentId}
                      </button>
                    )}
                  </div>
                  
                  {/* 操作按钮，默认显示但降低不透明度 */}
                  {!version.isLoading && !hasError && (
                    <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => handleToggleExpand(e, version.id)}
                        className="p-1.5 hover:bg-magic-100 dark:hover:bg-magic-700/50 rounded-md transition-colors"
                        title={isExpanded ? "Collapse Content" : "Expand Content"}
                      >
                        {isExpanded ? (
                          <Minimize2 size={14} className="text-magic-600 dark:text-magic-300" />
                        ) : (
                          <Maximize2 size={14} className="text-magic-600 dark:text-magic-300" />
                        )}
                      </button>
                      {onSaveToLibrary && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(version.id, version);
                          }}
                          className="p-1.5 hover:bg-magic-100 dark:hover:bg-magic-700/50 rounded-md transition-colors"
                          title={isFavorite ? "Saved to Library" : "Save to Library"}
                        >
                          <Bookmark 
                            size={14} 
                            className={`text-magic-600 dark:text-magic-300 ${isFavorite ? 'fill-current' : 'fill-none'}`}
                          />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopy(displayContent);
                        }}
                        className="p-1.5 hover:bg-magic-100 dark:hover:bg-magic-700/50 rounded-md transition-colors"
                        title="Copy Content"
                      >
                        <Copy size={14} className="text-magic-600 dark:text-magic-300" />
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 内容预览部分 - 修改：默认展开所有内容 */}
                <div className={`text-[11px] leading-relaxed text-magic-700 dark:text-magic-200 mb-3 whitespace-pre-line ${!isExpanded ? 'line-clamp-6' : ''}`}>
                  {version.isLoading 
                    ? <div className="h-4 bg-magic-200/70 dark:bg-magic-700/50 rounded w-3/4 animate-pulse mb-2"></div>
                    : (isExpanded ? displayContent : formatContentPreview(displayContent))
                  }
                </div>
                
                {/* 底部操作区 */}
                {!version.isLoading && !hasError && (
                  <div className="flex items-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContinueOptimizeWithAuth(version);
                      }}
                      disabled={isOptimizing}
                      className="relative w-full px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 active:scale-[0.98] rounded hover:shadow-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <Wand2 className="w-4 h-4" />
                        <span>{isOptimizing ? 'Optimizing...' : 'Continue Optimization'}</span>
                      </span>
                      {isOptimizing && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-fast" />
                      )}
                    </button>
                    <div 
                      className="ml-2" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <OptimizationModeSelector 
                        selectedMode={optimizationMode}
                        onSelectMode={onOptimizationModeChange}
                        iconOnly={true}
                      />
                    </div>
                  </div>
                )}
                
                {/* 错误状态下的重试按钮 */}
                {!version.isLoading && hasError && (
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartOptimizeWithAuth();
                      }}
                      className="w-full px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 active:bg-red-700 active:scale-[0.98] rounded transition-all duration-150"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Try Again</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-10 px-4 flex flex-col items-center justify-center text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-magic-800/30">
            <Wand2 className="w-10 h-10 text-purple-300 dark:text-purple-700 mb-3" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">No optimization results yet</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
              Enter your prompt above and click "Start Optimization" to enhance your prompt with AI.
            </p>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-magic-700/30 p-2 rounded-md">
              <span className="font-medium">Tip:</span> Try a clear, specific prompt to get the best results.
            </div>
          </div>
        )}
      </div>

      {/* 详情抽屉 */}
      {selectedVersion && (
        <OptimizationDetailDrawer 
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          version={selectedVersion}
          onContinueOptimize={onContinueOptimize}
          onUpdateVersion={onUpdateVersion}
          onCopy={onCopy}
          onSaveToLibrary={onSaveToLibrary}
        />
      )}

      {/* Render Toast */}
      <Toast 
        message={toastMessage}
        type={toastType}
        show={showToast}
        onClose={() => setShowToast(false)} 
      />
    </div>
  );
} 