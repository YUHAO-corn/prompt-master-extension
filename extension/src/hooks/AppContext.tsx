import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Prompt, CreatePromptInput, createPrompt } from '../services/prompt';
import { syncStorage } from '../services/storage';
import { OptimizationVersion, OptimizeOptions, continueOptimize } from '@/services/optimizationService';
import { OptimizationMode } from '@/services/systemPrompts';
import { useAuth } from './useAuth';
import type { User } from '../services/auth/types';

// 定义状态接口
interface AppState {
  // UI状态
  activeTab: 'library' | 'optimize';
  magicianLevel: number;
  isLoading: boolean;
  error: string | null;
  isAuthOpen: boolean;
  authPromptMessage?: string | null;
  
  // 业务状态
  prompts: Prompt[];
  currentOptimizationInput: string;
  optimizationVersions: OptimizationVersion[];
  currentOptimizeMode: 'standard' | 'creative' | 'concise';
}

// 定义Context接口
interface AppContextType {
  // 状态
  state: AppState;
  authLoading: boolean;
  authUser: User | null;
  authError: string | null;
  isAuthenticated: boolean;
  
  // UI操作
  setActiveTab: (tab: 'library' | 'optimize') => void;
  incrementMagicianLevel: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  openAuthDrawer: (message?: string) => void;
  closeAuthDrawer: () => void;
  
