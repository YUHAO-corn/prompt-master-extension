import { Request, Response } from 'express';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithGoogleForSSoT,
  UserRegistrationData, 
  UserLoginData, 
  GoogleLoginData
} from '../services/auth.service';

/**
 * 处理用户注册请求
 * 接收用户凭据，调用认证服务进行处理，并返回响应
 */
export const registerUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, displayName } = req.body;

    // 1. 基础验证
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required.' 
      });
    }

    // 2. 调用认证服务创建用户
    const userData: UserRegistrationData = { email, password, displayName };
    const result = await createUserWithEmailAndPassword(userData);

    // 3. 根据结果返回响应
    if (result.success) {
      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        user: result.user,
        customToken: result.customToken,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
        code: result.errorCode,
      });
    }
  } catch (error: any) {
    console.error('Error in registerUser controller:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error during registration.' 
    });
  }
};

/**
 * 处理用户登录请求
 * 接收用户凭据，验证身份，并返回自定义令牌
 */
export const loginUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    // 1. 基础验证
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required.' 
      });
    }

    // 2. 调用认证服务进行登录
    const loginData: UserLoginData = { email, password };
    const result = await signInWithEmailAndPassword(loginData);

    // 3. 根据结果返回响应
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        user: result.user,
        customToken: result.customToken,
      });
    } else {
      // 根据错误类型返回不同的状态码
      const statusCode = result.errorCode === 'EMAIL_NOT_FOUND' || 
                        result.errorCode === 'INVALID_PASSWORD' ? 401 : 400;
      
      return res.status(statusCode).json({
        success: false,
        error: result.error,
        code: result.errorCode,
      });
    }
  } catch (error: any) {
    console.error('Error in loginUser controller:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error during login.' 
    });
  }
};

/**
 * 处理 Google 登录请求
 * 接收 access token，验证身份，并返回自定义令牌
 */
export const signInWithGoogleController = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { accessToken } = req.body;

    // 1. 基础验证
    if (!accessToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Access token is required.' 
      });
    }

    // 2. 调用认证服务进行 Google 登录
    const loginData: GoogleLoginData = { accessToken };
    const result = await signInWithGoogleForSSoT(loginData);

    // 3. 根据结果返回响应
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Google sign-in successful.',
        user: result.user,
        customToken: result.customToken,
      });
    } else {
      return res.status(401).json({ // 假设Google登录失败主要是授权问题
        success: false,
        error: result.error,
        code: result.errorCode,
      });
    }
  } catch (error: any) {
    console.error('Error in signInWithGoogle controller:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error during Google sign-in.' 
    });
  }
};

// 我们可以在这里添加其他认证相关的控制器函数，
// 例如 `logoutUser`, `resetPassword`, `refreshToken` 等。 