import React, { useState, useEffect } from 'react';
import { X, Copy, Heart, HeartOff, Clock, Star, Check, Trash2 } from 'lucide-react';
import { Prompt } from '../../../services/prompt/types';
import { usePromptsData } from '../../../hooks/usePromptsData';
import { formatDate } from '../../../utils/formatDate';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { FeatureType, featureUsageService } from '@/services/featureUsage';

interface PromptDetailDrawerProps {
  prompt: Prompt | undefined;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (prompt: Prompt) => void;
}

export function PromptDetailDrawer({ prompt, isOpen, onClose, onEdit }: PromptDetailDrawerProps) {
  const { incrementUseCount, toggleFavorite, deletePrompt, updatePrompt } = usePromptsData();
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isContentEditing, setIsContentEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  // 添加本地状态以跟踪最新的提示词内容
  const [localPrompt, setLocalPrompt] = useState<Prompt | undefined>(prompt);
  // 添加复制成功的状态标记
  const [copySuccess, setCopySuccess] = useState(false);
  
  // 确认对话框状态
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  
  // 每次打开或提示词更新时，更新编辑状态和本地提示词
  useEffect(() => {
    if (prompt) {
      setEditTitle(prompt.title);
      setEditContent(prompt.content);
      setLocalPrompt(prompt);
    }
  }, [prompt, isOpen]);
  
  // 复制成功后的反馈效果
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => {
        setCopySuccess(false);
      }, 2000); // 2秒后恢复按钮状态
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);
  
  // 如果没有提示词或抽屉关闭，则不显示任何内容
  if (!isOpen || !localPrompt) return null;
  
  // 格式化日期 - 使用本地提示词数据
  const created = formatDate(localPrompt.createdAt);
  const updated = formatDate(localPrompt.updatedAt);
  const lastUsed = localPrompt.lastUsed ? formatDate(localPrompt.lastUsed) : '-';
  
  // 处理复制提示词
  const handleCopy = () => {
    featureUsageService.trackFeature(
      FeatureType.PROMPT_COPY,
      async () => {
        await navigator.clipboard.writeText(localPrompt.content);
        incrementUseCount(localPrompt.id);
        setCopySuccess(true);
        return { success: true };
      },
      {
        metadata: {
          promptId: localPrompt.id,
          copySource: 'detail_drawer',
          promptLength: localPrompt.content.length,
          hasNewlines: localPrompt.content.includes('\n')
        }
      }
    ).catch(err => {
      console.error('复制失败:', err);
      // 也可以在这里显示错误反馈
    });
  };
  
  // 处理删除提示词
  const handleDelete = () => {
    setConfirmDialogOpen(true);
  };
  
  // 确认删除
  const confirmDelete = async () => {
    if (localPrompt) {
      await deletePrompt(localPrompt.id);
      onClose();
    }
  };

  // 处理开始编辑标题
  const handleStartEditTitle = () => {
    // 只允许对非推荐提示词编辑标题
    if (!localPrompt.isRecommended) {
      setEditTitle(localPrompt.title);
      setIsTitleEditing(true);
    }
  };

  // 处理开始编辑内容
  const handleStartEditContent = () => {
    // 只允许对非推荐提示词编辑内容
    if (!localPrompt.isRecommended) {
      setEditContent(localPrompt.content);
      setIsContentEditing(true);
    }
  };

  // 处理保存编辑
  const handleSaveEdit = async () => {
    console.log("保存编辑被触发", { 
      isTitleEditing, 
      isContentEditing, 
      editTitle, 
      editContent 
    });
    
    if (isTitleEditing || isContentEditing) {
      const now = Date.now();
      const updatedPrompt = { 
        ...localPrompt,
        title: isTitleEditing ? editTitle : localPrompt.title,
        content: isContentEditing ? editContent : localPrompt.content,
        updatedAt: now
      };
      
      console.log("更新的提示词数据:", updatedPrompt);
      
      // 直接更新提示词，不显示模态窗口
      try {
        // 这里使用updatePrompt而不是onEdit来避免显示模态窗口
        if (updatePrompt) {
          // 提取更新内容
          const { id, ...updateInput } = updatedPrompt;
          console.log("调用 updatePrompt 函数，更新ID:", id);
          
          // 先更新本地状态，使UI立即响应
          setLocalPrompt(updatedPrompt);
          
          // 然后更新到服务端/存储中
          const success = await updatePrompt(id, updateInput);
          
          if (!success) {
            console.error("更新提示词失败");
            // 如果更新失败，可以考虑回滚本地状态
            // setLocalPrompt(prompt);
          }
        } else {
          // 如果没有updatePrompt函数，仍然可以使用onEdit，但这可能会打开模态窗口
          console.warn('updatePrompt not available, using onEdit instead');
          setLocalPrompt(updatedPrompt); // 仍然更新本地状态
          onEdit(updatedPrompt);
        }
      } catch (error) {
        console.error('Failed to update prompt:', error);
      }
      
      setIsTitleEditing(false);
      setIsContentEditing(false);
    }
  };

  // 强制保存编辑的处理器
  const handleForceSave = () => {
    if (isContentEditing || isTitleEditing) {
      handleSaveEdit();
    }
  };
  
  return (
    <div className={`fixed inset-y-0 right-0 w-80 bg-gradient-to-br from-gray-50 to-white dark:from-magic-800 dark:to-magic-900 border-l border-gray-200 dark:border-magic-700/30 shadow-xl z-drawer-container transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* 抽屉头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-magic-700/30 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-magic-200 truncate">Prompt Details</h3>
        <button
          onClick={() => {
            handleForceSave();
            onClose();
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-magic-700/50 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-magic-400" />
        </button>
      </div>
      
      {/* 抽屉内容 - 使用flex-1和overflow-y-auto使内容区域可滚动 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 标题 */}
        {isTitleEditing ? (
          <div className="mb-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="w-full bg-white dark:bg-magic-800 border border-gray-300 dark:border-magic-600 rounded-md p-2 text-base font-bold text-gray-700 dark:text-magic-200 mb-2"
              autoFocus
            />
            <div className="text-xs text-gray-500 dark:text-magic-400">Press Enter to save or click outside</div>
          </div>
        ) : (
          <h2 
            className={`text-base font-bold text-gray-800 dark:text-magic-200 mb-4 ${!localPrompt.isRecommended ? 'cursor-text' : ''} break-words`}
            onDoubleClick={handleStartEditTitle}
            title={!localPrompt.isRecommended ? "Double-click to edit title" : undefined}
          >
            {localPrompt.title}
          </h2>
        )}
        
        {/* 内容 */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 dark:text-magic-400 mb-2">Content</h4>
          {isContentEditing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={handleSaveEdit}
                className="w-full bg-white dark:bg-magic-800 border border-gray-300 dark:border-magic-600 rounded-md p-3 text-gray-700 dark:text-magic-200 max-h-[300px] min-h-[150px] scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-magic-600 scrollbar-track-gray-100 dark:scrollbar-track-magic-800 text-xs"
                autoFocus
              />
              <div className="text-xs text-gray-500 dark:text-magic-400 mt-1">Click outside to save</div>
            </div>
          ) : (
            <div 
              className={`bg-gray-50 dark:bg-magic-800/50 border border-gray-200 dark:border-magic-700/30 rounded-md p-3 mb-4 text-gray-700 dark:text-magic-200 text-xs whitespace-pre-line ${!localPrompt.isRecommended ? 'cursor-text' : ''} max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-magic-600 scrollbar-track-gray-100 dark:scrollbar-track-magic-800/50`}
              onDoubleClick={handleStartEditContent}
              title={!localPrompt.isRecommended ? "Double-click to edit content" : undefined}
            >
              {localPrompt.content}
            </div>
          )}
        </div>
        
        {/* 元数据 */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 dark:text-magic-400 mb-2">Metadata</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="text-gray-500 dark:text-magic-400">Created:</div>
            <div className="text-gray-700 dark:text-magic-200">{created}</div>
            
            <div className="text-gray-500 dark:text-magic-400">Last edited:</div>
            <div className="text-gray-700 dark:text-magic-200">{updated}</div>
            
            <div className="text-gray-500 dark:text-magic-400">Last used:</div>
            <div className="text-gray-700 dark:text-magic-200">{lastUsed}</div>
            
            <div className="text-gray-500 dark:text-magic-400">Usage count:</div>
            <div className="text-gray-700 dark:text-magic-200">{localPrompt.useCount || 0}</div>
            
            {/* 添加提示词类型信息 */}
            <div className="text-gray-500 dark:text-magic-400">Type:</div>
            <div className="text-gray-700 dark:text-magic-200">
              {localPrompt.isRecommended ? (
                <span className="text-blue-600 dark:text-blue-400">System Recommended</span>
              ) : (
                "User Created"
              )}
            </div>
          </div>
        </div>
        
        {/* 新增：来源 URL */} 
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-600 dark:text-magic-400 mb-2">Source</h4>
          {localPrompt.sourceUrl ? (
            <a 
              href={localPrompt.sourceUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 hover:underline truncate block"
              title={localPrompt.sourceUrl}
            >
              {localPrompt.sourceUrl}
            </a>
          ) : (
            <p className="text-xs text-gray-500 dark:text-magic-300">Self-created</p>
          )}
        </div>
      </div>
      
      {/* 抽屉底部操作区 */}
      <div className="p-4 border-t border-gray-200 dark:border-magic-700/30 flex space-x-2">
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-magic-600/30 dark:hover:bg-magic-600/50 rounded-md transition-colors"
        >
          {copySuccess ? (
            <>
              <Check size={14} className="text-green-600 dark:text-green-400" />
              <span className="text-xs text-gray-700 dark:text-magic-200 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} className="text-gray-500 dark:text-magic-400" />
              <span className="text-xs text-gray-700 dark:text-magic-200 font-medium">Copy</span>
            </>
          )}
        </button>
        
        {/* 只对非推荐提示词显示编辑按钮 */}
        {!localPrompt.isRecommended && (
          <button
            onClick={isContentEditing || isTitleEditing ? handleSaveEdit : handleStartEditContent}
            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-magic-600/30 dark:hover:bg-magic-600/50 rounded-md transition-colors"
          >
            <span className="text-xs text-gray-700 dark:text-magic-200 font-medium">
              {isContentEditing || isTitleEditing ? "Save" : "Edit"}
            </span>
          </button>
        )}
        
        <div className="flex-1"></div>
        
        {/* 只对非推荐提示词显示删除按钮 */}
        {!localPrompt.isRecommended && (
          <button
            onClick={handleDelete}
            className="flex items-center space-x-1 px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 rounded-md transition-colors"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
            <span className="text-xs text-red-600 dark:text-red-300 font-medium">Remove</span>
          </button>
        )}
      </div>
      
      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDelete}
        message="Are you sure you want to remove this prompt from your library?"
        confirmText="Remove"
        cancelText="Cancel"
        fastAnimation={true}
      />
    </div>
  );
} 