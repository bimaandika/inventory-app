const { badRequest } = require('./httpError');

/** Ambil id dan pastikan berupa bilangan bulat positif. */
function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`${label} tidak valid`);
  return id;
}

/** Field wajib berupa teks, tidak kosong. Mengembalikan string yang sudah di-trim. */
function requireString(body, field, { max = 255 } = {}) {
  const value = typeof body?.[field] === 'string' ? body[field].trim() : '';
  if (!value) throw badRequest(`${field} wajib diisi`);
  if (value.length > max) throw badRequest(`${field} maksimal ${max} karakter`);
  return value;
}

/** Field opsional: string ter-trim, atau null jika kosong. */
function optionalString(body, field, { max = 5000 } = {}) {
  const raw = body?.[field];
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw badRequest(`${field} harus berupa teks`);
  const value = raw.trim();
  if (value.length > max) throw badRequest(`${field} maksimal ${max} karakter`);
  return value || null;
}

/** Bilangan bulat >= 0 (misalnya quantity). Kosong → defaultValue. */
function parseNonNegativeInt(value, label, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw badRequest(`${label} harus bilangan bulat >= 0`);
  return n;
}

/** true/false (juga menerima string "true"/"false"). */
function parseBoolean(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw badRequest(`${label} harus true atau false`);
}

/** Pagination dari query string: ?page=1&limit=20 (limit maks 100). */
function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Pesan untuk daftar yang kosong. `data` tetap dikirim sebagai [] supaya
 * frontend selalu bisa membaca response.data tanpa pengecekan tambahan.
 * - filtered : true jika ada pencarian/filter aktif
 */
function emptyMessage({ empty, emptyFiltered }, filtered) {
  return filtered && emptyFiltered ? emptyFiltered : empty;
}

/** Response daftar biasa (tanpa pagination). Menambahkan `message` jika kosong. */
function listResponse(rows, messages, filtered = false) {
  if (rows.length > 0) return { data: rows };
  return { message: emptyMessage(messages, filtered), data: rows };
}

/** Response daftar ber-pagination. Menambahkan `message` jika kosong. */
function paginated(rows, count, { page, limit }, messages, filtered = false) {
  const totalPages = Math.ceil(count / limit);
  const body = { data: rows, meta: { page, limit, total: count, total_pages: totalPages } };
  if (rows.length > 0) return body;

  const message =
    count > 0
      ? `Halaman ${page} kosong; total halaman hanya ${totalPages}`
      : emptyMessage(messages, filtered);
  return { message, ...body };
}

module.exports = {
  parseId,
  requireString,
  optionalString,
  parseNonNegativeInt,
  parseBoolean,
  parsePagination,
  listResponse,
  paginated,
};
