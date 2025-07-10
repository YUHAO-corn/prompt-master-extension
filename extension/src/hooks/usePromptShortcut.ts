import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// 移除直接导入useAuth，改为接受isAuthenticated作为参数
// import { useAuth } from './useAuth';

interface Suggestion {
  id: string;
  title: string;
  content: string;
  createdAt?: number;
}

interface UsePromptShortcutOptions {
  onSelectPrompt?: (promptContent: string) => void;
  onClose?: () => void;
  isAuthenticated?: boolean; // 新增参数，允许外部传入认证状态
}

interface UsePromptShortcutResult {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  suggestions: Suggestion[];
  highlightedIndex: number | null;
  handleSearchChange: (newSearchTerm: string) => void;
  handleArrowDown: () => void;
  handleArrowUp: () => void;
  handleEnterOrTab: () => void;
  handleEscape: () => void;
  handleSelectSuggestion: (suggestion: Suggestion) => void;
  isLoading: boolean;
  isAuthenticated: boolean; // 添加认证状态
  authError: boolean; // 添加认证错误状态
}

// 定义结果限制常量
const MAX_RESULTS = 15;

/**
 * React钩子函数，封装PromptShortcut功能的核心交互逻辑
 * 作为内容脚本中React UI与底层浏览器事件、Service Worker通信之间的桥梁
 */
