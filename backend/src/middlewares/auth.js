const { User } = require('../models');
const { verifyToken } = require('../helpers/jwt');
const { unauthorized, forbidden } = require('../helpers/httpError');

/*
 * Peran (lihat docs/workflow/peran-hak-akses.md):
 *   admin_pusat — semua site
 *   admin       — admin site, hanya site sendiri
 *   crew        — hanya site sendiri
 */
const ROLES = ['admin_pusat', 'admin', 'crew'];

/**
 * Verifikasi JWT dari header "Authorization: Bearer <token>",
 * lalu ambil data user terbaru dari database, sehingga perubahan
 * role/site/nonaktif langsung berlaku tanpa menunggu token kedaluwarsa.
 *
 * Hasil: req.user = { id, username, name, role, siteId }
 */
async function authenticate(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized('Token tidak ditemukan');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw unauthorized('Token tidak valid atau kedaluwarsa');
    }

    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'username', 'name', 'role', 'siteId', 'isActive'],
    });
    if (!user) throw unauthorized('Akun tidak ditemukan');
    if (!user.isActive) throw unauthorized('Akun Anda sudah dinonaktifkan');

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      siteId: user.siteId,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Batasi route berdasarkan role.
 * Contoh: router.post('/', authorize('admin_pusat'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('Anda tidak memiliki akses ke fitur ini'));
    }
    return next();
  };
}

/** Admin pusat: bisa bertindak di semua site. */
const isPusat = (user) => user?.role === 'admin_pusat';

/** Site yang boleh DILIHAT: crew hanya site sendiri; admin & pusat semua site. */
const canViewSite = (user, siteId) => user.role !== 'crew' || user.siteId === siteId;

/** Site tempat user boleh BERTINDAK: pusat semua site; admin/crew hanya site sendiri. */
const canActOnSite = (user, siteId) => isPusat(user) || user.siteId === siteId;

/** Lempar 403 jika user tidak boleh bertindak di site tersebut. */
function assertCanActOnSite(user, siteId, message) {
  if (!canActOnSite(user, siteId)) {
    throw forbidden(message || 'Anda hanya dapat mengelola data di site Anda sendiri');
  }
}

module.exports = {
  ROLES,
  authenticate,
  authorize,
  isPusat,
  canViewSite,
  canActOnSite,
  assertCanActOnSite,
};
