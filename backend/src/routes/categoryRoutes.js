import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import * as ctrl from '../controllers/categoryController.js';

const router = Router();

router.use(authenticate);

// Admin & crew
router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));

// Admin saja
router.post('/', authorize('admin'), asyncHandler(ctrl.create));
router.put('/:id', authorize('admin'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('admin'), asyncHandler(ctrl.remove));

export default router;
