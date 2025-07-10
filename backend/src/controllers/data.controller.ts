import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  getUserProfile,
  setUserProfile,
  deleteUserProfile,
  getUserData,
  addUserData,
  updateUserData,
  deleteUserData,
  UserProfileData
} from '../services/data.service';

/**
 * 数据控制器 - 处理数据相关的HTTP请求
 */

/**
 * 获取用户配置信息
 * GET /api/data/profile
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const result = await getUserProfile(req.user.uid);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.data,
        message: 'User profile retrieved successfully.'
      });
    } else {
      const statusCode = result.errorCode === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in getProfile controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving profile.'
    });
  }
};

/**
 * 创建或更新用户配置信息
 * PUT /api/data/profile
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const profileData: Partial<UserProfileData> = req.body;

    // 基础验证
    if (!profileData || typeof profileData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid profile data is required.',
        code: 'INVALID_PROFILE_DATA'
      });
    }

    const result = await setUserProfile(req.user.uid, profileData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.data,
        message: 'User profile updated successfully.'
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in updateProfile controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating profile.'
    });
  }
};

/**
 * 删除用户配置信息
 * DELETE /api/data/profile
 */
export const removeProfile = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const result = await deleteUserProfile(req.user.uid);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'User profile deleted successfully.'
      });
    } else {
      const statusCode = result.errorCode === 'PROFILE_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in removeProfile controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting profile.'
    });
  }
};

/**
 * 获取用户数据集合
 * GET /api/data/collections/:collectionName
 */
export const getCollection = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const { collectionName } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // 验证集合名称
    if (!collectionName || typeof collectionName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid collection name is required.',
        code: 'INVALID_COLLECTION_NAME'
      });
    }

    const result = await getUserData(req.user.uid, collectionName, limit);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.data,
        message: `Data from collection '${collectionName}' retrieved successfully.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in getCollection controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving collection data.'
    });
  }
};

/**
 * 添加数据到用户集合
 * POST /api/data/collections/:collectionName
 */
export const addToCollection = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const { collectionName } = req.params;
    const data = req.body;

    // 验证集合名称
    if (!collectionName || typeof collectionName !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid collection name is required.',
        code: 'INVALID_COLLECTION_NAME'
      });
    }

    // 验证数据
    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid data is required.',
        code: 'INVALID_DATA'
      });
    }

    const result = await addUserData(req.user.uid, collectionName, data);

    if (result.success) {
      return res.status(201).json({
        success: true,
        data: result.data,
        message: `Data added to collection '${collectionName}' successfully.`
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in addToCollection controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while adding data to collection.'
    });
  }
};

/**
 * 更新用户集合中的文档
 * PUT /api/data/collections/:collectionName/:documentId
 */
export const updateDocument = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const { collectionName, documentId } = req.params;
    const data = req.body;

    // 验证参数
    if (!collectionName || !documentId) {
      return res.status(400).json({
        success: false,
        error: 'Collection name and document ID are required.',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid data is required.',
        code: 'INVALID_DATA'
      });
    }

    const result = await updateUserData(req.user.uid, collectionName, documentId, data);

    if (result.success) {
      return res.status(200).json({
        success: true,
        data: result.data,
        message: `Document updated in collection '${collectionName}' successfully.`
      });
    } else {
      const statusCode = result.errorCode === 'DOC_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in updateDocument controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while updating document.'
    });
  }
};

/**
 * 删除用户集合中的文档
 * DELETE /api/data/collections/:collectionName/:documentId
 */
export const deleteDocument = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required.',
        code: 'USER_NOT_AUTHENTICATED'
      });
    }

    const { collectionName, documentId } = req.params;

    // 验证参数
    if (!collectionName || !documentId) {
      return res.status(400).json({
        success: false,
        error: 'Collection name and document ID are required.',
        code: 'MISSING_PARAMETERS'
      });
    }

    const result = await deleteUserData(req.user.uid, collectionName, documentId);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Document deleted from collection '${collectionName}' successfully.`
      });
    } else {
      const statusCode = result.errorCode === 'DOC_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.errorCode
      });
    }
  } catch (error: any) {
    console.error('Error in deleteDocument controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while deleting document.'
    });
  }
}; 