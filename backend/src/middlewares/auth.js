import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

/*
 * Peran (lihat docs/workflow/peran-hak-akses.md):
 *   admin_pusat — semua site
 *   admin       — admin site, hanya site sendiri
 *   crew        — hanya site sendiri
 */
export const ROLES = ['admin_pusat', 'admin', 'crew'];

/**
 * Verifikasi JWT dari header "Authorization: Bearer <token>",
 * lalu ambil data user terbaru dari database.
 * Dengan begitu perubahan role/site/nonaktif langsung berlaku
 * tanpa menunggu token kedaluwarsa.
 *
 * Hasil: req.user = { id, username, name, role, site_id }
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Token tidak ditemukan'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(unauthorized('Token tidak valid atau kedaluwarsa'));
  }

  try {
    const { rows } = await query(
      'SELECT id, username, name, role, site_id, is_active FROM users WHERE id = $1',
      [payload.id],
    );
    const user = rows[0];
    if (!user) return next(unauthorized('Akun tidak ditemukan'));
    if (!user.is_active) return next(unauthorized('Akun Anda sudah dinonaktifkan'));

    const { is_active: _active, ...safeUser } = user;
    req.user = safeUser;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Batasi route berdasarkan role.
 * Contoh: router.post('/', authorize('admin_pusat'), handler)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('Anda tidak memiliki akses ke fitur ini'));
    }
    return next();
  };
}

/** Admin pusat: bisa bertindak di semua site. */
export const isPusat = (user) => user?.role === 'admin_pusat';

/**
 * Site yang boleh DILIHAT user.
 * - crew          : hanya site sendiri
 * - admin & pusat : semua site
 */
export function canViewSite(user, siteId) {
  return user.role !== 'crew' || user.site_id === siteId;
}

/**
 * Site tempat user boleh BERTINDAK (membuat/mengubah data).
 * - admin pusat : semua site
 * - admin/crew  : hanya site sendiri
 */
export function canActOnSite(user, siteId) {
  return isPusat(user) || user.site_id === siteId;
}

/** Lempar 403 jika user tidak boleh bertindak di site tersebut. */
export function assertCanActOnSite(user, siteId, message) {
  if (!canActOnSite(user, siteId)) {
    throw forbidden(message || 'Anda hanya dapat mengelola data di site Anda sendiri');
  }
}
