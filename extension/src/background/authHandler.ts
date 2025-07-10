import { GoogleAuthProvider, signInWithCredential, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile as fbUpdateProfile, deleteUser as fbDeleteUser } from 'firebase/auth/web-extension';
import { getFirebaseAuth, mapFirebaseUser } from '../services/auth/firebase'; // Corrected import path based on file search results
import { User } from '../services/auth/types'; // Import User type if not already present
import { getCentralStateManager } from './index'; // Import the getter for CentralStateManager

// --- Backend API Configuration ---
// This URL will be used for all backend communication.
// For local testing, it points to our local server. For production, it will be the Vercel URL.
const API_BASE_URL = 'https://backend-d1btwoyjw-yuhao-corns-projects.vercel.app/api';

/**
 * Handles the LOGIN_WITH_GOOGLE message by initiating the Google OAuth flow
 * using chrome.identity and signing into Firebase upon success.
 * 
 * @param payload - The message payload (not used in this handler).
 * @param sender - The sender of the message (not used directly here but useful for context).
 * @param sendResponse - Callback function to send the response back to the caller.
 */
export async function handleLoginWithGoogle(
  payload: any, // Keep payload as any for now, or define an empty object if preferred
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[GOOGLE_LOGIN_FLOW] Starting Google login process...');
  
  try {
    // Use chrome.identity API for Google login
    console.log('[GOOGLE_LOGIN_FLOW] Starting Google auth flow via chrome.identity...');
    
    // Get Client ID from environment variable injected by Webpack
    const clientId = process.env.GOOGLE_CLIENT_ID || 'default-client-id';
    if (!clientId || clientId === 'default-client-id') {
      throw new Error('Missing Google Client ID configuration.');
    }
    
    // Specify required scopes
    const scopes = [
      'profile', 
      'email', 
      'https://www.googleapis.com/auth/userinfo.profile', 
      'https://www.googleapis.com/auth/userinfo.email'
    ];
    
    // Build the authentication URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'token'); 
    const redirectUri = chrome.identity.getRedirectURL();
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', scopes.join(' '));
    
    // Launch the web auth flow
    console.log('[GOOGLE_LOGIN_FLOW] Launching Chrome identity web auth flow...');
    chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        console.error('[GOOGLE_LOGIN_FLOW] ❌ Authentication error or cancelled:', chrome.runtime.lastError?.message);
        sendResponse({
          success: false,
          error: {
            code: 'auth/cancelled-or-failed',
            message: chrome.runtime.lastError?.message || 'Authentication process cancelled or failed.'
          }
        });
        return;
      }
      
      // Process the successful response
      try {
        const url = new URL(responseUrl);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get('access_token');
        
        if (!accessToken) {
          throw new Error('Failed to extract access token from the response URL.');
        }
        
        console.log('[GOOGLE_LOGIN_FLOW] ✅ Successfully obtained access token from Google');
        console.log('[BACKEND_PROXY] Calling backend Google login endpoint...');
        
        // --- NEW: Call our backend proxy ---
        const response = await fetch(`${API_BASE_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          console.error('[BACKEND_PROXY] ❌ Backend Google sign-in failed:', data.error);
          throw new Error(data.error || 'Backend Google sign-in failed.');
        }
        // --- END NEW ---

        console.log('[BACKEND_PROXY] ✅ Backend Google sign-in successful for user:', data.user.uid);
        console.log('[CENTRAL_STATE] Updating CentralStateManager with backend user data...');
        
        // Manually notify CentralStateManager about the successful login
        getCentralStateManager().manuallyUpdateAuthState(data.user);

        console.log('[GOOGLE_LOGIN_FLOW] ✅ Google login process completed successfully');
        // TODO: Use the customToken from `data.customToken` to sign into the Firebase client SDK
        // This will be handled in Phase 2 of the refactor.
        // e.g. await signInWithCustomToken(getFirebaseAuth(), data.customToken);

        sendResponse({ success: true, user: data.user });
        
      } catch (error: any) {
        console.error('[GOOGLE_LOGIN_FLOW] ❌ Error processing Google login response:', error);
        sendResponse({
          success: false,
          error: {
            code: 'auth/processing-failed',
            message: error.message || 'Failed to process authentication response.'
          }
        });
      }
    });
    
  } catch (error: any) {
    console.error('[GOOGLE_LOGIN_FLOW] ❌ Error setting up Google login:', error);
    sendResponse({
      success: false,
      error: {
        code: error.code || 'auth/setup-failed',
        message: error.message || 'Failed to setup Google login.'
      }
    });
  }
}

/**
 * Checks the current Firebase authentication state.
 * Responds with the user object if logged in, otherwise indicates no user.
 * 
 * @param payload - The message payload (not used in this handler).
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export function handleCheckAuthState(
  payload: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): void {
  console.log('[Background - authHandler] Received CHECK_AUTH_STATE request (using CentralStateManager)');
  try {
    // NEW LOGIC: Get auth state from CentralStateManager
    const centralStateManager = getCentralStateManager();
    const authState = centralStateManager.getAuthState();

    if (authState.isAuthenticated && authState.user) {
      console.log('[Background - authHandler] User is authenticated via CentralStateManager:', authState.user.uid);
      sendResponse({ success: true, user: authState.user });
    } else {
      console.log('[Background - authHandler] No user is authenticated via CentralStateManager.');
      // We send success: true because the check itself was successful.
      // The user object being null indicates the unauthenticated state.
      sendResponse({ success: true, user: null });
    }
  } catch (error: any) {
    console.error('[Background - authHandler] Error checking auth state via CentralStateManager:', error);
    sendResponse({
      success: false,
      user: null,
      error: {
        code: 'auth/check-state-failed',
        message: error instanceof Error ? error.message : 'Failed to check authentication state.'
      }
    });
  }
}

/**
 * Handles the LOGOUT message by signing the user out of Firebase.
 * 
 * @param payload - The message payload (not used in this handler).
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export async function handleLogout(
  payload: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[Background - authHandler] Received LOGOUT request');
  try {
    const auth = getFirebaseAuth();
    await signOut(auth); // Attempt to sign out from Firebase frontend SDK (for Google Login)
    console.log('[Background - authHandler] Firebase signOut attempted.');

    // Manually update our central state to ensure logout happens for all login types.
    // This is crucial for backend-proxy logins which don't trigger onAuthStateChanged.
    getCentralStateManager().manuallyUpdateAuthState(null);
    console.log('[Background - authHandler] Central state manually cleared for logout.');

    sendResponse({ success: true });
  } catch (error: any) {
    console.error('[Background - authHandler] Error signing out:', error);
    sendResponse({
      success: false,
      error: {
        code: error.code || 'auth/signout-failed',
        message: error.message || 'Failed to sign out.'
      }
    });
  }
  // sendResponse is called asynchronously after signOut completes.
  // The listener in listeners.ts *must* return true for this handler.
}

/**
 * Handles the LOGIN_WITH_EMAIL message by calling the backend proxy.
 *
 * @param payload - The message payload containing email and password.
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export async function handleLoginWithEmail(
  payload: { email: string; password: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[Background - authHandler] Received LOGIN_WITH_EMAIL request (via Backend Proxy)');
  try {
    const { email, password } = payload;

    // Call our backend proxy instead of Firebase directly
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Use the error message from our backend
      throw new Error(data.message || '登录失败，未知错误');
    }

    // Backend returns { success: true, user: {...}, token: '...' }
    // The user object should already be in the correct format.
    console.log('[Background - authHandler] Backend login successful for user:', data.user.uid);
    
    // Manually notify CentralStateManager about the successful login
    getCentralStateManager().manuallyUpdateAuthState(data.user);

    // TODO: Store the `data.token` for subsequent authenticated requests
    sendResponse({ success: true, user: data.user });

  } catch (error: any) {
    console.error('[Background - authHandler] Error during backend login:', error);
    sendResponse({
      success: false,
      error: {
        code: 'auth/proxy-login-failed',
        message: error.message || '登录失败，请检查网络或联系支持'
      }
    });
  }
}

/**
 * Handles the REGISTER_USER message by calling the backend proxy.
 *
 * @param payload - The message payload containing email, password, and displayName.
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export async function handleRegisterUser(
  payload: { email: string; password:string; displayName?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[Background - authHandler] Received REGISTER_USER request (via Backend Proxy)');
  try {
    const { email, password, displayName } = payload;

    // Call our backend proxy to register the user
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, displayName }),
    });

    const data = await response.json();

    if (!response.ok) {
        // Use the error message from our backend
        throw new Error(data.message || '注册失败，未知错误');
    }
    
    // Backend returns { success: true, user: {...}, token: '...' }
    console.log(`[Background - authHandler] Backend registration successful for user ${data.user.uid}`);
    
    // Manually notify CentralStateManager about the successful registration/login
    getCentralStateManager().manuallyUpdateAuthState(data.user);

    // TODO: Store the `data.token` for subsequent authenticated requests
    sendResponse({ success: true, user: data.user });

  } catch (error: any) {
    console.error('[Background - authHandler] Error during backend registration:', error);
    sendResponse({
        success: false,
        error: {
            code: error.code === 'auth/email-already-in-use' ? error.code : 'auth/proxy-registration-failed',
            message: error.message || '注册失败，请重试'
        }
    });
  }
}

/**
 * Handles the DELETE_ACCOUNT message to delete the current user's account.
 * 
 * @param payload - The message payload (not used in this handler).
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export async function handleDeleteAccount(
  payload: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[Background - authHandler] Received DELETE_ACCOUNT request');
  try {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('没有登录的用户');
    }
    
    await fbDeleteUser(currentUser);
    console.log('[Background - authHandler] Account successfully deleted.');
    sendResponse({ success: true });
  } catch (error: any) {
    console.error('[Background - authHandler] Error deleting account:', error);
    sendResponse({
      success: false,
      error: {
        code: error.code || 'auth/delete-failed',
        message: error.message || '删除账户失败，请重试'
      }
    });
  }
}

/**
 * Handles the UPDATE_PROFILE message to update the current user's profile.
 * 
 * @param payload - The message payload containing profile update data.
 * @param sender - The sender of the message.
 * @param sendResponse - Callback function to send the response back.
 */
export async function handleUpdateProfile(
  payload: { displayName?: string; photoURL?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  console.log('[Background - authHandler] Received UPDATE_PROFILE request');
  try {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('没有登录的用户');
    }
    
    await fbUpdateProfile(currentUser, payload);
    console.log('[Background - authHandler] Profile successfully updated.');
    
    // Get updated user
    const updatedUser = auth.currentUser;
    if (!updatedUser) {
      throw new Error("User not found after profile update.");
    }
    
    // Return the updated user
    // const appUser = mapFirebaseUser(updatedUser); // This line was removed as per the new_code
    sendResponse({ success: true, user: updatedUser }); // This line was changed as per the new_code
  } catch (error: any) {
    console.error('[Background - authHandler] Error updating profile:', error);
    sendResponse({
      success: false,
      error: {
        code: error.code || 'auth/update-failed',
        message: error.message || '更新用户资料失败，请重试'
      }
    });
  }
}

// --- Helper Functions (Example - Define or import mapFirebaseUser) ---

/**
 * Maps a Firebase User object to the application's user format.
 * Replace with your actual implementation.
 *
 * @param firebaseUser - The user object from Firebase Authentication.
 * @returns The user object in the application's format.
 */
/*
function mapFirebaseUser(firebaseUser: any): AppUser { // Replace AppUser with your user type
    if (!firebaseUser) {
        return null; // Or handle appropriately
    }
    console.log('[AuthHandler] Mapping Firebase user:', firebaseUser.uid);
    // Example mapping: Adjust according to your AppUser structure
    return {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        // Add any other relevant fields
        emailVerified: firebaseUser.emailVerified,
        providerId: firebaseUser.providerData?.[0]?.providerId || 'unknown',
        // You might want to store the access token or ID token if needed later,
        // but be cautious about storing sensitive tokens persistently.
        // accessToken: firebaseUser.stsTokenManager?.accessToken, // Example, handle securely
        // idToken: await firebaseUser.getIdToken(), // Example, handle securely
    };
}

// Define your application's user type (example)
interface AppUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    providerId: string;
    // other fields...
}
*/
 