import { badRequest } from './httpError.js';

/** Ambil :id dari params dan pastikan berupa bilangan bulat positif. */
export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`${label} tidak valid`);
  return id;
}

/** Pastikan field wajib ada dan tidak kosong. Mengembalikan string yang sudah di-trim. */
export function requireString(body, field, { max = 255 } = {}) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (!value) throw badRequest(`${field} wajib diisi`);
  if (value.length > max) throw badRequest(`${field} maksimal ${max} karakter`);
  return value;
}

/** Field opsional: kembalikan string ter-trim, atau null jika kosong. */
export function optionalString(body, field, { max = 5000 } = {}) {
  const raw = body?.[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw badRequest(`${field} harus berupa teks`);
  const value = raw.trim();
  if (value.length > max) throw badRequest(`${field} maksimal ${max} karakter`);
  return value || null;
}

/** Bilangan bulat >= 0 (misalnya quantity). Kosong → defaultValue. */
export function parseNonNegativeInt(value, label, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw badRequest(`${label} harus bilangan bulat >= 0`);
  return n;
}

/**
 * Pagination dari query string: ?page=1&limit=20
 * Batas limit 100 supaya query tidak terlalu berat.
 */
export function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}
