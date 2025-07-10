import admin from './firebase.service';
import axios from 'axios';

/**
 * 认证服务层 - 处理所有Firebase认证相关的业务逻辑
 */

/**
 * 用户注册接口
 */
export interface UserRegistrationData {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * 用户登录接口
 */
export interface UserLoginData {
  email: string;
  password: string;
}

/**
 * Google登录接口
 */
export interface GoogleLoginData {
  accessToken: string;
}

/**
 * Google ID Token 登录接口 (备用方案)
 */
export interface GoogleIdLoginData {
  idToken: string;
}

/**
 * 认证结果接口
 */
export interface AuthResult {
  success: boolean;
  user?: {
    uid: string;
    email: string | undefined;
    displayName: string | undefined;
    photoURL: string | undefined;
    emailVerified: boolean;
    providerData: any[]; // Match the structure from mapFirebaseUser
    lastLoginAt: string | undefined;
    createdAt: string | undefined;
  };
  customToken?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Maps a Firebase Admin SDK UserRecord to our application's User format.
 * This ensures consistency with the frontend's mapFirebaseUser function.
 * @param userRecord The user record from Firebase Admin SDK.
 * @returns A user object in our application's format.
 */
const mapUserRecordToAppUser = (userRecord: admin.auth.UserRecord) => {
  return {
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
    photoURL: userRecord.photoURL,
    emailVerified: userRecord.emailVerified,
    providerData: userRecord.providerData.map(p => ({
      providerId: p.providerId,
      uid: p.uid,
      displayName: p.displayName,
      email: p.email,
      phoneNumber: p.phoneNumber,
      photoURL: p.photoURL,
    })),
    lastLoginAt: userRecord.metadata.lastSignInTime,
    createdAt: userRecord.metadata.creationTime,
  };
};

/**
 * 创建新用户
 * @param userData 用户注册数据
 * @returns 认证结果
 */
export const createUserWithEmailAndPassword = async (userData: UserRegistrationData): Promise<AuthResult> => {
  try {
    const { email, password, displayName } = userData;

    // 使用 Firebase Admin SDK 创建用户
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // 为新用户生成自定义令牌
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      success: true,
      user: mapUserRecordToAppUser(userRecord),
      customToken,
    };
  } catch (error: any) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: getFirebaseErrorMessage(error),
      errorCode: error.code,
    };
  }
};

/**
 * 用户登录（使用Firebase REST API验证密码）
 * 由于Firebase Admin SDK不能直接验证密码，我们需要使用Firebase的REST API
 * @param loginData 用户登录数据
 * @returns 认证结果
 */
export const signInWithEmailAndPassword = async (loginData: UserLoginData): Promise<AuthResult> => {
  try {
    const { email, password } = loginData;

    // 获取Firebase项目的Web API Key
    // 注意：在生产环境中，建议将API Key也放在环境变量中
    const firebaseConfig = await getFirebaseConfig();
    const apiKey = firebaseConfig.apiKey;

    // 使用Firebase REST API进行身份验证
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: getRestApiErrorMessage(data.error),
        errorCode: data.error?.message,
      };
    }

    // 验证成功，获取用户信息
    const userRecord = await admin.auth().getUser(data.localId);
    
    // 生成自定义令牌
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      success: true,
      user: mapUserRecordToAppUser(userRecord),
      customToken,
    };
  } catch (error: any) {
    console.error('Error during login:', error);
    return {
      success: false,
      error: 'Login failed. Please check your credentials.',
      errorCode: error.code || 'UNKNOWN_ERROR',
    };
  }
};

/**
 * 使用 Google Access Token 登录或注册用户 (SSoT重构版本)
 * 重构说明：这是原有signInWithGoogle的增强版本，专门为SSoT流程优化
 * @param loginData 包含 Google Access Token 的数据
 * @returns 认证结果
 */
