// extension/src/hooks/useQuota.ts
import { useState, useEffect, useCallback } from 'react';
import { safeLogger } from '../utils/safeEnvironment';
import { QUOTA_STATE_UPDATED } from '@/types/centralState';
import { FullQuotaInfo, MembershipQuota as MembershipQuotaLimits } from '@/services/membership/types';
import { authService, User } from '../services/auth'; // Import authService

// --- Define message types for communication with background --- 
const GET_QUOTA_STATE = 'GET_QUOTA_STATE';
const QUOTA_STATE_RESPONSE = 'QUOTA_STATE_RESPONSE';

// Default free limits for potential fallback display, NOT for initial state
const DEFAULT_FREE_LIMITS: MembershipQuotaLimits = {
    maxPrompts: 5,
    dailyOptimizations: 3,
    canExport: false,
    hasPrioritySupport: false,
};

/**
 * Quota 钩子返回值接口
 */
interface UseQuotaReturn {
  quotaInfo: FullQuotaInfo | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Quota 钩子
 * Handles receiving FullQuotaInfo (limits + usage)
 */
export function useQuota(): UseQuotaReturn {
  const [quotaInfo, setQuotaInfo] = useState<FullQuotaInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start loading
  const [error, setError] = useState<Error | null>(null);
  const [initialStateRequested, setInitialStateRequested] = useState(false);

  // Validation function for received payload
  const isValidFullQuotaInfo = (payload: any): payload is FullQuotaInfo => {
    // !! 修改: 允许 limits 中的数字字段为 null (代表 Infinity) !!
    const limits = payload?.limits;
    const usage = payload?.usage;
    return (
      payload && 
      typeof payload === 'object' &&
      limits &&
      typeof limits === 'object' &&
      (typeof limits.maxPrompts === 'number' || limits.maxPrompts === null) && // 允许 null
      (typeof limits.dailyOptimizations === 'number' || limits.dailyOptimizations === null) && // 允许 null
      (usage === null || typeof usage === 'object') 
    );
  };

  // Main useEffect for initial request and listening
  useEffect(() => {
    const isMountedRef = { current: true };
    let requestTimeoutId: NodeJS.Timeout | null = null;

    safeLogger.log('[useQuota] useEffect started. Requesting initial state...');
    setLoading(true); 
    setError(null);
    setInitialStateRequested(false); 
    // Don't set default state here, rely on loading
    setQuotaInfo(null);

    // Request Initial State
    const requestInitialState = async () => {
        if (!isMountedRef.current || initialStateRequested) return;
        try {
            setInitialStateRequested(true);
            safeLogger.log('[useQuota] Sending GET_QUOTA_STATE request to background.');
            // Background now sends FullQuotaInfo
            const response = await chrome.runtime.sendMessage({ type: GET_QUOTA_STATE });

            if (requestTimeoutId) clearTimeout(requestTimeoutId);
            if (!isMountedRef.current) return;

            if (response && response.type === QUOTA_STATE_RESPONSE) {
                safeLogger.log('[useQuota] Received QUOTA_STATE_RESPONSE:', response.payload);
                // !! 修改: Validate and set FullQuotaInfo !!
                if (isValidFullQuotaInfo(response.payload)) {
                    setQuotaInfo(response.payload);
                    setError(null); // Clear previous error on success
                } else {
                    safeLogger.warn('[useQuota] Received invalid initial FullQuotaInfo payload:', response.payload);
                    setQuotaInfo(null); // Set to null on invalid data
                    setError(new Error('Received invalid quota data from background.'));
                }
            } else {
                safeLogger.warn('[useQuota] Received unexpected response or no response for initial state request:', response);
                 // Don't set quota, keep it null. Error might be set by timeout or catch block.
                 if (response?.error) {
                    setError(new Error(`Error fetching initial quota: ${response.error}`));
                 } // else: Timeout will handle setting loading=false
            }
        } catch (err: any) {
            if (!isMountedRef.current) return;
            safeLogger.error('[useQuota] Error requesting initial state:', err);
            setError(err instanceof Error ? err : new Error('Failed to get initial quota state'));
            setQuotaInfo(null); // Ensure state is null on error
        } finally {
             // Only stop loading if the request attempt finished (success, error, or invalid response)
             // Timeout will handle the case where no response comes back at all.
             if (isMountedRef.current && requestTimeoutId) { // Check requestTimeoutId to infer if timeout hasn\'t fired yet
                 setLoading(false);
             }
        }
    };

    requestInitialState();

    // Timeout logic
    requestTimeoutId = setTimeout(() => {
        requestTimeoutId = null; // Clear the ID
        if (isMountedRef.current && loading) {
            safeLogger.warn('[useQuota] Initial state request timed out after 3 seconds.');
            setLoading(false); // Stop loading
            setError(new Error('Quota request timed out'));
            setQuotaInfo(null); // Ensure state is null on timeout
        }
    }, 3000); 

    // Listen for Pushed Updates
    const handleMessage = (message: any, sender: chrome.runtime.MessageSender) => {
      if (!isMountedRef.current) return;

      // Background now pushes FullQuotaInfo
      if (message.type === QUOTA_STATE_UPDATED) {
        safeLogger.log('[useQuota] Processing pushed QUOTA_STATE_UPDATED:', message.payload);
        
        if (requestTimeoutId) clearTimeout(requestTimeoutId); // Clear timeout if update arrives

        // !! 修改: Validate and set FullQuotaInfo !!
        if (isValidFullQuotaInfo(message.payload)) {
          setQuotaInfo(message.payload);
          setError(null); // Clear previous error
        } else {
             safeLogger.warn('[useQuota] Received invalid pushed FullQuotaInfo payload, keeping previous state.', message.payload);
             // Optionally set an error, or just ignore the invalid push
             // setError(new Error('Received invalid quota update.'));
        }
        // Stop loading regardless of validity if an update is received
        setLoading(false); 
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Auth Listener - still relevant, triggers re-request
    const unsubscribeAuth = authService.onAuthStateChanged(async (user: User | null) => {
        if (!isMountedRef.current) return;
        // Differentiate between login and logout
        if (!user) {
             safeLogger.log('[useQuota] Auth state changed to logged out. Resetting local quota state.');
             setLoading(false); // Explicitly set loading false on logout
             setError(null);
             setQuotaInfo(null); // Reset quota info
             // DO NOT request initial state on logout, rely on push if needed (though likely not)
        } else {
             safeLogger.log('[useQuota] Auth state changed to logged in. Resetting and requesting initial quota state.');
            setLoading(true); // Set loading true when auth changes TO LOGGED IN
            setError(null);
            setQuotaInfo(null);
            requestInitialState(); // Re-request quota state ONLY on login
        }
    });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (requestTimeoutId) clearTimeout(requestTimeoutId);
      chrome.runtime.onMessage.removeListener(handleMessage);
      unsubscribeAuth();
    };
  }, []); // Runs once on mount

  return { 
    quotaInfo, // Return the new state variable
    loading,
    error
  };
} 