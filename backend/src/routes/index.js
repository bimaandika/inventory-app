import { Router } from 'express';
import authRoutes from './authRoutes.js';
import siteRoutes from './siteRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/sites', siteRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventories', inventoryRoutes);

// Route berikut akan ditambahkan bertahap (lihat docs/API.md):
// router.use('/users', userRoutes);                 // admin
// router.use('/stocks', stockRoutes);
// router.use('/cart', cartRoutes);
// router.use('/stock-movements', stockMovementRoutes);
// router.use('/histories', historyRoutes);          // admin
// router.use('/dashboard', dashboardRoutes);
// router.use('/reports', reportRoutes);             // admin

export default router;
