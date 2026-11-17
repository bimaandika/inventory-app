const { Router } = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const { asyncHandler } = require('../helpers/httpError');
const ctrl = require('../controllers/userController');

const router = Router();

// Seluruh pengelolaan user khusus admin pusat
router.use(authenticate, authorize('admin_pusat'));

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.detail));
router.post('/', asyncHandler(ctrl.create));
router.put('/:id', asyncHandler(ctrl.update));
router.patch('/:id/password', asyncHandler(ctrl.resetPassword));
router.patch('/:id/active', asyncHandler(ctrl.setActive));

module.exports = router;
