import { useState, useEffect, useCallback } from 'react';
// import { membershipService, MembershipQuota } from '../services/membership'; // Remove direct dependency on membershipService
import { authService, User } from '../services/auth';
import { safeLogger } from '../utils/safeEnvironment';
// Import types and constants using the path alias
import { MembershipState, CENTRAL_MEMBERSHIP_STATE_UPDATED } from '@/types/centralState';
// Import the type, not the instance getter, as this hook relies on messages
// import { getCentralStateManager } from '@/background/index'; 
// Placeholder type for Quota until QuotaService/Hook is integrated
// import { MembershipQuota } from '../services/membership'; // No longer needed here
// Re-import membershipService ONLY for dev tools
import { membershipService } from '../services/membership'; 

// --- Define message types for communication with background --- 
const GET_MEMBERSHIP_STATE = 'GET_MEMBERSHIP_STATE';
const MEMBERSHIP_STATE_RESPONSE = 'MEMBERSHIP_STATE_RESPONSE';
const TRIGGER_MEMBERSHIP_REFRESH = 'TRIGGER_MEMBERSHIP_REFRESH';

/**
 * 会员状态钩子返回值接口
 */
interface UseMembershipReturn {
  // 会员状态
  membershipState: MembershipState;
  // 是否为Pro会员
  isProMember: boolean;
  // 会员权益配额 - REMOVED (use useQuota hook instead)
  // quota: MembershipQuota;
  // 加载状态
  loading: boolean;
  // 错误信息
  error: Error | null;
  // 刷新会员状态
  refresh: () => Promise<void>;
  
  // 开发工具方法(仅开发环境可用)
  _devTools: {
    setProMembership: () => Promise<void>;
    setFreeMembership: () => Promise<void>;
    setExpiringSoon: () => Promise<void>;
  };
}

/**
 * 会员状态钩子
 * 提供会员状态的访问、监听和操作方法
 * 结合主动请求初始状态和监听后台推送更新
 */
