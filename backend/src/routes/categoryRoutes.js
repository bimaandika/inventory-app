const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler } = require('../helpers/httpError');
const ctrl = require('../controllers/categoryController');

const router = Router();

router.use(authenticate);

// Admin & crew
router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));

// Admin pusat saja
router.post('/', authorize('admin_pusat'), asyncHandler(ctrl.create));
router.put('/:id', authorize('admin_pusat'), asyncHandler(ctrl.update));
router.delete('/:id', authorize('admin_pusat'), asyncHandler(ctrl.remove));

module.exports = router;
