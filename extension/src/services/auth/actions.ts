import { 
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged as fbOnAuthStateChanged,
} from 'firebase/auth/web-extension';
import { getFirebaseAuth, mapFirebaseUser } from './firebase';
import { AuthService, LoginInput, RegisterInput, User } from './types';
import { handleSessionEnd } from './sessionManager';
import { safeLogger } from '@/utils/safeEnvironment'; // Import safeLogger

// ADD: Log top-level process.env variables
console.log('[ACTIONS.TS TOP LEVEL] NODE_ENV:', process.env.NODE_ENV);
console.log('[ACTIONS.TS TOP LEVEL] PAYMENT_PAGE_BASE_URL:', process.env.PAYMENT_PAGE_BASE_URL);

// 认证服务实现
export const authService: AuthService = {
  // 用户注册
  async registerUser(input: RegisterInput): Promise<User> {
    console.log('[AuthService] 发起用户注册请求...');
    
    return new Promise((resolve, reject) => {
      // 向后台脚本发送注册请求消息
      chrome.runtime.sendMessage({ 
        type: 'REGISTER_USER',
        payload: input
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AuthService] 注册消息发送失败:', chrome.runtime.lastError);
          return reject(new Error('无法连接到后台服务进行注册: ' + chrome.runtime.lastError.message));
        }

        if (response && response.success) {
          console.log('[AuthService] 注册成功，收到用户信息:', response.user);
          resolve(response.user as User);
        } else {
          const errorMessage = response?.error?.message || '未知错误';
          const errorCode = response?.error?.code;
          console.error(`[AuthService] 注册失败: ${errorMessage}`, response?.error);
          reject(new Error(errorMessage));
        }
      });
    });
  },
  
  // 用户登录
  async loginUser(input: LoginInput): Promise<User> {
    console.log('[AuthService] 发起邮箱登录请求...');
    
    return new Promise((resolve, reject) => {
      // 向后台脚本发送登录请求消息
      chrome.runtime.sendMessage({ 
        type: 'LOGIN_WITH_EMAIL',
        payload: input
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AuthService] 邮箱登录消息发送失败:', chrome.runtime.lastError);
          return reject(new Error('无法连接到后台服务进行登录: ' + chrome.runtime.lastError.message));
        }

        if (response && response.success) {
          console.log('[AuthService] 邮箱登录成功，收到用户信息:', response.user);
          resolve(response.user as User);
        } else {
          const errorMessage = response?.error?.message || '未知错误';
          const errorCode = response?.error?.code;
          console.error(`[AuthService] 邮箱登录失败: ${errorMessage}`, response?.error);
          reject(new Error(errorMessage));
        }
      });
    });
  },
  
  // Google 登录 (重构后)
  async loginWithGoogle(): Promise<User> {
    console.log('[AuthService] 发起 Google 登录请求...');
    
    return new Promise((resolve, reject) => {
      // 向后台脚本发送登录请求消息
      chrome.runtime.sendMessage({ 
        type: 'LOGIN_WITH_GOOGLE'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AuthService] Google 登录消息发送失败:', chrome.runtime.lastError);
          return reject(new Error('无法连接到后台服务进行登录: ' + chrome.runtime.lastError.message));
        }

        if (response && response.success) {
          console.log('[AuthService] Google 登录成功，收到用户信息:', response.user);
          resolve(response.user as User);
        } else {
          const errorMessage = response?.error?.message || '未知错误';
          const errorCode = response?.error?.code;
          console.error(`[AuthService] Google 登录失败: ${errorMessage}`, response?.error);
          // Provide more specific error messages based on code
          if (errorCode === 'auth/credential-already-in-use') {
             reject(new Error('此 Google 账户已关联到其他用户，请尝试使用其他账户登录。'));
          } else if (errorCode === 'auth/account-exists-with-different-credential') {
             reject(new Error('您已使用其他方式（如邮箱）注册过，请先使用该方式登录。')); 
          }
          else {
             reject(new Error(`Google 登录失败: ${errorMessage}`));
          }
        }
      });
    });
  },
  
  // 登出
  async logoutUser(): Promise<void> {
    try {
      // First, tell the background script to perform the Firebase sign out
      // This ensures the central state manager is updated correctly via its listener
      safeLogger.log('[AuthService] Attempting to send LOGOUT message to background...'); // <-- Keep this log
      await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      safeLogger.log('[AuthService] LOGOUT message successfully sent (or at least, no error thrown).'); // <-- Keep this log
      // Add another log AFTER sendMessage completes
      safeLogger.log('[AuthService] Code execution continued immediately after sendMessage call.'); 
      // Optional: Directly call Firebase sign out here as a fallback or primary?
      // For now, rely on background handling it.
      // const auth = getFirebaseAuth();
      // await signOut(auth);
    } catch (error: any) {
      // console.error('登出时发生错误:', error); // Replaced by safeLogger below
      safeLogger.error('[AuthService] Error sending LOGOUT message or during logout process:', error); // <-- Keep this log
      throw error; // Re-throw the error so useAuth can catch it
    }
    safeLogger.log('[AuthService] logoutUser function completed.'); // <-- Add log at the very end
  },
  
  // 获取当前用户
  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const auth = getFirebaseAuth();
      // 尝试获取当前用户，如果存在则直接返回
      if (auth.currentUser) {
        // console.log('[AuthService] getCurrentUser: Found currentUser directly.'); // Commented out verbose log
        resolve(mapFirebaseUser(auth.currentUser));
        return;
      }
      // 如果不存在，则监听一次状态变化
      // console.log('[AuthService] getCurrentUser: No currentUser, subscribing once to onAuthStateChanged.'); // Commented out verbose log
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe(); // 立即取消订阅
        if (user) {
          // console.log('[AuthService] getCurrentUser: Received user from onAuthStateChanged.'); // Commented out verbose log
          resolve(mapFirebaseUser(user));
        } else {
          // console.log('[AuthService] getCurrentUser: Still no user after onAuthStateChanged check.'); // Commented out verbose log
          // 移除从 storage 加载的逻辑
          resolve(null);
        }
      }, (error) => {
        console.error('获取当前用户时 onAuthStateChanged 出错:', error); // Keep error log
        resolve(null); // 出错也返回 null
      });
    });
  },
  
  // 重置密码
  async resetPassword(email: string): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('重置密码失败:', error);
      throw new Error(error.message || '重置密码失败，请重试');
    }
  },
  
  // 删除用户账户
  async deleteAccount(): Promise<void> {
    console.log('[AuthService] 发起删除账户请求...');
    
    return new Promise((resolve, reject) => {
      // 向后台脚本发送删除账户请求消息
      chrome.runtime.sendMessage({ 
        type: 'DELETE_ACCOUNT'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AuthService] 删除账户消息发送失败:', chrome.runtime.lastError);
          return reject(new Error('无法连接到后台服务删除账户: ' + chrome.runtime.lastError.message));
        }

        if (response && response.success) {
          console.log('[AuthService] 账户删除成功');
          resolve();
        } else {
          const errorMessage = response?.error?.message || '未知错误';
          console.error(`[AuthService] 删除账户失败: ${errorMessage}`, response?.error);
          reject(new Error(errorMessage));
        }
      });
    });
  },
  
  // 更新用户资料
  async updateUserProfile(profile: {displayName?: string; photoURL?: string}): Promise<void> {
    console.log('[AuthService] 发起更新用户资料请求...');
    
    return new Promise((resolve, reject) => {
      // 向后台脚本发送更新资料请求消息
      chrome.runtime.sendMessage({ 
        type: 'UPDATE_PROFILE',
        payload: profile
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[AuthService] 更新资料消息发送失败:', chrome.runtime.lastError);
          return reject(new Error('无法连接到后台服务更新资料: ' + chrome.runtime.lastError.message));
        }

        if (response && response.success) {
          console.log('[AuthService] 用户资料更新成功');
          resolve();
        } else {
          const errorMessage = response?.error?.message || '未知错误';
          console.error(`[AuthService] 更新资料失败: ${errorMessage}`, response?.error);
          reject(new Error(errorMessage));
        }
      });
    });
  },
  
  // 观察认证状态变化
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    const auth = getFirebaseAuth();
    let potentialLogoutTimer: ReturnType<typeof setTimeout> | null = null; // 用于延迟处理登出/匿名登录

    const unsubscribe = fbOnAuthStateChanged(auth, (firebaseUser) => {
      // 清除可能存在的登出延迟计时器
      if (potentialLogoutTimer) {
        clearTimeout(potentialLogoutTimer);
        potentialLogoutTimer = null;
      }

      if (firebaseUser) {
        // safeLogger.log('[AuthService] onAuthStateChanged: User found',
        //             firebaseUser.uid,
        //             `isAnonymous: ${firebaseUser.isAnonymous}`); // Reduce verbosity
        const appUser = mapFirebaseUser(firebaseUser);
        // safeLogger.log('[AuthService] onAuthStateChanged: Calling callback with user:', appUser); // Commented out - VERY verbose
        callback(appUser);
      } else {
        // safeLogger.log('[AuthService] onAuthStateChanged: Received null user state. Starting potential logout/anonymous flow...'); // Can be verbose
        // 不要立即回调 null
        // 设置一个短暂的延迟，比如 1 秒，再次检查状态
        potentialLogoutTimer = setTimeout(async () => {
          //  safeLogger.log('[AuthService] Re-checking auth state after delay...'); // Commented out verbose log
           const currentAuth = getFirebaseAuth(); // 获取最新的 Auth 实例
           const latestUser = currentAuth.currentUser;

           if (latestUser) {
            //  safeLogger.log('[AuthService] Auth state recovered after delay. User:', latestUser.uid); // Commented out verbose log
             // User logged in during the delay, do nothing, wait for the next onAuthStateChanged event
           } else {
            //  safeLogger.log('[AuthService] Confirmed user is null after delay. Calling callback with null.'); // Commented out verbose log
             callback(null); // 真正通知 UI 用户已登出

             // 调用会话结束处理函数 (如果需要的话) - Keep this
             handleSessionEnd().catch(error => {
                console.error('处理会话结束时发生错误:', error);
             });
           }
           potentialLogoutTimer = null; // 清理计时器引用
        }, 1000); // 延迟 1 秒，可以根据测试调整

      }
    }, (error: Error) => {
       // 处理错误情况
       if (potentialLogoutTimer) {
         clearTimeout(potentialLogoutTimer);
         potentialLogoutTimer = null;
       }
      safeLogger.error('认证状态观察错误:', error); // Keep error log
      // safeLogger.log('[AuthService] onAuthStateChanged: Calling callback with null due to error.'); // Error implies callback(null)
      callback(null);
    });

    return () => {
      // 组件卸载或服务停止时确保清除计时器
      if (potentialLogoutTimer) {
        clearTimeout(potentialLogoutTimer);
      }
      unsubscribe(); // 调用 Firebase 返回的取消订阅函数
    };
  },
  
  // 检查是否已认证
  isAuthenticated(): boolean {
    const auth = getFirebaseAuth();
    return !!auth.currentUser;
  },

  /**
   * 生成带认证令牌的官网URL
   * 用于从扩展无缝跳转到官网并自动登录
   * @param targetPath 目标页面路径，如 '/pricing.html'
   * @param params 额外的URL参数
   * @returns 包含认证令牌的完整URL
   */
  async generateWebsiteAuthUrl(targetPath: string, params?: Record<string, string>): Promise<string> {
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      
      console.log('[Auth Debug] 开始生成带认证的网站URL，目标路径:', targetPath);

      // Get base URL from environment variable
      const baseUrl = process.env.PAYMENT_PAGE_BASE_URL;
      // ADD: Log the value from env and the baseUrl to be used
      console.log('[Auth Debug] PAYMENT_PAGE_BASE_URL from env:', process.env.PAYMENT_PAGE_BASE_URL);
      console.log('[Auth Debug] Base URL to be used:', baseUrl);

      if (!baseUrl) {
        console.error('PAYMENT_PAGE_BASE_URL not found in environment variables!');
        // Fallback to a default or handle the error appropriately
        // For now, let's throw an error, forcing configuration.
        throw new Error('Missing PAYMENT_PAGE_BASE_URL environment variable.');
      }
      
      if (!currentUser) {
        // If user not logged in, return the base URL with params, no token
        console.warn('[Auth Debug] 用户未登录，无法生成带认证的URL，将跳转普通URL');
        let url = `${baseUrl}${targetPath}`;
        if (params) {
          const urlParams = new URLSearchParams(params);
          url = `${url}?${urlParams.toString()}`;
        }
        console.log('[Auth Debug] 生成的普通URL:', url);
        // ADD: Log the final URL before returning
        console.log('[Auth Debug] Final generated URL (no current user):', url);
        return url;
      }
      
      console.log('[Auth Debug] 用户已登录，UID:', currentUser.uid);
      
      // Get user Firebase ID Token
      console.log('[Auth Debug] 正在获取用户ID Token...');
      const idToken = await currentUser.getIdToken(/* forceRefresh */ true);
      console.log('[Auth Debug] 成功获取ID Token，长度:', idToken.length);
      
      // Construct base URL - use the one from env var
      let url = `${baseUrl}${targetPath}`;
      
      // Construct query parameters
      const urlParams = new URLSearchParams();
      urlParams.set('idToken', idToken); // Use idToken as parameter name
      
      // Add additional parameters
      if (params) {
        console.log('[Auth Debug] 添加额外参数:', Object.keys(params).join(', '));
        Object.entries(params).forEach(([key, value]) => {
          urlParams.set(key, value);
        });
      }
      
      // Combine final URL
      url = `${url}?${urlParams.toString()}`;
      
      // Only record URL without sensitive information (truncate token part)
      const urlForLog = url.replace(/idToken=([^&]{10}).*?(&|$)/, 'idToken=$1...$2');
      console.log('[Auth Debug] 生成的认证URL:', urlForLog);
      // ADD: Log the final URL before returning
      console.log('[Auth Debug] Final generated URL (with current user):', url);
      return url;
    } catch (error: any) {
      console.error('[Auth Debug] 生成认证URL失败:', error);

      // Also use the env var for the fallback URL in case of error
      const baseUrl = process.env.PAYMENT_PAGE_BASE_URL;
      if (!baseUrl) {
         // Handle missing config in fallback as well
         console.error('PAYMENT_PAGE_BASE_URL missing during error fallback!');
         // Return a minimal path or throw
         return targetPath; 
      }

      let url = `${baseUrl}${targetPath}`;
      if (params) {
        const urlParams = new URLSearchParams(params);
        url = `${url}?${urlParams.toString()}`;
      }
      console.log('[Auth Debug] 生成的降级URL:', url);
      // ADD: Log the final URL before returning
      console.log('[Auth Debug] Final generated URL (error fallback):', url);
      return url; 
    }
  },

  // <-- 添加 getIdToken 方法实现 -->
  async getIdToken(forceRefresh: boolean = false): Promise<string | null> {
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken(forceRefresh);
      }
      // 如果用户不存在，返回 null
      console.warn('[AuthService] getIdToken called but no user is logged in.');
      return null;
    } catch (error) {
      console.error('[AuthService] 获取 ID Token 失败:', error);
      // 根据需要决定是返回 null 还是抛出错误
      return null; 
    }
  },
}; 