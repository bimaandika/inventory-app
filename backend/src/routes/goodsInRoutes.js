const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler } = require('../helpers/httpError');
const ctrl = require('../controllers/goodsInController');

const router = Router();

// Case 2 — Barang masuk: admin pusat & admin site (admin site hanya site sendiri, dicek di controller)
router.use(authenticate, authorize('admin_pusat', 'admin'));

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));
router.post('/', asyncHandler(ctrl.create));

module.exports = router;
