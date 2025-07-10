import admin from './firebase.service';

/**
 * 数据服务层 - 处理所有 Firestore 数据库操作
 */

// 获取 Firestore 实例
const db = admin.firestore();

/**
 * 用户配置数据接口
 */
export interface UserProfileData {
  email?: string;
  displayName?: string;
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    notifications?: boolean;
  };
  settings?: {
    [key: string]: any;
  };
  createdAt?: any;
  updatedAt?: any;
}

/**
 * 数据操作结果接口
 */
export interface DataResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * 集合和文档路径常量
 */
export const COLLECTIONS = {
  USERS: 'users',
  USER_PROFILES: 'userProfiles',
  USER_DATA: 'userData'
} as const;

/**
 * 获取用户配置信息
 * @param userId 用户ID
 * @returns 用户配置数据
 */
export const getUserProfile = async (userId: string): Promise<DataResult<UserProfileData>> => {
  try {
    const userProfileRef = db.collection(COLLECTIONS.USER_PROFILES).doc(userId);
    const doc = await userProfileRef.get();

    if (!doc.exists) {
      return {
        success: false,
        error: 'User profile not found.',
        errorCode: 'PROFILE_NOT_FOUND'
      };
    }

    const data = doc.data() as UserProfileData;
    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error('Error getting user profile:', error);
    return {
      success: false,
      error: 'Failed to retrieve user profile.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 创建或更新用户配置信息
 * @param userId 用户ID
 * @param profileData 用户配置数据
 * @returns 操作结果
 */
export const setUserProfile = async (
  userId: string, 
  profileData: Partial<UserProfileData>
): Promise<DataResult<UserProfileData>> => {
  try {
    const userProfileRef = db.collection(COLLECTIONS.USER_PROFILES).doc(userId);
    
    // 检查文档是否存在
    const doc = await userProfileRef.get();
    const isUpdate = doc.exists;
    
    // 准备要保存的数据
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const dataToSave: Partial<UserProfileData> = {
      ...profileData,
      updatedAt: timestamp
    };

    // 如果是新文档，添加创建时间
    if (!isUpdate) {
      dataToSave.createdAt = timestamp;
    }

    // 使用 merge: true 来合并数据而不是覆盖
    await userProfileRef.set(dataToSave, { merge: true });

    // 返回更新后的数据
    const updatedDoc = await userProfileRef.get();
    const updatedData = updatedDoc.data() as UserProfileData;

    return {
      success: true,
      data: updatedData
    };
  } catch (error: any) {
    console.error('Error setting user profile:', error);
    return {
      success: false,
      error: 'Failed to save user profile.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 删除用户配置信息
 * @param userId 用户ID
 * @returns 操作结果
 */
export const deleteUserProfile = async (userId: string): Promise<DataResult<null>> => {
  try {
    const userProfileRef = db.collection(COLLECTIONS.USER_PROFILES).doc(userId);
    
    // 检查文档是否存在
    const doc = await userProfileRef.get();
    if (!doc.exists) {
      return {
        success: false,
        error: 'User profile not found.',
        errorCode: 'PROFILE_NOT_FOUND'
      };
    }

    await userProfileRef.delete();

    return {
      success: true,
      data: null
    };
  } catch (error: any) {
    console.error('Error deleting user profile:', error);
    return {
      success: false,
      error: 'Failed to delete user profile.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 获取用户的所有数据集合
 * @param userId 用户ID
 * @param collectionName 集合名称
 * @param limit 限制返回的数据条数
 * @returns 数据列表
 */
export const getUserData = async (
  userId: string,
  collectionName: string = 'userData',
  limit: number = 50
): Promise<DataResult<any[]>> => {
  try {
    const userDataRef = db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(collectionName)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snapshot = await userDataRef.get();
    
    if (snapshot.empty) {
      return {
        success: true,
        data: []
      };
    }

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error('Error getting user data:', error);
    return {
      success: false,
      error: 'Failed to retrieve user data.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 添加用户数据到指定集合
 * @param userId 用户ID
 * @param collectionName 集合名称
 * @param data 要添加的数据
 * @returns 操作结果
 */
export const addUserData = async (
  userId: string,
  collectionName: string,
  data: any
): Promise<DataResult<{ id: string; data: any }>> => {
  try {
    const userDataRef = db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(collectionName);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const dataToSave = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const docRef = await userDataRef.add(dataToSave);

    return {
      success: true,
      data: {
        id: docRef.id,
        data: dataToSave
      }
    };
  } catch (error: any) {
    console.error('Error adding user data:', error);
    return {
      success: false,
      error: 'Failed to add user data.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 更新用户数据
 * @param userId 用户ID
 * @param collectionName 集合名称
 * @param documentId 文档ID
 * @param data 要更新的数据
 * @returns 操作结果
 */
export const updateUserData = async (
  userId: string,
  collectionName: string,
  documentId: string,
  data: any
): Promise<DataResult<any>> => {
  try {
    const docRef = db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(collectionName)
      .doc(documentId);

    // 检查文档是否存在
    const doc = await docRef.get();
    if (!doc.exists) {
      return {
        success: false,
        error: 'Document not found.',
        errorCode: 'DOC_NOT_FOUND'
      };
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const dataToUpdate = {
      ...data,
      updatedAt: timestamp
    };

    await docRef.update(dataToUpdate);

    // 返回更新后的数据
    const updatedDoc = await docRef.get();
    const updatedData = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };

    return {
      success: true,
      data: updatedData
    };
  } catch (error: any) {
    console.error('Error updating user data:', error);
    return {
      success: false,
      error: 'Failed to update user data.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
};

/**
 * 删除用户数据
 * @param userId 用户ID
 * @param collectionName 集合名称
 * @param documentId 文档ID
 * @returns 操作结果
 */
export const deleteUserData = async (
  userId: string,
  collectionName: string,
  documentId: string
): Promise<DataResult<null>> => {
  try {
    const docRef = db
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .collection(collectionName)
      .doc(documentId);

    // 检查文档是否存在
    const doc = await docRef.get();
    if (!doc.exists) {
      return {
        success: false,
        error: 'Document not found.',
        errorCode: 'DOC_NOT_FOUND'
      };
    }

    await docRef.delete();

    return {
      success: true,
      data: null
    };
  } catch (error: any) {
    console.error('Error deleting user data:', error);
    return {
      success: false,
      error: 'Failed to delete user data.',
      errorCode: error.code || 'UNKNOWN_ERROR'
    };
  }
}; 