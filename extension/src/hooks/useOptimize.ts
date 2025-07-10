import { useState, useCallback } from 'react';
import { 
  optimizePrompt, 
  continueOptimize,
  OptimizationMode,
  OptimizationVersion,
  createNextVersionInList,
  createErrorVersion,
  createInitialLoadingVersion,
  createSuccessVersion,
  createContinuedVersion,
  updateVersionInList
} from '../services/optimization';
import { safeLogger } from '../utils/safeEnvironment';
import { CHECK_QUOTA, INCREMENT_USAGE } from '@/types/centralState';
import { useQuota } from './useQuota';
import { useAuth } from './useAuth';
import { generateTitle as generateTitleApi } from '@/services/prompt/doubao-title-generator';

export class QuotaExceededError extends Error {
  limit?: number;
  used?: number;

  constructor(message: string, limit?: number, used?: number) {
    super(message);
    this.name = 'QuotaExceededError';
    this.limit = limit;
    this.used = used;
  }
}

/**
 * 提供提示词优化相关功能的钩子
 */
export function useOptimize() {
  const [optimizeInput, setOptimizeInput] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationVersions, setOptimizationVersions] = useState<OptimizationVersion[]>([]);
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>('standard');
  const [apiError, setApiError] = useState<string | null>(null);
  const { quotaInfo, loading: quotaLoading, error: quotaError } = useQuota();
  const { user } = useAuth();

  const checkOptimizationQuota = useCallback(async (): Promise<boolean> => {
    try {
      safeLogger.log('[useOptimize] Sending CHECK_QUOTA message for optimization.');
      const response = await chrome.runtime.sendMessage({ type: CHECK_QUOTA, payload: { feature: 'optimization' } });
      if (response && typeof response.allowed === 'boolean') {
        safeLogger.log(`[useOptimize] Received quota check response: allowed=${response.allowed}`);
        return response.allowed;
      } else {
        safeLogger.error('[useOptimize] Invalid response received for CHECK_QUOTA:', response);
        return false;
      }
    } catch (error) {
      safeLogger.error('[useOptimize] Failed to send CHECK_QUOTA message:', error);
      return false;
    }
  }, []);

  const incrementOptimizationUsage = useCallback(async () => {
    try {
      safeLogger.log('[useOptimize] Sending INCREMENT_USAGE message for optimization.');
      chrome.runtime.sendMessage({ type: INCREMENT_USAGE, payload: { feature: 'optimization' } })
        .catch(err => safeLogger.error('[useOptimize] Send INCREMENT_USAGE failed (background listener might be inactive):', err));
    } catch (error) {
      safeLogger.error('[useOptimize] Error trying to send INCREMENT_USAGE message:', error);
    }
  }, []);

  const startOptimize = useCallback(async (input: string, mode: OptimizationMode = optimizationMode) => {
    if (!input.trim()) return;

    setIsOptimizing(true);
    setApiError(null);

    try {
      const allowed = await checkOptimizationQuota();
      if (!allowed) {
        safeLogger.warn('[useOptimize] Optimization quota check failed (disallowed by background).');
        let limit: number | string = 'N/A';
        if (!quotaLoading && !quotaError && quotaInfo?.limits) {
             limit = quotaInfo.limits.dailyOptimizations === Infinity ? 'Unlimited' : quotaInfo.limits.dailyOptimizations;
        } else if (quotaLoading) {
             limit = '(loading)';
        }
        const errorMessage = `Daily optimization limit of ${limit} reached. Upgrade for more.`;
        const error = new QuotaExceededError(errorMessage, typeof limit === 'number' ? limit : undefined);
        setApiError(errorMessage);
        throw error;
      }

      setOptimizationVersions([createInitialLoadingVersion()]);

      const currentUserId = user?.uid || null;
      const optimizedContent = await optimizePrompt(input, mode, currentUserId, { isToolbar: false });
      setOptimizationVersions([createSuccessVersion(optimizedContent)]);
      
      await incrementOptimizationUsage();

      return optimizedContent;
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw error;
      } else {
        const errorMessage = error instanceof Error ? error.message : '优化失败，请稍后重试';
        console.error('优化提示词失败:', error);
        setApiError(errorMessage);
        setOptimizationVersions([createErrorVersion(1, errorMessage)]);
        throw error;
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [optimizationMode, checkOptimizationQuota, incrementOptimizationUsage, quotaInfo, quotaLoading, quotaError, user]);

  const continueOptimization = useCallback(async (version: OptimizationVersion, mode: OptimizationMode = optimizationMode) => {
    setIsOptimizing(true);
    setApiError(null);
    
    let newVersionId: number = -1;
    let sourceIndex: number = -1;
    
    try {
      const allowed = await checkOptimizationQuota();
      if (!allowed) {
        safeLogger.warn('[useOptimize] Optimization quota check failed (disallowed by background).');
        let limit: number | string = 'N/A';
        if (!quotaLoading && !quotaError && quotaInfo?.limits) {
             limit = quotaInfo.limits.dailyOptimizations === Infinity ? 'Unlimited' : quotaInfo.limits.dailyOptimizations;
        } else if (quotaLoading) {
             limit = '(loading)';
        }
        const errorMessage = `Daily optimization limit of ${limit} reached. Upgrade for more.`;
        const error = new QuotaExceededError(errorMessage, typeof limit === 'number' ? limit : undefined);
        setApiError(errorMessage);
        throw error;
      }

      const { updatedVersions, newVersionId: assignedNewId, sourceIndex: assignedSourceIndex } = createNextVersionInList(
        optimizationVersions,
        version
      );
      newVersionId = assignedNewId;
      sourceIndex = assignedSourceIndex;
      setOptimizationVersions(updatedVersions);

      const sourceContent = version.editedContent || version.content;
      const currentUserId = user?.uid || null;
      const optimizedContent = await continueOptimize(sourceContent, mode, currentUserId, { isToolbar: false });
      const continuedVersion = createContinuedVersion(optimizedContent, version.id, newVersionId);
      setOptimizationVersions(prev => [
        ...prev.slice(0, sourceIndex + 1),
        continuedVersion,
        ...prev.slice(sourceIndex + 2)
      ]);

      await incrementOptimizationUsage();
      
      return optimizedContent;
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw error;
      } else {
        const errorMessage = error instanceof Error ? error.message : '优化失败，请稍后重试';
        console.error('继续优化提示词失败:', error);
        setApiError(errorMessage);
        if (sourceIndex !== -1 && newVersionId !== -1) {
          const errorVersions = [
            ...optimizationVersions.slice(0, sourceIndex + 1),
            createErrorVersion(newVersionId, errorMessage, version.id),
            ...optimizationVersions.slice(sourceIndex + 2)
          ];
          setOptimizationVersions(errorVersions);
        } else {
          safeLogger.error('[useOptimize] Cannot create error version due to invalid indices.');
        }
        throw error;
      }
    } finally {
      setIsOptimizing(false);
    }
  }, [optimizationVersions, optimizationMode, checkOptimizationQuota, incrementOptimizationUsage, quotaInfo, quotaLoading, quotaError, user]);

  const generateTitle = useCallback(async (content: string): Promise<string> => {
    return generateTitleApi(content);
  }, []);

  const updateVersion = useCallback((versionId: number, updates: Partial<OptimizationVersion>) => {
    setOptimizationVersions(prev => updateVersionInList(prev, versionId, updates));
  }, []);

  return {
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
  };
}

export type { OptimizationMode, OptimizationVersion }; 