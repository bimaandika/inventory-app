import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import * as ctrl from '../controllers/siteController.js';

const router = Router();

router.use(authenticate);

// Admin & crew
router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));

// Admin pusat saja
router.post('/', authorize('admin_pusat'), asyncHandler(ctrl.create));
router.put('/:id', authorize('admin_pusat'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('admin_pusat'), asyncHandler(ctrl.remove));

export default router;
