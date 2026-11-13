import { Router } from 'express';
import authRoutes from './authRoutes.js';
import siteRoutes from './siteRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/sites', siteRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventories', inventoryRoutes);
router.use('/users', userRoutes); // admin pusat

// Route berikut akan ditambahkan bertahap (lihat docs/workflow/):
// router.use('/cart', cartRoutes);
// router.use('/stock-movements', stockMovementRoutes);
// router.use('/histories', historyRoutes);          // admin
// router.use('/dashboard', dashboardRoutes);
// router.use('/reports', reportRoutes);             // admin

export default router;
