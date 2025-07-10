import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getProfile,
  updateProfile,
  removeProfile,
  getCollection,
  addToCollection,
  updateDocument,
  deleteDocument
} from '../controllers/data.controller';

const router = Router();

// A wrapper function to handle async controller logic and satisfy Express's type requirements.
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 数据相关路由 - 所有路由都需要身份验证
 */

// =====================================================
// 用户配置相关路由 (User Profile Routes)
// =====================================================

/**
 * 获取用户配置信息
 * GET /api/data/profile
 * 需要身份验证
 */
router.get('/profile', authenticateToken, asyncHandler(getProfile));

/**
 * 创建或更新用户配置信息
 * PUT /api/data/profile
 * 需要身份验证
 * Body: UserProfileData (partial)
 */
router.put('/profile', authenticateToken, asyncHandler(updateProfile));

/**
 * 删除用户配置信息
 * DELETE /api/data/profile
 * 需要身份验证
 */
router.delete('/profile', authenticateToken, asyncHandler(removeProfile));

// =====================================================
// 用户数据集合相关路由 (User Data Collections Routes)
// =====================================================

/**
 * 获取用户数据集合
 * GET /api/data/collections/:collectionName
 * 需要身份验证
 * Query params: limit (optional, default: 50)
 */
router.get('/collections/:collectionName', authenticateToken, asyncHandler(getCollection));

/**
 * 添加数据到用户集合
 * POST /api/data/collections/:collectionName
 * 需要身份验证
 * Body: 要添加的数据对象
 */
router.post('/collections/:collectionName', authenticateToken, asyncHandler(addToCollection));

/**
 * 更新用户集合中的文档
 * PUT /api/data/collections/:collectionName/:documentId
 * 需要身份验证
 * Body: 要更新的数据对象
 */
router.put('/collections/:collectionName/:documentId', authenticateToken, asyncHandler(updateDocument));

/**
 * 删除用户集合中的文档
 * DELETE /api/data/collections/:collectionName/:documentId
 * 需要身份验证
 */
router.delete('/collections/:collectionName/:documentId', authenticateToken, asyncHandler(deleteDocument));

// =====================================================
// 导出路由
// =====================================================

export default router; 