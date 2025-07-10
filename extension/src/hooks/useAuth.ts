import { useState, useEffect, useCallback, useRef } from 'react';
// Import Firebase User type - might not be needed directly here anymore
// import { User as FirebaseUser } from 'firebase/auth/web-extension'; 
import { 
  authService, 
  User as AppUser, // Keep our renamed User type
  LoginInput, 
  RegisterInput,
} from '../services/auth';
// mapFirebaseUser is likely not needed here anymore as actions.ts handles it
// import { mapFirebaseUser } from '@/services/auth/firebase'; 
// Import the message type constant and AuthState using the path alias
import { CENTRAL_AUTH_STATE_UPDATED, AuthState } from '@/types/centralState';
import { safeLogger } from '../utils/safeEnvironment'; // Import safeLogger

// --- Define message types for communication with background ---
const GET_AUTH_STATE = 'GET_AUTH_STATE';
const AUTH_STATE_RESPONSE = 'AUTH_STATE_RESPONSE';
// -------------------------------------------------------------

// 认证钩子类型
export interface UseAuthReturn {
  // 状态
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  loadingMessage: string | null;
  
  // 操作
  login: (input: LoginInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (profile: {displayName?: string; photoURL?: string}) => Promise<void>;
  
  // 检查
  isAuthenticated: boolean;
}

/**
 * 认证钩子，用于管理用户认证状态和提供认证操作
 */
export function useAuth(): UseAuthReturn {
  // 状态管理
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(true); // Internal loading state
  const listenersInitialized = useRef(false); // Ref to track initialization
  const [initialStateRequested, setInitialStateRequested] = useState(false); // Track initial request
  
  // Log Hook mount
  useEffect(() => {
    // safeLogger.log('[useAuth Hook] Mounted.'); // Commented out verbose log
    return () => {
      // safeLogger.log('[useAuth Hook] Unmounted.'); // Commented out verbose log
    };
  }, []);

  // Listen ONLY for central auth state messages
  useEffect(() => {
    const isMountedRef = { current: true }; // Ref to track mount status
    let requestTimeoutId: NodeJS.Timeout | null = null; // Timeout ID

    // --- Initialization Guard --- 
    if (listenersInitialized.current) {
      // safeLogger.warn('[useAuth Effect] Listener already initialized. Skipping setup.'); // Keep warning for potential issues
       return; // Exit if already initialized
    }
    // safeLogger.log('[useAuth Effect] Initializing central message listener (first run)...'); // Commented out verbose log
    listenersInitialized.current = true; // Mark as initialized
    // --- Request Initial State ---
    const requestInitialState = async () => {
        if (!isMountedRef.current || initialStateRequested) return;
        try {
            setInitialStateRequested(true);
            setInternalLoading(true); // Start loading when requesting
            setError(null);
            safeLogger.log('[useAuth] Sending GET_AUTH_STATE request to background.');
            const response = await chrome.runtime.sendMessage({ type: GET_AUTH_STATE });

            // Clear timeout if response received
            if (requestTimeoutId) clearTimeout(requestTimeoutId);

            if (!isMountedRef.current) return; // Check mount status after await

            if (response && response.type === AUTH_STATE_RESPONSE) {
                safeLogger.log('[useAuth] Received AUTH_STATE_RESPONSE:', response.payload);
                const initialState = response.payload as AuthState;
                // Directly use the user object from the payload
                setUser(initialState.user || null);
                setInternalLoading(false);
            } else {
                safeLogger.warn('[useAuth] Received unexpected response or no response for initial state request:', response);
                // Keep loading true, rely on pushed updates or timeout
            }
        } catch (err: any) {
            if (requestTimeoutId) clearTimeout(requestTimeoutId);
            if (!isMountedRef.current) return;
            safeLogger.error('[useAuth] Error requesting initial auth state:', err);
            // Don't set error here, rely on push updates. Keep loading true until timeout.
            // setError(err instanceof Error ? err : new Error('Failed to get initial auth state'));
            // If background script is not ready, sendMessage throws. We'll rely on listener or timeout.
        }
    };

    requestInitialState();

    // Set a timeout: if no state received after X ms, stop loading (rely on push)
    requestTimeoutId = setTimeout(() => {
        if (isMountedRef.current && internalLoading) { // Check internalLoading directly
            safeLogger.warn('[useAuth] Initial state request timed out after 3 seconds. Relying on push updates.');
            setInternalLoading(false); // Stop loading even if no response
        }
    }, 3000); // 3 second timeout
    // ---------------------------

    const handleCentralAuthMessage = async (message: any) => {
      // safeLogger.log('[useAuth Listener] Received message:', message); // Commented out - logs every message

      if (!isMountedRef.current) return; // Check mount status

      if (message && message.type === CENTRAL_AUTH_STATE_UPDATED) {
        console.log('[UI_STATE_UPDATE] 📥 Processing CENTRAL_AUTH_STATE_UPDATED from CentralStateManager'); // Modified log
        safeLogger.log('[useAuth] Processing CENTRAL_AUTH_STATE_UPDATED:', message.payload); // Keep this key log
        
        // Clear timeout if a push update arrives before timeout or response
        if (requestTimeoutId) clearTimeout(requestTimeoutId);
        
        const centralAuthState: AuthState = message.payload; 
        
        setError(null);

        // Directly use the user object from the payload
        setUser(centralAuthState.user || null);
        console.log(`[UI_STATE_UPDATE] ✅ User state updated in useAuth Hook: ${centralAuthState.user ? centralAuthState.user.uid : 'null'}`);
        
        // Set loading to false immediately after processing the message
        setInternalLoading(false);
        console.log('[UI_STATE_UPDATE] 🔄 Loading state set to false after auth update');
        // safeLogger.log('[useAuth] Finished processing CENTRAL_AUTH_STATE_UPDATED (internalLoading=false).'); // Commented out verbose log
      }
      // Note: We don't handle AUTH_STATE_RESPONSE here because it's handled by the async request above.
    };

    chrome.runtime.onMessage.addListener(handleCentralAuthMessage);
    // safeLogger.log('[useAuth] Added message listener for CENTRAL_AUTH_STATE_UPDATED.'); // Commented out verbose log

    return () => {
      isMountedRef.current = false; // Set mount status to false
      if (requestTimeoutId) clearTimeout(requestTimeoutId); // Clear timeout on unmount
      // safeLogger.log('[useAuth Effect Cleanup] Cleaning up message listener...'); // Commented out verbose log
      chrome.runtime.onMessage.removeListener(handleCentralAuthMessage);
      listenersInitialized.current = false; // Reset ref on unmount
      // safeLogger.log('[useAuth Cleanup] Removed message listener and reset initialization flag.'); // Commented out verbose log
    };
  // DO NOT add listenersInitialized.current to dependency array, it's intentional
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
  // Helper function to reset status before an operation
  const resetStatus = () => {
      // setLoading(true); // Temporarily disable action-based loading
      setInternalLoading(true); // Use internal loading for actions too for now
      setError(null);
      setLoadingMessage(null);
      // safeLogger.log('[useAuth Action] Reset status called (internalLoading=true).'); // Commented out verbose log
  };
  
  // Login method
  const login = useCallback(async (input: LoginInput) => {
    resetStatus();
    setLoadingMessage('Logging in...'); // Provide feedback
    try {
      await authService.loginUser(input);
      // User state will be updated by CENTRAL_AUTH_STATE_UPDATED message listener
      setLoadingMessage(null); // <-- 清除加载消息 on success
    } catch (err: any) {
      safeLogger.error('[useAuth Login] loginUser failed:', err); // Keep error log
      setError(err.message || 'Login failed. Please check email and password.');
      setInternalLoading(false); // Stop loading on error
      setLoadingMessage(null);
      throw err; 
    }
    // No finally needed here as success/error paths cover clearing the message
  }, []);
  
  // Google Login method
  const loginWithGoogle = useCallback(async () => {
    console.log('[GOOGLE_LOGIN_FLOW] 🚀 Starting Google login from UI...');
    resetStatus();
    setLoadingMessage('Redirecting to Google...');
    try {
      console.log('[GOOGLE_LOGIN_FLOW] 📞 Calling authService.loginWithGoogle()...');
      await authService.loginWithGoogle();
      console.log('[GOOGLE_LOGIN_FLOW] ✅ authService.loginWithGoogle() completed successfully');
      // User state will be updated by CENTRAL_AUTH_STATE_UPDATED message listener
      setLoadingMessage(null); // <-- 清除加载消息 on success
    } catch (err: any) {
      console.error('[GOOGLE_LOGIN_FLOW] ❌ authService.loginWithGoogle() failed:', err);
      safeLogger.error('[useAuth Google Login] loginWithGoogle failed:', err); // Keep error log
      if (err.message?.includes('trying to log you into your existing Google account')) {
        // Special case: keep a different loading message?
        // setLoadingMessage('Welcome back! Retrieving your records, please wait...');
        // For now, let's clear it for consistency, error state will show.
        setLoadingMessage(null);
      } else {
        setError(err.message || 'Google login failed. Please try again.');
        setLoadingMessage(null); // <-- Make sure it's cleared here too
      }
      // Stop loading only if it's not the special case above (maybe)
      // Let's always stop loading on error for now.
      setInternalLoading(false); // Stop loading on error
      throw err;
    }
    // No finally needed here
  }, []);
  
  // Register method
  const register = useCallback(async (input: RegisterInput) => {
    resetStatus();
    setLoadingMessage('Registering...');
    try {
      await authService.registerUser(input);
      // User state will be updated by CENTRAL_AUTH_STATE_UPDATED message listener
      setLoadingMessage(null); // <-- 清除加载消息 on success
    } catch (err: any) {
      safeLogger.error('[useAuth Register] registerUser failed:', err); // Keep error log
      if (err.message?.includes('trying to log you into your existing account')) {
        // setLoadingMessage('Welcome back! Retrieving your records, please wait...');
        setLoadingMessage(null); // Clear for consistency
      } else {
         setError(err.message || 'Registration failed. Please try again.');
         setLoadingMessage(null); // Clear here too
      }
      setInternalLoading(false); // Stop loading on error
      throw err; 
    }
    // No finally needed
  }, []);
  
  // Logout method
  const logout = async () => {
    // Add log BEFORE calling resetStatus
    safeLogger.log('[useAuth] Entered logout function.'); 
    resetStatus(); // Only resets error and loadingMessage now
    // Add log AFTER calling resetStatus
    safeLogger.log('[useAuth] After resetStatus call.'); 
    setLoadingMessage('Logging out...');
    // Add log BEFORE try block
    safeLogger.log('[useAuth] Preparing to call authService.logoutUser...'); 
    try {
      await authService.logoutUser();
      // Add log AFTER successful call
      safeLogger.log('[useAuth] authService.logoutUser call completed (no error thrown).'); 
      // User state will be updated by CENTRAL_AUTH_STATE_UPDATED message listener
      // safeLogger.log('[useAuth Logout] logoutUser succeeded. Waiting for CENTRAL_AUTH_STATE_UPDATED.'); // Can keep this if needed too
    } catch (err: any) {
      safeLogger.error('[useAuth Logout] logoutUser failed:', err); // Keep error log
      setError(err.message || 'Logout failed.');
      setInternalLoading(false); // Stop loading on error
    } finally {
      // Add log at the beginning of finally
      safeLogger.log('[useAuth] Entered finally block for logout.'); 
      setLoadingMessage(null);
    }
  };
  
  // Reset password method
  const resetPassword = useCallback(async (email: string) => {
    // Consider using internalLoading here too if needed
    setInternalLoading(true);
    setError(null);
    setLoadingMessage('Sending reset link...');
    try {
      await authService.resetPassword(email);
      setLoadingMessage('Reset link sent! Check your email.');
    } catch (err: any) {
      safeLogger.error('Reset password failed:', err);
      setError(err.message || 'Failed to send reset link. Please try again.');
      throw err;
    } finally {
      setInternalLoading(false); // Ensure loading stops
    }
  }, []);
  
  // Update user profile
  const updateProfile = useCallback(async (profile: {displayName?: string; photoURL?: string}) => {
     setInternalLoading(true);
     setError(null);
     setLoadingMessage('Updating profile...');
    try {
      await authService.updateUserProfile(profile);
      // State should update via CENTRAL_AUTH_STATE_UPDATED implicitly if user object changes
      // or fetch after message might get new details.
      setLoadingMessage('Profile updated!');
    } catch (err: any) {
      safeLogger.error('Update profile failed:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
      throw err;
    } finally {
      setInternalLoading(false);
    }
  }, []);
  
  // Loading and error are now internal, use derived loading state for external
  const loading = internalLoading;
  
  // Derived state: isAuthenticated
  // UPDATE: Simplified isAuthenticated logic
  const isAuthenticated = !!user; // Check if user object exists

  return {
    user,
    loading,
    error,
    loadingMessage,
    login,
    loginWithGoogle,
    register,
    logout,
    resetPassword,
    updateProfile,
    isAuthenticated
  };
} 