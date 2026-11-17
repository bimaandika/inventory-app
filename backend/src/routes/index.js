const { Router } = require('express');
const authRoutes = require('./authRoutes');
const siteRoutes = require('./siteRoutes');
const categoryRoutes = require('./categoryRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const userRoutes = require('./userRoutes');

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

module.exports = router;
