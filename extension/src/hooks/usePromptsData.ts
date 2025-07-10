import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isExtensionContext } from '../utils/environment';
import { Prompt, PromptFilter } from '../services/prompt/types';
import { CreatePromptInput } from '../services/prompt/types';
import { storageService } from '../services/storage';
import { sendMessage } from '../services/messaging';
import { MessageType } from '../services/messaging/types';
import { v4 as uuidv4 } from 'uuid';
import { safeLogger } from '../utils/safeEnvironment';
import { useAuth } from './useAuth';
import { createPrompt } from '../services/prompt/actions'; // 导入带功能追踪的createPrompt函数

// 定义排序规则类型
export interface SortCriteria {
  key: 'createdAt' | 'useCount'; // 可排序的字段
  order: 'asc' | 'desc'; // 排序顺序
}

/**
 * 提供统一的提示词数据访问Hook，适用于任何环境
 * 根据当前运行环境自动选择适当的数据获取方式
 */
export function usePromptsData() {
  const [rawPrompts, setRawPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>({ key: 'createdAt', order: 'desc' });
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { isAuthenticated } = useAuth();
  const isAuthenticatedRef = useRef(isAuthenticated);

  // 确定当前环境
  const isInExtension = isExtensionContext();
  
  // 使用 useEffect 保持 Ref 与状态同步
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // 内部排序函数
  const sortPromptsInternal = useCallback((promptsToSort: Prompt[], criteria: SortCriteria): Prompt[] => {
    const { key, order } = criteria;
    return [...promptsToSort].sort((a, b) => {
      const valA = a[key] || 0; // 处理可能为 undefined 的情况
      const valB = b[key] || 0;
      
      if (valA < valB) {
        return order === 'asc' ? -1 : 1;
      }
      if (valA > valB) {
        return order === 'asc' ? 1 : -1;
      }
      
      // 如果主键相同，直接按标题进行次要排序 (升序)
      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB);
    });
  }, []);
  
  // 加载所有提示词 (添加最终检查)
  const loadPrompts = useCallback(async () => {
    // Check 1: At the very beginning using the Ref
    if (!isAuthenticatedRef.current) {
       safeLogger.log('[usePromptsData] loadPrompts called but user is not authenticated (Ref check @ start). Aborting load.');
       setRawPrompts([]); // 确保清空
       setLoading(false);
       setError(null);
       return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: Prompt[];

      if (isInExtension) {
        // TODO: Consider adding AbortSignal or similar mechanism if storageService.getAllPrompts can be long-running
        data = await storageService.getAllPrompts();
      } else {
         // TODO: Consider adding AbortSignal or similar mechanism if sendMessage can be long-running
        data = await sendMessage<void, Prompt[]>({ type: 'GET_PROMPTS' });
      }

      // Check 2: Right before setting the state with loaded data
      if (isAuthenticatedRef.current) {
        safeLogger.log(`[usePromptsData] loadPrompts completed and user still authenticated (Ref check @ end). Setting ${data.length} prompts.`);
        setRawPrompts(data);
      } else {
        safeLogger.log('[usePromptsData] loadPrompts completed BUT user logged out during load. Discarding data and clearing prompts.');
        setRawPrompts([]); // Ensure clear state if logged out during async operation
      }

    } catch (err) {
      // Check auth status before setting error related to loading prompts for a logged-in user
      if (isAuthenticatedRef.current) {
          console.error('加载提示词失败:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
      } else {
           safeLogger.log('[usePromptsData] Error during loadPrompts, but user is logged out. Ignoring error.');
           setError(null); // Clear any previous error
      }
      setRawPrompts([]); // Clear prompts on error regardless
    } finally {
      // Set loading to false regardless of auth state at the end of the attempt
      // The useEffect will handle the loading state based on the actual current auth state if needed
       safeLogger.log(`[usePromptsData] loadPrompts finally block. AuthRef: ${isAuthenticatedRef.current}. Setting loading to false.`);
       setLoading(false);
    }
  }, [isInExtension]); // Dependencies should generally not include Refs that change every render
  
  // 使用 useMemo 创建排序后的提示词列表
  const sortedPrompts = useMemo(() => {
      // console.log(`[usePromptsData] Re-sorting prompts by ${sortCriteria.key} ${sortCriteria.order}`);
      return sortPromptsInternal(rawPrompts, sortCriteria);
  }, [rawPrompts, sortCriteria, sortPromptsInternal]);
  
  // 初始加载和状态变化处理 (重构)
  useEffect(() => {
    // 根据认证状态决定行为
    if (isAuthenticated) {
      safeLogger.log('[usePromptsData] useEffect detected authenticated state.');
      // setLoading(true); // loadPrompts 内部会设置
      loadPrompts();
    } else {
      safeLogger.log('[usePromptsData] useEffect detected NOT authenticated state. Clearing prompts.');
      setRawPrompts([]);
      setLoading(false);
      setError(null);
    }

    // 监听消息用于实时更新等
    const handleMessage = (message: any) => {
      // 使用 Ref 获取最新的认证状态
      const currentAuthStatus = isAuthenticatedRef.current;
      safeLogger.log(`[usePromptsData] handleMessage received: ${message?.type}. Current Auth (Ref): ${currentAuthStatus}`);

      // 只在用户已登录时处理可能改变列表的消息
      if (!currentAuthStatus) {
        safeLogger.log(`[usePromptsData] Ignoring message ${message?.type} because user is not authenticated (Ref check).`);
        return; // 如果未登录，直接忽略后续处理
      }

      switch (message?.type as MessageType) {
        case 'PROMPT_UPDATED':
          if (message.payload && message.payload.id) {
            safeLogger.log(`[usePromptsData] Processing PROMPT_UPDATED for ID: ${message.payload.id}`);
            setRawPrompts(prev => {
              const existingIndex = prev.findIndex(p => p.id === message.payload.id);
              if (existingIndex > -1) {
                const updatedList = [...prev];
                updatedList[existingIndex] = message.payload as Prompt;
                return updatedList;
              } else {
                // 如果本地没有，且收到更新消息，可能是新同步过来的，添加
                return [...prev, message.payload as Prompt];
              }
            });
          } else {
             safeLogger.warn('[usePromptsData] Received PROMPT_UPDATED without valid payload.');
          }
          break;
        case 'DELETE_PROMPT': // 假设这个消息是由后台确认软删除后发出的，用于同步其他客户端
          if (message.payload && message.payload.id) {
             safeLogger.log(`[usePromptsData] Processing remote DELETE_PROMPT for ID: ${message.payload.id}`);
             setRawPrompts(prev => prev.filter(p => p.id !== message.payload.id));
          } else {
            safeLogger.warn('[usePromptsData] Received DELETE_PROMPT without valid payload ID.');
          }
          break;

        // 不再需要监听 CENTRAL_AUTH_STATE_UPDATED 来驱动加载/清空
        // case 'CENTRAL_AUTH_STATE_UPDATED':
        //   break;

        case 'CENTRAL_MEMBERSHIP_STATE_UPDATED':
          // 确认仍然是登录状态再重新加载
          if (isAuthenticatedRef.current) {
            safeLogger.log('[usePromptsData] Membership state changed (Ref check), reloading prompts...');
            loadPrompts();
          }
          break;
        case 'CLOUD_SYNC_COMPLETED':
           // 确认仍然是登录状态再重新加载
           if (isAuthenticatedRef.current) {
             safeLogger.log('[usePromptsData] Cloud sync completed (Ref check), reloading prompts...');
             loadPrompts();
           }
          break;

        default:
          // 其他消息类型忽略
          break;
      }
    };

    // 添加消息监听器
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
         clearTimeout(debounceTimeoutRef.current);
      }
      if (chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
      // TODO: 如果 loadPrompts 是异步且可取消的，在这里添加取消逻辑
    };
  // 依赖项包含 isAuthenticated 和 loadPrompts
  }, [isAuthenticated, loadPrompts]);
  
  // 添加提示词
  const addPrompt = useCallback(async (data: CreatePromptInput): Promise<Prompt | null> => {
    if (!isAuthenticatedRef.current) {
        safeLogger.warn('[usePromptsData] addPrompt called while not authenticated. Aborting.');
        setError(new Error('User is not authenticated'));
        return null;
    }
    try {
      const now = Date.now();
      // Optimistically create a prompt shape, ID might be confirmed/overwritten by backend response
      const newPromptCandidate: Prompt = {
        id: uuidv4(), 
        title: data.title || '', // Ensure title is string, createPrompt handles empty title by generating one
        content: data.content,
        isFavorite: data.isFavorite !== undefined ? data.isFavorite : true, 
        createdAt: now,
        updatedAt: now,
        useCount: 0,
        lastUsed: 0, 
        tags: data.tags || [],
        source: data.source || 'user',
        category: data.category,
        isActive: true // New prompts are active by default, createPrompt also ensures this
      };
      
      if (isInExtension) {
        // 调用带功能追踪的createPrompt函数
        const createdPrompt = await createPrompt({
          title: data.title,
          content: data.content,
          isFavorite: data.isFavorite,
          tags: data.tags,
          source: data.source,
          category: data.category,
          sourceUrl: data.sourceUrl
        });
        setRawPrompts(prev => [...prev, createdPrompt]);
        return createdPrompt;
      } else {
        // Explicitly define the expected response type
        type BackgroundResponse = {success: boolean, data?: Prompt, error?: string, code?: string};

        const response: BackgroundResponse = await sendMessage<CreatePromptInput, BackgroundResponse>({
          type: 'SAVE_PROMPT_CAPTURE',
          payload: { title: data.title, content: data.content } // Send only what handleSavePromptCapture expects
        });

        if (response && response.success && response.data) {
          setRawPrompts(prev => [...prev.filter(p => p.id !== response.data!.id), response.data!]);
          return response.data!;
        } else {
          const errorMessage = response?.error || 'Failed to save prompt.';
          const errorCode = response?.code;
          safeLogger.error('[usePromptsData] Failed to save prompt via background:', errorMessage, 'Code:', errorCode);
          const err = new Error(errorMessage);
          if (errorCode) {
            (err as any).code = errorCode;
          }
          throw err; 
        }
      }
    } catch (err) {
      console.error('添加提示词失败:', err);
      const finalError = err instanceof Error ? err : new Error(String(err));
      if (!(finalError as any).code && (err as any)?.code) { // Check if finalError.code is not already set
        (finalError as any).code = (err as any).code;
      }
      setError(finalError);
      return null;
    }
  }, [isInExtension, isAuthenticatedRef]);
  
  // 更新提示词
  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>): Promise<boolean> => {
    // 使用 Ref 检查认证状态
    if (!isAuthenticatedRef.current) {
        safeLogger.warn('[usePromptsData] updatePrompt called while not authenticated. Aborting.');
        setError(new Error('User is not authenticated'));
        return false;
    }
    try {
      if (isInExtension) {
        await storageService.updatePrompt(id, updates);
      } else {
        await sendMessage({ 
          type: 'UPDATE_PROMPT', 
          payload: { id, updates } 
        });
      }
      
      setRawPrompts(prev => prev.map(p => 
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      ));
      
      return true;
    } catch (err) {
      console.error('更新提示词失败:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [isInExtension]);
  
  // 删除提示词 (本地发起的操作)
  const deletePrompt = useCallback(async (id: string): Promise<boolean> => {
     // 使用 Ref 检查认证状态
    if (!isAuthenticatedRef.current) {
        safeLogger.warn('[usePromptsData] deletePrompt called while not authenticated. Aborting.');
        setError(new Error('User is not authenticated'));
        return false;
    }
    console.log(`[DEBUG usePromptsData] deletePrompt called for ID: ${id}. isInExtension: ${isInExtension}`);
    try {
      if (isInExtension) {
        console.log(`[DEBUG usePromptsData] Attempting to use storageService:`, storageService);
        await storageService.deletePrompt(id);
        console.log(`[DEBUG usePromptsData] storageService.deletePrompt call completed for ID: ${id}`);
      } else {
        await sendMessage({ 
          type: 'DELETE_PROMPT', 
          payload: id 
        });
      }
      
      setRawPrompts(prev => prev.filter(p => p.id !== id));
      
      return true;
    } catch (err) {
      console.error('删除提示词失败:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [isInExtension]);
  
  // 切换收藏状态
  const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
     // 使用 Ref 检查认证状态
    if (!isAuthenticatedRef.current) {
        safeLogger.warn('[usePromptsData] toggleFavorite called while not authenticated. Aborting.');
        setError(new Error('User is not authenticated'));
        return false;
    }
    try {
      const prompt = rawPrompts.find(p => p.id === id);
      if (!prompt) return false;
      
      const isFavorited = prompt.isFavorite || prompt.favorite;
      
      if (isFavorited) {
        return await deletePrompt(id);
      } else {
        return await updatePrompt(id, { 
          isFavorite: true, 
          favorite: true 
        });
      }
    } catch (err) {
      console.error('切换收藏状态失败:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, [rawPrompts, updatePrompt, deletePrompt]);
  
  // 增加使用次数
  const incrementUseCount = useCallback(async (id: string): Promise<boolean> => {
    // 使用 Ref 检查认证状态 (如果需要限制未登录用户增加次数)
    if (!isAuthenticatedRef.current) {
        safeLogger.warn('[usePromptsData] incrementUseCount called while not authenticated. Aborting.');
        // setError(new Error('User is not authenticated')); // 可能不需要报错，看产品逻辑
        return false;
    }
    try {
      if (isInExtension) {
        await storageService.incrementUseCount(id);
      } else {
        await sendMessage({ 
          type: 'INCREMENT_PROMPT_USE', 
          payload: id 
        });
      }
      
      setRawPrompts(prev => prev.map(p => 
        p.id === id ? { 
          ...p, 
          useCount: (p.useCount || 0) + 1,
          lastUsed: Date.now() 
        } : p
      ));
      
      return true;
    } catch (err) {
      console.error('增加使用次数失败:', err);
      return false;
    }
  }, [isInExtension]);
  
  // 搜索提示词
  const searchPrompts = useCallback(async (filter: PromptFilter): Promise<Prompt[]> => {
    try {
      if (isInExtension) {
        let results = [...sortedPrompts];
        
        if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          results = results.filter(prompt => 
            prompt.title.toLowerCase().includes(term) || 
            prompt.content.toLowerCase().includes(term) ||
            prompt.tags?.some(tag => tag.toLowerCase().includes(term))
          );
        }
        
        if (filter.onlyFavorites || filter.favorite) {
          results = results.filter(prompt => 
            prompt.isFavorite || prompt.favorite
          );
        }
        
        if (filter.category) {
          results = results.filter(prompt => 
            prompt.category === filter.category
          );
        }
        
        if (filter.tags && filter.tags.length > 0) {
          results = results.filter(prompt => 
            prompt.tags?.some(tag => filter.tags!.includes(tag))
          );
        }
        
        if (filter.offset && filter.offset > 0) {
          results = results.slice(filter.offset);
        }
        
        if (filter.limit && filter.limit > 0) {
          results = results.slice(0, filter.limit);
        }
        
        return results;
      } else {
        return await sendMessage<PromptFilter, Prompt[]>({ 
          type: 'SEARCH_PROMPTS', 
          payload: filter 
        });
      }
    } catch (err) {
      console.error('搜索提示词失败:', err);
      return [];
    }
  }, [isInExtension, sortedPrompts]);
  
  return {
    prompts: sortedPrompts,
    loading,
    error,
    refresh: loadPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    toggleFavorite,
    incrementUseCount,
    searchPrompts,
    setSortCriteria,
    sortCriteria,
  };
} 