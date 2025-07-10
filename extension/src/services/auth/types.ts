import { User as FirebaseUser } from 'firebase/auth';

/**
 * 认证服务类型定义
 */

// 用户类型
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerData: {
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
  }[];
  lastLoginAt?: string;
  createdAt?: string;
  isPremium?: boolean;
  providerId?: string; // 登录提供商 (e.g., 'google.com', 'password')
}

// 注册输入类型
export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

// 登录输入类型
export interface LoginInput {
  email: string;
  password: string;
}

// 认证状态类型
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

// 认证服务接口
export interface AuthService {
  // 用户注册
  registerUser(input: RegisterInput): Promise<User>;
  
  // 用户登录
  loginUser(input: LoginInput): Promise<User>;
  
  // Google登录
  loginWithGoogle(): Promise<User>;
  
  // 登出
  logoutUser(): Promise<void>;
  
  // 获取当前用户
  getCurrentUser(): Promise<User | null>;
  
  // 重置密码
  resetPassword(email: string): Promise<void>;
  
  // 删除用户账户
  deleteAccount(): Promise<void>;
  
  // 更新用户资料
  updateUserProfile(profile: {displayName?: string; photoURL?: string}): Promise<void>;
  
  // 观察认证状态变化
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  
  // 检查认证状态
  isAuthenticated(): boolean;
  
  // 生成带认证令牌的官网URL
  generateWebsiteAuthUrl(targetPath: string, params?: Record<string, string>): Promise<string>;

  // 获取当前用户的 ID Token
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

// Firebase User 到应用 User 的转换函数类型
export type UserMapper = (firebaseUser: FirebaseUser) => User; 