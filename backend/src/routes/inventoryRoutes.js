import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/httpError.js';
import { inventoryImageUpload } from '../config/upload.js';
import * as ctrl from '../controllers/inventoryController.js';

const router = Router();
const ADMINS = ['admin_pusat', 'admin'];

router.use(authenticate);

// Semua peran (crew dibatasi ke site sendiri di controller)
router.get('/', asyncHandler(ctrl.list));
router.get('/sku/:sku', asyncHandler(ctrl.findBySku)); // harus di atas '/:id'
router.get('/:id', asyncHandler(ctrl.detail));

// Admin pusat & admin site (admin site dibatasi ke site sendiri di controller)
router.post('/', authorize(...ADMINS), asyncHandler(ctrl.create));
router.put('/:id', authorize(...ADMINS), asyncHandler(ctrl.update));
router.patch('/:id/active', authorize(...ADMINS), asyncHandler(ctrl.setActive));
router.delete('/:id', authorize(...ADMINS), asyncHandler(ctrl.remove));

// Foto kondisi barang (form-data, field "image")
router.patch('/:id/image', authorize(...ADMINS), inventoryImageUpload, asyncHandler(ctrl.uploadImage));
router.delete('/:id/image', authorize(...ADMINS), asyncHandler(ctrl.removeImage));

export default router;
