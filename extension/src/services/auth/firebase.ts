import { 
  initializeApp, 
  getApps, 
  getApp 
} from 'firebase/app';
import { 
  initializeAuth, 
  indexedDBLocalPersistence, 
  onAuthStateChanged as fbOnAuthStateChanged
} from 'firebase/auth/web-extension';
// Remove the direct import of local config
// import { firebaseConfig } from './firebaseConfig'; 
import { User } from './types';

// Get Firebase config from environment variable injected by Webpack
const getFirebaseConfig = () => {
  const configString = process.env.FIREBASE_CONFIG;
  if (!configString) {
    console.error('Firebase config not found in environment variables!');
    // You might want to throw an error or return a default/empty config
    // depending on how critical this is for app startup.
    throw new Error('Missing FIREBASE_CONFIG environment variable.');
  }
  try {
    return JSON.parse(configString);
  } catch (error) {
    console.error('Failed to parse FIREBASE_CONFIG:', error);
    throw new Error('Invalid FIREBASE_CONFIG environment variable format.');
  }
};

// Initialize Firebase application
export const initializeFirebase = () => {
  try {
    if (getApps().length === 0) {
      const configToUse = getFirebaseConfig(); // Get config first
      console.log('[Firebase Init] Using config:', configToUse); // <-- Add this log
      const app = initializeApp(configToUse); // Use the variable
      console.log('Firebase App initialized successfully (web-extension context)');
      return app;
    } else {
      const app = getApp();
      console.log('Firebase App 已初始化，返回现有实例 (web-extension context)');
      return app;
    }
  } catch (error) {
    console.error('Firebase App 初始化错误:', error);
    throw error;
  }
};

// 获取 Firebase Auth 实例
export const getFirebaseAuth = () => {
  const app = getApps().length === 0 ? initializeFirebase() : getApp();
  // 使用 initializeAuth 并传入持久化选项
  return initializeAuth(app, {
    persistence: indexedDBLocalPersistence,
  });
};

// 将 Firebase User 转换为应用 User 对象
export const mapFirebaseUser = (firebaseUser: any): User => {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    providerData: firebaseUser.providerData.map((provider: any) => ({
      providerId: provider.providerId,
      uid: provider.uid,
      displayName: provider.displayName,
      email: provider.email,
      phoneNumber: provider.phoneNumber,
      photoURL: provider.photoURL
    })),
    lastLoginAt: firebaseUser.metadata.lastSignInTime || undefined,
    createdAt: firebaseUser.metadata.creationTime || undefined
  };
}; 