export function usePromptShortcut({
  onSelectPrompt,
  onClose,
  isAuthenticated = false // 默认为未认证
}: UsePromptShortcutOptions = {}): UsePromptShortcutResult {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<boolean>(false); // 认证错误状态
  
  // 使用ref存储最新的搜索请求id，以防止竞态条件
  const searchRequestIdRef = useRef<number>(0);
  
  // 添加防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 创建防抖搜索函数
  const debouncedSearch = useCallback((term: string) => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // 创建新的定时器
    debounceTimerRef.current = setTimeout(() => {
      // 如果用户未认证，设置authError并不执行搜索
      if (!isAuthenticated) {
        console.log(`[PromptShortcut] 用户未认证，无法搜索提示词`);
        setAuthError(true);
        setIsLoading(false);
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setAuthError(false); // 重置认证错误状态
      const currentRequestId = ++searchRequestIdRef.current;
      console.log(`[PromptShortcut] 开始搜索提示词，关键词: "${term}"`);

      // 🚀 Analytics埋点：追踪搜索行为
      try {
        import('../services/analytics').then(({ trackShortcutUsage }) => {
          trackShortcutUsage('search', {
            searchTerm: term,
            searchLength: term.length
          });
        }).catch(analyticsError => {
          console.error('[Analytics] Failed to track shortcut search:', analyticsError);
        });
      } catch (analyticsError) {
        console.error('[Analytics] Failed to import analytics for search tracking:', analyticsError);
      }

      // 向Service Worker发送消息获取搜索结果
      chrome.runtime.sendMessage(
        { 
          type: 'SEARCH_LOCAL_PROMPTS', 
          payload: { 
            query: term,
            limit: MAX_RESULTS // 添加结果数量限制
          } 
        },
        (response) => {
          // 如果这个响应不是最新请求的响应，则忽略
          if (currentRequestId !== searchRequestIdRef.current) {
            console.log(`[PromptShortcut] 忽略过期搜索响应，请求ID: ${currentRequestId}`);
            return;
          }
          
          setIsLoading(false);
          
          if (chrome.runtime.lastError) {
            console.error('[PromptShortcut] 搜索提示词失败:', chrome.runtime.lastError);
            setSuggestions([]);
            return;
          }
          
          if (response && response.success && Array.isArray(response.data)) {
            console.log(`[PromptShortcut] 搜索成功，找到 ${response.data.length} 条匹配提示词`);
            // 确保结果不超过限制
            const limitedResults = response.data.slice(0, MAX_RESULTS);
            setSuggestions(limitedResults);
            setHighlightedIndex(limitedResults.length > 0 ? 0 : null);
            
            // 🚀 Analytics埋点：追踪搜索结果
            try {
              import('../services/analytics').then(({ trackShortcutUsage }) => {
                trackShortcutUsage('search_completed', {
                  searchTerm: term,
                  resultsCount: limitedResults.length,
                  hasResults: limitedResults.length > 0
                });
              }).catch(analyticsError => {
                console.error('[Analytics] Failed to track search results:', analyticsError);
              });
            } catch (analyticsError) {
              console.error('[Analytics] Failed to import analytics for search results:', analyticsError);
            }
          } else if (response && !response.success && response.error === 'User not authenticated') {
            console.log('[PromptShortcut] 用户未认证，无法搜索提示词');
            setAuthError(true);
            setSuggestions([]);
          } else {
            console.error('[PromptShortcut] 搜索提示词返回格式错误:', response);
            setSuggestions([]);
          }
        }
      );
    }, 300); // 300ms 防抖延迟
  }, [isAuthenticated]);

  // 搜索逻辑
  useEffect(() => {
    // 重要：当用户刚触发 "/" 时，字符串为空，此时直接返回空数组
    // 只有当用户实际输入了搜索关键词才开始搜索
    if (searchTerm.trim() === '') {
      setSuggestions([]);
      setHighlightedIndex(null);
      setAuthError(false); // 重置认证错误状态
      setIsLoading(false);
      // 清除可能存在的定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      return;
    }

    // 使用防抖搜索
    debouncedSearch(searchTerm);
    
    // 组件卸载时清理
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debouncedSearch]);

  // 处理方向键导航
  const handleArrowDown = useCallback(() => {
    if (suggestions.length === 0) return;
    setHighlightedIndex(prevIndex => 
      prevIndex === null || prevIndex === suggestions.length - 1 ? 0 : prevIndex + 1
    );
  }, [suggestions.length]);

  const handleArrowUp = useCallback(() => {
    if (suggestions.length === 0) return;
    setHighlightedIndex(prevIndex => 
      prevIndex === null || prevIndex === 0 ? suggestions.length - 1 : prevIndex - 1
    );
  }, [suggestions.length]);

  // 处理选择提示词
  const handleSelectSuggestion = useCallback((suggestion: Suggestion) => {
    console.log(`[PromptShortcut] 用户选择提示词: "${suggestion.title}"`);
    
    // 🚀 Analytics埋点：追踪快捷输入功能的提示词使用
    try {
      import('../services/analytics').then(({ trackPromptAction }) => {
        trackPromptAction('used', suggestion.id, {
          title: suggestion.title,
          context: 'prompt_shortcut',
          source: 'shortcut_input',
          inputMethod: 'keyboard_shortcut',
          triggerType: 'slash_command'
        });
      }).catch(analyticsError => {
        console.error('[Analytics] Failed to track prompt usage via shortcut:', analyticsError);
      });
    } catch (analyticsError) {
      console.error('[Analytics] Failed to import analytics for shortcut tracking:', analyticsError);
    }
    
    onSelectPrompt?.(suggestion.content);
    setSearchTerm('');
    setSuggestions([]);
    setHighlightedIndex(null);
  }, [onSelectPrompt]);

  // 处理回车或Tab键选择当前高亮项
  const handleEnterOrTab = useCallback(() => {
    if (highlightedIndex !== null && suggestions[highlightedIndex]) {
      console.log(`[PromptShortcut] 通过键盘(Enter/Tab)选择提示词`);
      
      const selectedSuggestion = suggestions[highlightedIndex];
      
      // 🚀 Analytics埋点：追踪键盘快捷键选择的提示词使用
      try {
        import('../services/analytics').then(({ trackPromptAction }) => {
          trackPromptAction('used', selectedSuggestion.id, {
            title: selectedSuggestion.title,
            context: 'prompt_shortcut',
            source: 'shortcut_input',
            inputMethod: 'keyboard_enter_tab',
            triggerType: 'slash_command',
            highlightedIndex
          });
        }).catch(analyticsError => {
          console.error('[Analytics] Failed to track prompt usage via keyboard:', analyticsError);
        });
      } catch (analyticsError) {
        console.error('[Analytics] Failed to import analytics for keyboard tracking:', analyticsError);
      }
      
      handleSelectSuggestion(selectedSuggestion);
    }
  }, [highlightedIndex, suggestions, handleSelectSuggestion]);

  // 处理Escape键关闭浮层
  const handleEscape = useCallback(() => {
    console.log(`[PromptShortcut] 用户按下Escape键或删除了前导斜杠，关闭浮层`);
    
    // 🚀 Analytics埋点：追踪取消操作
    try {
      import('../services/analytics').then(({ trackShortcutUsage }) => {
        trackShortcutUsage('cancelled', {
          searchTerm,
          suggestionsCount: suggestions.length,
          hasHighlight: highlightedIndex !== null
        });
      }).catch(analyticsError => {
        console.error('[Analytics] Failed to track shortcut cancellation:', analyticsError);
      });
    } catch (analyticsError) {
      console.error('[Analytics] Failed to import analytics for cancellation tracking:', analyticsError);
    }
    
    setSearchTerm('');
    setSuggestions([]);
    setHighlightedIndex(null);
    setAuthError(false); // 重置认证错误状态
    onClose?.();
  }, [onClose, searchTerm, suggestions.length, highlightedIndex]);
  
  // 处理搜索词变化
  const handleSearchChange = useCallback((newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    suggestions,
    highlightedIndex,
    handleArrowDown,
    handleArrowUp,
    handleEnterOrTab,
    handleEscape,
    handleSelectSuggestion,
    handleSearchChange,
    isLoading,
    isAuthenticated,
    authError
  };
} 