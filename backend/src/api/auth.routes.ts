import { Router, Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, signInWithGoogleController } from '../controllers/auth.controller';

const router = Router();

// A wrapper function to handle async controller logic and satisfy Express's type requirements.
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Route for user registration
// When a POST request is made to /api/auth/register, it will be handled by the registerUser controller.
router.post('/register', asyncHandler(registerUser));

// Route for user login
// When a POST request is made to /api/auth/login, it will be handled by the loginUser controller.
router.post('/login', asyncHandler(loginUser));

// Route for Google Sign-In (New SSoT Flow)
// When a POST request is made to /api/auth/google, it will be handled by the signInWithGoogleController.
router.post('/google', asyncHandler(signInWithGoogleController));

// We can add other routes here later, e.g., for logging out.

export default router; 