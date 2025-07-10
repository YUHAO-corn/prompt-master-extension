import { Request, Response, NextFunction } from 'express';
import admin from '../services/firebase.service';

/**
 * 扩展 Express Request 接口，添加用户信息
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
  };
}

/**
 * 身份验证中间件
 * 验证请求头中的 Authorization 令牌，并将用户信息添加到请求对象中
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. 从请求头获取 Authorization 令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'Authorization header is required.',
        code: 'NO_AUTH_HEADER'
      });
      return;
    }

    // 2. 检查令牌格式：Bearer <token>
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid authorization token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
      return;
    }

    // 3. 验证 Firebase 自定义令牌
    const decodedToken = await admin.auth().verifyIdToken(token);

    // 4. 获取用户详细信息
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    // 5. 将用户信息添加到请求对象中
    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
    };

    // 6. 继续执行下一个中间件或路由处理器
    next();

  } catch (error: any) {
    console.error('Authentication error:', error);

    // 根据错误类型返回相应的错误信息
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        error: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.code === 'auth/id-token-revoked') {
      res.status(401).json({
        success: false,
        error: 'Token has been revoked. Please login again.',
        code: 'TOKEN_REVOKED'
      });
    } else if (error.code === 'auth/invalid-id-token') {
      res.status(401).json({
        success: false,
        error: 'Invalid token. Please login again.',
        code: 'INVALID_TOKEN'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Authentication failed. Please login again.',
        code: 'AUTH_FAILED'
      });
    }
  }
};

/**
 * 可选的身份验证中间件
 * 如果提供了令牌则验证，如果没有提供则继续执行（用于可选认证的端点）
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // 没有提供认证头，继续执行但不设置用户信息
    next();
    return;
  }

  // 如果提供了认证头，则进行验证
  await authenticateToken(req, res, next);
}; 