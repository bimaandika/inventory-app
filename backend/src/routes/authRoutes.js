const { Router } = require('express');
const { authenticate } = require('../middlewares/auth');
const { asyncHandler } = require('../helpers/httpError');
const auth = require('../controllers/authController');

const router = Router();

router.post('/login', asyncHandler(auth.login));
router.get('/me', authenticate, asyncHandler(auth.me));
router.patch('/password', authenticate, asyncHandler(auth.changePassword));

module.exports = router;
