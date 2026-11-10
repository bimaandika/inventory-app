import jwt from 'jsonwebtoken';
import { unauthorized, forbidden } from '../utils/httpError.js';

/**
 * Verifikasi JWT dari header "Authorization: Bearer <token>".
 * Payload token: { id, username, role, site_id }
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Token tidak ditemukan'));
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(unauthorized('Token tidak valid atau kedaluwarsa'));
  }
}

/**
 * Batasi route berdasarkan role.
 * Contoh: router.post('/', authenticate, authorize('admin'), handler)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden('Anda tidak memiliki akses ke resource ini'));
    }
    return next();
  };
}

/**
 * Untuk crew: paksa filter site_id dari token, bukan dari query,
 * supaya crew tidak bisa melihat data site lain.
 * Hasilnya tersedia di req.siteScope (null = admin, boleh semua site).
 */
export function scopeSite(req, res, next) {
  if (req.user?.role === 'crew') {
    req.siteScope = req.user.site_id;
  } else {
    req.siteScope = req.query.site_id ? Number(req.query.site_id) : null;
  }
  next();
}