export function useMembership(): UseMembershipReturn {
  const [membershipState, setMembershipState] = useState<MembershipState | null>(null);
  const [isProMember, setIsProMember] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true); // Start loading initially
  const [error, setError] = useState<Error | null>(null);
  const [initialStateRequested, setInitialStateRequested] = useState(false);

  // Helper to update derived state (isProMember)
  const updateDerivedState = useCallback((newState: MembershipState | null) => {
    // safeLogger.log('[useMembership] updateDerivedState called with:', newState); // Commented out verbose log
    if (!newState) {
      setIsProMember(false);
      // safeLogger.log('[useMembership] updateDerivedState finished. isProMember: false'); // Commented out verbose log
      return;
    }

    // Calculate isProMember status based on the new state
    const isPro = newState.status === 'pro' && !(newState.expiresAt && newState.expiresAt < Date.now());
    setIsProMember(isPro);
    // safeLogger.log('[useMembership] updateDerivedState finished. isProMember:', isPro); // Commented out verbose log
  }, []);

  // Refresh function (Sends trigger message to background)
  const refresh = useCallback(async () => { 
    safeLogger.warn('[useMembership] Refresh triggered. Sending TRIGGER_MEMBERSHIP_REFRESH message...');
    try {
      // Reset loading state during refresh maybe?
      // setLoading(true); 
      await chrome.runtime.sendMessage({ type: TRIGGER_MEMBERSHIP_REFRESH }); 
    } catch (err: any) {
      safeLogger.error('[useMembership] Failed to send TRIGGER_MEMBERSHIP_REFRESH message:', err);
      setError(err instanceof Error ? err : new Error('Failed to trigger refresh'));
    }
  }, []);

  // 主 useEffect: Handles initial state request and message listening
  useEffect(() => {
    const isMountedRef = { current: true };
    let requestTimeoutId: NodeJS.Timeout | null = null;

    safeLogger.log('[useMembership] useEffect started. Requesting initial state...');
    setLoading(true); // Ensure loading is true on mount/re-mount
    setError(null);
    setInitialStateRequested(false); // Reset request flag

    // --- Request Initial State --- 
    const requestInitialState = async () => {
        if (!isMountedRef.current || initialStateRequested) return;
        try {
            setInitialStateRequested(true);
            safeLogger.log('[useMembership] Sending GET_MEMBERSHIP_STATE request to background.');
            const response = await chrome.runtime.sendMessage({ type: GET_MEMBERSHIP_STATE });
            
            // Clear timeout if response received
            if (requestTimeoutId) clearTimeout(requestTimeoutId);

            if (!isMountedRef.current) return; // Check mount status after await

            if (response && response.type === MEMBERSHIP_STATE_RESPONSE) {
                safeLogger.log('[useMembership] Received MEMBERSHIP_STATE_RESPONSE:', response.payload);
                const initialState = response.payload as MembershipState;
                setMembershipState(initialState);
                updateDerivedState(initialState);
                setLoading(false);
            } else {
                // Handle cases where background might not be ready or returns unexpected response
                safeLogger.warn('[useMembership] Received unexpected response or no response for initial state request:', response);
                // Keep loading true, rely on pushed updates or timeout
            }
        } catch (err: any) {
             if (requestTimeoutId) clearTimeout(requestTimeoutId);
            if (!isMountedRef.current) return;
            safeLogger.error('[useMembership] Error requesting initial state:', err);
            // Keep loading true, rely on pushed updates or timeout. Optionally set error.
            // setError(err instanceof Error ? err : new Error('Failed to get initial state'));
            // If background script is not ready, sendMessage throws. We'll rely on listener.
        }
    };

    requestInitialState();

    // Set a timeout: if no state received after X ms, stop loading (rely on push)
    requestTimeoutId = setTimeout(() => {
        if (isMountedRef.current && loading) {
            safeLogger.warn('[useMembership] Initial state request timed out after 3 seconds. Relying on push updates.');
            setLoading(false); // Stop loading even if no response, fallback to push updates
        }
    }, 3000); // 3 second timeout


    // --- Listen for Pushed Updates from CentralStateManager ---
    const handleMessage = (message: any, sender: chrome.runtime.MessageSender) => {
      // Optional: Ignore messages not from our own extension background
      // if (sender.id !== chrome.runtime.id) return;
      
      if (!isMountedRef.current) {
          return;
      }

      if (message.type === CENTRAL_MEMBERSHIP_STATE_UPDATED) {
        safeLogger.log('[useMembership] Processing pushed CENTRAL_MEMBERSHIP_STATE_UPDATED:', message.payload);
        const newState = message.payload as MembershipState;
        
        // Clear timeout if a push update arrives before timeout
        if (requestTimeoutId) clearTimeout(requestTimeoutId);

          setMembershipState(newState);
          updateDerivedState(newState);
        setLoading(false); // Ensure loading is false after receiving an update
          setError(null);
      }
      // Note: We don't handle MEMBERSHIP_STATE_RESPONSE here because it's handled by the async request above.
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // --- Auth Listener --- (Remains largely the same)
    const unsubscribeAuth = authService.onAuthStateChanged(async (user: User | null) => {
      if (!isMountedRef.current) return;
      if (!user) {
        safeLogger.log('[useMembership] User logged out (auth listener). Resetting local hook state.');
        // Reset local state and re-request initial state for logged-out user
        // 只重置本地状态，不再设置 loading 或重新请求
        setMembershipState(null);
        updateDerivedState(null); 
        // setLoading(true); // <--- Removed this!
        setLoading(false); // <--- Explicitly set loading to false on logout
        setError(null); // Clear error state as well
        // requestInitialState(); // <--- Removed this!
      } else {
        safeLogger.log('[useMembership] User logged in (auth listener). Requesting initial state.');
        // User logged in, state might change, request it.
        setLoading(true);
        setError(null); // Clear error on login before request
        requestInitialState();
      }
    });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (requestTimeoutId) clearTimeout(requestTimeoutId);
      chrome.runtime.onMessage.removeListener(handleMessage);
      unsubscribeAuth();
      // safeLogger.log('[useMembership] Cleaned up useEffect.'); // Commented out verbose log
    };
  }, [updateDerivedState]); // Dependency remains updateDerivedState

  // Developer tools methods (Keep calls to membershipService here)
  const _devTools = {
    setProMembership: async () => {
      try {
        await membershipService._devSetProMembership(); // Keep this call
      } catch (err) {
        console.error('[useMembership] 设置Pro会员状态失败:', err); // Keep error log
      }
    },
    
    setFreeMembership: async () => {
      try {
        await membershipService._devSetFreeMembership(); // Keep this call
      } catch (err) {
        console.error('[useMembership] 设置免费会员状态失败:', err); // Keep error log
      }
    },
    
    setExpiringSoon: async () => {
      try {
        await membershipService._devSetExpiringSoon(); // Keep this call
      } catch (err) {
        console.error('[useMembership] 设置即将到期状态失败:', err); // Keep error log
      }
    }
  };

  // Return the hook's state and functions
  const defaultState: MembershipState = { 
      status: null, plan: null, expiresAt: null, startedAt: null, updatedAt: null,
      subscriptionId: null, subscriptionStatus: null, cancelAtPeriodEnd: null,
      customerId: null, lastVerifiedAt: null, rawDoc: null, isLoading: loading, error: error 
  };

  return { 
    membershipState: membershipState || defaultState,
    isProMember,
    loading,
    error,
    refresh,
    _devTools
  };
} 