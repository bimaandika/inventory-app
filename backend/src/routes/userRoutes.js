import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import * as ctrl from '../controllers/userController.js';

const router = Router();

// Seluruh pengelolaan user khusus admin pusat
router.use(authenticate, authorize('admin_pusat'));

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.patch('/:id/password', asyncHandler(ctrl.resetPassword));
router.patch('/:id/active', asyncHandler(ctrl.setActive));

export default router;
