import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.post('/login', asyncHandler(auth.login));
router.get('/me', authenticate, asyncHandler(auth.me));
router.patch('/password', authenticate, asyncHandler(auth.changePassword));

export default router;
