const { Router } = require('express');
const authRoutes = require('./authRoutes');
const siteRoutes = require('./siteRoutes');
const categoryRoutes = require('./categoryRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const userRoutes = require('./userRoutes');
const goodsInRoutes = require('./goodsInRoutes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/sites', siteRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventories', inventoryRoutes);
router.use('/users', userRoutes); // admin pusat
router.use('/goods-in', goodsInRoutes); // Case 2: barang masuk

// Route berikut akan ditambahkan bertahap (lihat docs/workflow/):
// router.use('/cart', cartRoutes);
// router.use('/stock-movements', stockMovementRoutes);
// router.use('/histories', historyRoutes);          // admin
// router.use('/dashboard', dashboardRoutes);
// router.use('/reports', reportRoutes);             // admin

module.exports = router;