  // 业务操作
  searchPrompts: (keyword: string) => Promise<Prompt[]>;
  addPrompt: (promptInput: CreatePromptInput) => Promise<void>;
  updatePrompt: (id: string, updates: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  incrementPromptUse: (id: string) => Promise<void>;
  
  // 优化操作
  setOptimizationInput: (input: string) => void;
  startOptimization: () => Promise<void>;
  continueOptimization: (versionId: number) => Promise<void>;
  setOptimizeMode: (mode: 'standard' | 'creative' | 'concise') => void;
  updateOptimizationVersion: (versionId: number, updates: Partial<OptimizationVersion>) => void;
}

// 创建Context
const AppContext = createContext<AppContextType | undefined>(undefined);

// 生成唯一ID的工具函数
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Provider组件
export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading, error: authHookError, isAuthenticated, logout } = useAuth();

  // 初始状态
  const [state, setState] = useState<AppState>({
    // UI状态
    activeTab: 'library',
    magicianLevel: 1,
    isLoading: false,
    error: null,
    isAuthOpen: false,
    authPromptMessage: null,
    
    // 业务状态
    prompts: [],
    currentOptimizationInput: '',
    optimizationVersions: [],
    currentOptimizeMode: 'standard',
  });
  
  // 初始化：从存储加载数据
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        const storedPrompts = await syncStorage.get<Prompt[]>('prompts') || [];
        setState(prev => ({ 
          ...prev, 
          prompts: storedPrompts,
          isLoading: false 
        }));
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: '加载数据失败',
          isLoading: false 
        }));
        console.error('Failed to load initial data:', error);
      }
    };
    
    loadInitialData();
  }, []);
  
  // UI操作函数
  const setActiveTab = (tab: 'library' | 'optimize') => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };
  
  const incrementMagicianLevel = () => {
    setState(prev => ({ 
      ...prev, 
      magicianLevel: Math.min(prev.magicianLevel + 1, 99) 
    }));
  };
  
  const setIsLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  };
  
  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };
  
  // Auth Modal控制函数 - 使用 useCallback 包装
  const openAuthDrawer = React.useCallback((message?: string) => {
    setState(prev => ({ 
      ...prev, 
      isAuthOpen: true, 
      authPromptMessage: message || null
    }));
  }, []);

  const closeAuthDrawer = React.useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isAuthOpen: false, 
      authPromptMessage: null
    }));
  }, []);

  // 设置优化模式
  const setOptimizeMode = (mode: 'standard' | 'creative' | 'concise') => {
    setState(prev => ({ ...prev, currentOptimizeMode: mode }));
  };
  
  // 业务操作函数
  const searchPrompts = async (keyword: string): Promise<Prompt[]> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      if (!keyword.trim()) {
        return state.prompts;
      }
      
      const term = keyword.toLowerCase();
      const results = state.prompts.filter(prompt => 
        prompt.title.toLowerCase().includes(term) || 
        prompt.content.toLowerCase().includes(term)
      );
      
      setState(prev => ({ ...prev, isLoading: false }));
      return results;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '搜索提示词失败',
        isLoading: false 
      }));
      console.error('Failed to search prompts:', error);
      return [];
    }
  };
  
  const addPrompt = async (promptInput: CreatePromptInput): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to add prompts.");
    }
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // 使用服务层createPrompt函数
      const newPrompt = await createPrompt(promptInput);
      
      const updatedPrompts = [...state.prompts, newPrompt];
      await syncStorage.set('prompts', updatedPrompts);
      
      setState(prev => ({ 
        ...prev, 
        prompts: updatedPrompts,
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '添加提示词失败',
        isLoading: false 
      }));
      console.error('Failed to add prompt:', error);
    }
  };
  
  const updatePrompt = async (id: string, updates: Partial<Prompt>): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to update prompts.");
    }
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const updatedPrompts = state.prompts.map(prompt => 
        prompt.id === id ? { ...prompt, ...updates } : prompt
      );
      
      await syncStorage.set('prompts', updatedPrompts);
      
      setState(prev => ({ 
        ...prev, 
        prompts: updatedPrompts,
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '更新提示词失败',
        isLoading: false 
      }));
      console.error('Failed to update prompt:', error);
    }
  };
  
  const deletePrompt = async (id: string): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to delete prompts.");
    }
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const updatedPrompts = state.prompts.filter(prompt => prompt.id !== id);
      await syncStorage.set('prompts', updatedPrompts);
      
      setState(prev => ({ 
        ...prev, 
        prompts: updatedPrompts,
        isLoading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '删除提示词失败',
        isLoading: false 
      }));
      console.error('Failed to delete prompt:', error);
    }
  };
  
  const toggleFavorite = async (id: string): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to manage favorites.");
    }
    try {
      const prompt = state.prompts.find(p => p.id === id);
      if (!prompt) return;
      
      // 检查当前收藏状态
      const isFavorited = prompt.isFavorite || prompt.favorite;
      
      if (isFavorited) {
        // 如果已收藏，则删除提示词
        await deletePrompt(id);
      } else {
        // 如果未收藏，则标记为收藏
        await updatePrompt(id, { 
          isFavorite: true, 
          favorite: true 
        });
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '更新收藏状态失败'
      }));
      console.error('Failed to toggle favorite:', error);
    }
  };
  
  const incrementPromptUse = async (id: string): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to track prompt usage.");
    }
    try {
      const prompt = state.prompts.find(p => p.id === id);
      if (!prompt) return;
      
      await updatePrompt(id, { 
        useCount: (prompt.useCount || 0) + 1,
        lastUsed: Date.now()
      });
    } catch (error) {
      console.error('Failed to increment prompt use count:', error);
    }
  };
  
  // 优化操作函数
  const setOptimizationInput = (input: string) => {
    setState(prev => ({ ...prev, currentOptimizationInput: input }));
  };
  
  // 更新优化版本
  const updateOptimizationVersion = (versionId: number, updates: Partial<OptimizationVersion>) => {
    setState(prev => ({
      ...prev,
      optimizationVersions: prev.optimizationVersions.map(version => 
        version.id === versionId 
          ? { ...version, ...updates } 
          : version
      )
    }));
  };
  
  const startOptimization = async (): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to start optimization.");
    }
    try {
      if (!state.currentOptimizationInput.trim()) return;
      
      // 清空之前的优化版本，开始新的优化任务
      setState(prev => ({ 
        ...prev, 
        isLoading: true,
        optimizationVersions: [{
          id: 1,
          content: '',
          isLoading: true,
          isNew: true,
          createdAt: Date.now()
        }]
      }));
      
      // 模拟API调用延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setState(prev => ({ 
        ...prev, 
        optimizationVersions: [{
          id: 1,
          content: state.currentOptimizationInput,
          isLoading: false,
          isNew: true,
          createdAt: Date.now()
        }],
        isLoading: false
      }));
      
      incrementMagicianLevel();
      
      // 移除"新"标记动画
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          optimizationVersions: prev.optimizationVersions.map(v => ({ 
            ...v, 
            isNew: false 
          }))
        }));
      }, 1200);
      
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '优化提示词失败',
        isLoading: false 
      }));
      console.error('Failed to optimize prompt:', error);
    }
  };
  
  const continueOptimization = async (versionId: number): Promise<void> => {
    if (!user) {
      openAuthDrawer();
      throw new Error("Authentication required to continue optimization.");
    }
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // 找到要继续优化的版本
      const sourceVersion = state.optimizationVersions.find(v => v.id === versionId);
      if (!sourceVersion) return;
      
      // 使用编辑过的内容或原始内容
      const contentToOptimize = sourceVersion.editedContent || sourceVersion.content;
      
      // 确定插入位置
      const sourceIndex = state.optimizationVersions.findIndex(v => v.id === versionId);
      
      // 生成新版本ID
      const newVersionId = Math.max(...state.optimizationVersions.map(v => v.id)) + 1;
      
      // 创建加载状态的新版本
      const placeholderVersion: OptimizationVersion = {
        id: newVersionId,
        content: '',
        isLoading: true,
        isNew: true,
        createdAt: Date.now(),
        parentId: sourceVersion.id // 设置父版本ID
      };
      
      // 在原版本后面插入新版本
      const updatedVersions = [
        ...state.optimizationVersions.slice(0, sourceIndex + 1),
        placeholderVersion,
        ...state.optimizationVersions.slice(sourceIndex + 1)
      ];
      
      setState(prev => ({
        ...prev,
        optimizationVersions: updatedVersions
      }));
      
      // 实际调用API进行优化，而不是使用模拟数据
      const optimizedContent = await continueOptimize(contentToOptimize, state.currentOptimizeMode);
      console.log('[AppContext] 获取到继续优化的内容，长度:', optimizedContent.length);
      
      // 优化结果
      const optimizedVersion: OptimizationVersion = {
        id: newVersionId,
        content: optimizedContent,
        isLoading: false,
        isNew: true,
        createdAt: Date.now(),
        parentId: sourceVersion.id // 保持父版本ID引用
      };
      
      // 更新版本列表
      const finalVersions = [
        ...state.optimizationVersions.slice(0, sourceIndex + 1),
        optimizedVersion,
        ...state.optimizationVersions.slice(sourceIndex + 2) // +2 因为要跳过占位符版本
      ];
      
      setState(prev => ({
        ...prev,
        optimizationVersions: finalVersions,
        isLoading: false
      }));
      
      incrementMagicianLevel();
      
      // 移除"新"标记动画
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          optimizationVersions: prev.optimizationVersions.map(v => ({ 
            ...v, 
            isNew: false 
          }))
        }));
      }, 1200);
      
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: '继续优化失败',
        isLoading: false 
      }));
      console.error('Failed to continue optimization:', error);
    }
  };
  
  // 新增：监听来自 background 的消息以打开 AuthModal
  React.useEffect(() => {
    const messageListener = (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (request.type === 'SHOW_AUTH_MODAL_WITH_PROMPT') {
        console.log('[AppContext] Received SHOW_AUTH_MODAL_WITH_PROMPT with message:', request.payload?.message);
        openAuthDrawer(request.payload?.message); 
        // 可以根据需要决定是否以及如何响应
        // sendResponse({ success: true, messageReceived: true });
        return true; // 返回true表示我们将异步发送响应 (如果调用了sendResponse)
                     // 或者只是为了防止 "message port closed" 警告，即使不发送响应
      }
      // 对于其他消息，可以不返回或返回 undefined/false
      return undefined; 
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [openAuthDrawer]); // 依赖于 openAuthDrawer (现在是稳定引用)
  
  // 合并Context值
  const contextValue: AppContextType = React.useMemo(() => ({
    state,
    authLoading: loading,
    authUser: user,
    authError: authHookError,
    isAuthenticated,
    setActiveTab,
    incrementMagicianLevel,
    setIsLoading,
    setError,
    openAuthDrawer,
    closeAuthDrawer,
    searchPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    incrementPromptUse,
    setOptimizationInput,
    startOptimization,
    continueOptimization,
    setOptimizeMode,
    updateOptimizationVersion
  }), [state, loading, authHookError, isAuthenticated, user, setActiveTab, incrementMagicianLevel, setIsLoading, setError, openAuthDrawer, closeAuthDrawer, searchPrompts, addPrompt, updatePrompt, deletePrompt, toggleFavorite, incrementPromptUse, setOptimizationInput, startOptimization, continueOptimization, setOptimizeMode, updateOptimizationVersion]);
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// 自定义Hook，便于使用Context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
} 