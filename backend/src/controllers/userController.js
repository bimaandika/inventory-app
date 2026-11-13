import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { badRequest, notFound, conflict } from '../utils/httpError.js';
import { ROLES } from '../middlewares/auth.js';
import { parseId, requireString, parsePagination } from '../utils/validate.js';

/*
 * Kelola akun pengguna — khusus ADMIN PUSAT.
 *
 * Aturan:
 * - admin_pusat tanpa site; admin (admin site) & crew wajib punya site.
 * - User tidak dihapus, tetapi dinonaktifkan (riwayat transaksinya tetap utuh).
 * - Admin pusat tidak bisa menonaktifkan / mengubah role dirinya sendiri.
 * - Harus selalu ada minimal satu admin pusat yang aktif.
 * - Username tidak bisa diubah setelah dibuat.
 */

const SELECT_USER = `
  SELECT u.id, u.username, u.name, u.role, u.site_id,
         s.name AS site_name, s.code AS site_code,
         u.is_active, u.created_at, u.updated_at
    FROM users u
    LEFT JOIN sites s ON s.id = u.site_id`;

async function findUser(id) {
  const { rows } = await query(`${SELECT_USER} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw notFound('User tidak ditemukan');
  return rows[0];
}

function parseRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (!ROLES.includes(role)) throw badRequest(`role harus salah satu dari: ${ROLES.join(', ')}`);
  return role;
}

/** Validasi kombinasi role + site, kembalikan site_id yang akan disimpan. */
async function resolveSite(role, rawSiteId) {
  if (role === 'admin_pusat') {
    if (rawSiteId !== undefined && rawSiteId !== null && rawSiteId !== '') {
      throw badRequest('Admin pusat tidak terikat ke site; kosongkan site_id');
    }
    return null;
  }
  if (rawSiteId === undefined || rawSiteId === null || rawSiteId === '') {
    throw badRequest('site_id wajib diisi untuk admin site dan crew');
  }
  const siteId = parseId(rawSiteId, 'site_id');
  const { rowCount } = await query('SELECT 1 FROM sites WHERE id = $1', [siteId]);
  if (!rowCount) throw badRequest('site_id tidak ditemukan');
  return siteId;
}

function readPassword(body, field) {
  const password = typeof body?.[field] === 'string' ? body[field] : '';
  if (password.length < 6) throw badRequest(`${field} minimal 6 karakter`);
  return password;
}

/** Pastikan masih ada admin pusat aktif lain selain user ini. */
async function ensureAnotherActivePusat(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM users
      WHERE role = 'admin_pusat' AND is_active AND id <> $1`,
    [userId],
  );
  if (rows[0].total === 0) {
    throw conflict('Harus ada minimal satu admin pusat yang aktif');
  }
}

/** GET /api/users?role=&site_id=&search=&include_inactive=&page=&limit= */
export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const role = req.query.role ? parseRole(req.query.role) : null;
  const siteId = req.query.site_id ? parseId(req.query.site_id, 'site_id') : null;
  const includeInactive = req.query.include_inactive === 'true';

  const where = `
    WHERE ($1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.name ILIKE '%' || $1 || '%')
      AND ($2::user_role IS NULL OR u.role = $2::user_role)
      AND ($3::int IS NULL OR u.site_id = $3::int)
      AND ($4::boolean OR u.is_active)`;
  const params = [search, role, siteId, includeInactive];

  const [items, count] = await Promise.all([
    query(`${SELECT_USER} ${where} ORDER BY u.role, u.name LIMIT $5 OFFSET $6`, [...params, limit, offset]),
    query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, params),
  ]);

  const total = count.rows[0].total;
  res.json({
    data: items.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
}

/** GET /api/users/:id */
export async function detail(req, res) {
  res.json({ data: await findUser(parseId(req.params.id)) });
}

/** POST /api/users — body: { username, name, password, role, site_id } */
export async function create(req, res) {
  const username = requireString(req.body, 'username', { max: 50 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw badRequest('username 3–50 karakter: huruf kecil, angka, titik, garis bawah, atau strip');
  }
  const name = requireString(req.body, 'name', { max: 100 });
  const password = readPassword(req.body, 'password');
  const role = parseRole(req.body?.role);
  const siteId = await resolveSite(role, req.body?.site_id);

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (username, name, password, role, site_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [username, name, hash, role, siteId],
  );
  res.status(201).json({ message: 'User berhasil dibuat', data: await findUser(rows[0].id) });
}

/** PUT /api/users/:id — body: { name, role, site_id } (username & password tidak diubah di sini) */
export async function update(req, res) {
  const id = parseId(req.params.id);
  const current = await findUser(id);
  const name = requireString(req.body, 'name', { max: 100 });
  const role = parseRole(req.body?.role);
  const siteId = await resolveSite(role, req.body?.site_id);

  if (role !== current.role) {
    if (id === req.user.id) throw badRequest('Anda tidak bisa mengubah role akun Anda sendiri');
    if (current.role === 'admin_pusat' && current.is_active) await ensureAnotherActivePusat(id);
  }

  await query('UPDATE users SET name = $1, role = $2, site_id = $3 WHERE id = $4', [name, role, siteId, id]);
  res.json({ message: 'User berhasil diperbarui', data: await findUser(id) });
}

/** PATCH /api/users/:id/password — body: { new_password } (reset oleh admin pusat) */
export async function resetPassword(req, res) {
  const id = parseId(req.params.id);
  await findUser(id);
  const password = readPassword(req.body, 'new_password');
  const hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hash, id]);
  res.json({ message: 'Password berhasil direset' });
}

/** PATCH /api/users/:id/active — body: { is_active: true | false } */
export async function setActive(req, res) {
  const id = parseId(req.params.id);
  const value = req.body?.is_active;
  if (value !== true && value !== false && value !== 'true' && value !== 'false') {
    throw badRequest('is_active harus true atau false');
  }
  const isActive = value === true || value === 'true';
  const current = await findUser(id);

  if (!isActive) {
    if (id === req.user.id) throw badRequest('Anda tidak bisa menonaktifkan akun Anda sendiri');
    if (current.role === 'admin_pusat') await ensureAnotherActivePusat(id);
  }

  await query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, id]);
  res.json({
    message: isActive ? 'User diaktifkan kembali' : 'User dinonaktifkan',
    data: await findUser(id),
  });
}