export const signInWithGoogleForSSoT = async (loginData: GoogleLoginData): Promise<AuthResult> => {
  try {
    const { accessToken } = loginData;

    // 1. 使用 access token 从 Google 获取用户信息
    const googleResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const googleUser = googleResponse.data;
    const { email, name, picture, email_verified } = googleUser;

    if (!email) {
      throw new Error('Google user email not found.');
    }

    let userRecord;
    try {
      // 2. 检查用户是否已存在
      userRecord = await admin.auth().getUserByEmail(email);
      // 可选：如果需要，可以更新用户的 displayName 和 photoURL
      if (userRecord.displayName !== name || userRecord.photoURL !== picture) {
        userRecord = await admin.auth().updateUser(userRecord.uid, {
          displayName: name,
          photoURL: picture,
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // 3. 如果用户不存在，则创建新用户
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: email_verified,
          displayName: name,
          photoURL: picture,
        });
      } else {
        // 其他错误，直接抛出
        throw error;
      }
    }

    // 4. 为用户生成自定义令牌
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      success: true,
      user: mapUserRecordToAppUser(userRecord),
      customToken,
    };
  } catch (error: any) {
    console.error('Error during Google sign-in (SSoT):', error);
    const errorMessage = error.response?.data?.error?.message || getFirebaseErrorMessage(error) || 'Google sign-in failed.';
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code || 'GOOGLE_AUTH_FAILED',
    };
  }
};

/**
 * 使用 Google ID Token 登录或注册用户 (备用方案)
 * 这是推荐的、更安全的服务器端Google登录验证方式
 * @param loginData 包含 Google ID Token 的数据
 * @returns 认证结果
 */
export const signInWithGoogleIdToken = async (loginData: GoogleIdLoginData): Promise<AuthResult> => {
  try {
    const { idToken } = loginData;

    // 1. 使用Firebase Admin SDK验证Google ID Token
    // 这会返回一个解码后的令牌，其中包含用户信息
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture, email_verified } = decodedToken;

    if (!email) {
      throw new Error('Google user email not found in ID token.');
    }

    let userRecord;
    try {
      // 2. 检查用户是否已存在
      userRecord = await admin.auth().getUserByEmail(email);
      // 可选：如果需要，可以更新用户的 displayName 和 photoURL
      if (userRecord.displayName !== name || userRecord.photoURL !== picture) {
        userRecord = await admin.auth().updateUser(userRecord.uid, {
          displayName: name,
          photoURL: picture,
        });
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // 3. 如果用户不存在，则创建新用户
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: email_verified,
          displayName: name,
          photoURL: picture,
        });
      } else {
        // 其他错误，直接抛出
        throw error;
      }
    }

    // 4. 为用户生成自定义令牌
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    return {
      success: true,
      user: mapUserRecordToAppUser(userRecord),
      customToken,
    };
  } catch (error: any) {
    console.error('Error during Google ID token sign-in:', error);
    const errorMessage = getFirebaseErrorMessage(error) || 'Google sign-in with ID token failed.';
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code || 'GOOGLE_AUTH_ID_TOKEN_FAILED',
    };
  }
};

/**
 * 验证自定义令牌
 * @param customToken 自定义令牌
 * @returns 解码后的令牌信息
 */
export const verifyCustomToken = async (customToken: string) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(customToken);
    return { success: true, decodedToken };
  } catch (error) {
    console.error('Error verifying custom token:', error);
    return { success: false, error: 'Invalid token' };
  }
};

/**
 * 获取Firebase配置（包括Web API Key）
 * 从环境变量中获取配置信息
 */
async function getFirebaseConfig() {
  // 从环境变量获取Firebase Web API Key
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  
  if (!apiKey) {
    throw new Error('FIREBASE_WEB_API_KEY environment variable is not set. Please set this in your .env.local file.');
  }

  // 从服务账号JSON中获取项目ID作为验证
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. Please check your .env file.');
  }
  
  const serviceAccount = JSON.parse(serviceAccountJson);
  const projectId = serviceAccount.project_id;
  
  return {
    apiKey,
    projectId,
  };
}

/**
 * 将Firebase错误代码转换为用户友好的错误消息
 */
function getFirebaseErrorMessage(error: any): string {
  switch (error.code) {
    case 'auth/email-already-exists':
      return 'The email address is already in use by another account.';
    case 'auth/invalid-email':
      return 'The email address is not valid.';
    case 'auth/weak-password':
      return 'The password must be at least 6 characters long.';
    case 'auth/user-not-found':
      return 'No user found with this email address.';
    case 'auth/invalid-password':
      return 'The password is invalid.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

/**
 * 将Firebase REST API错误转换为用户友好的错误消息
 */
function getRestApiErrorMessage(error: any): string {
  if (!error || !error.message) {
    return 'An unexpected error occurred.';
  }

  switch (error.message) {
    case 'EMAIL_NOT_FOUND':
      return 'No user found with this email address.';
    case 'INVALID_PASSWORD':
      return 'The password is incorrect.';
    case 'USER_DISABLED':
      return 'This user account has been disabled.';
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      return 'Too many unsuccessful login attempts. Please try again later.';
    default:
      return 'Login failed. Please check your credentials.';
  }
} 