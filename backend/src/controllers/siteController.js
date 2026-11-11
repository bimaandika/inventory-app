import { query } from '../config/db.js';
import { badRequest, notFound, forbidden, conflict } from '../utils/httpError.js';
import { parseId, requireString } from '../utils/validate.js';

/*
 * Setiap site punya `code` (misal GMG, POMS, GEG, FOL, TRK) yang dipakai
 * di SKU barang: MEGS-<code>-ET-001. Kode harus unik, huruf besar/angka,
 * maksimal 10 karakter.
 */

const SITE_COLUMNS = 'id, name, code, created_at, updated_at';

function readCode(body) {
  const code = requireString(body, 'code', { max: 10 }).toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(code)) {
    throw badRequest('code hanya boleh huruf dan angka tanpa spasi, maksimal 10 karakter');
  }
  return code;
}

/** GET /api/sites — admin: semua site, crew: hanya site miliknya. */
export async function list(req, res) {
  const isCrew = req.user.role === 'crew';
  const { rows } = await query(
    `SELECT ${SITE_COLUMNS}
       FROM sites
      ${isCrew ? 'WHERE id = $1' : ''}
      ORDER BY name`,
    isCrew ? [req.user.site_id] : [],
  );
  res.json({ data: rows });
}

/** GET /api/sites/:id */
export async function detail(req, res) {
  const id = parseId(req.params.id);
  if (req.user.role === 'crew' && req.user.site_id !== id) {
    throw forbidden('Anda hanya dapat melihat site Anda sendiri');
  }

  const { rows } = await query(
    `SELECT s.id, s.name, s.code, s.created_at, s.updated_at,
            (SELECT COUNT(*)::int FROM users u       WHERE u.site_id = s.id) AS total_users,
            (SELECT COUNT(*)::int FROM inventories i WHERE i.site_id = s.id) AS total_items
       FROM sites s
      WHERE s.id = $1`,
    [id],
  );
  if (!rows[0]) throw notFound('Site tidak ditemukan');
  res.json({ data: rows[0] });
}

/** POST /api/sites (admin) — body: { name, code } */
export async function create(req, res) {
  const name = requireString(req.body, 'name', { max: 100 });
  const code = readCode(req.body);
  const { rows } = await query(
    `INSERT INTO sites (name, code) VALUES ($1, $2) RETURNING ${SITE_COLUMNS}`,
    [name, code],
  );
  res.status(201).json({ message: 'Site berhasil dibuat', data: rows[0] });
}

/**
 * PUT /api/sites/:id (admin) — body: { name, code }
 * Kode site tidak bisa diubah jika sudah dipakai di SKU barang,
 * supaya SKU yang sudah ada tetap konsisten dengan site-nya.
 */
export async function update(req, res) {
  const id = parseId(req.params.id);
  const name = requireString(req.body, 'name', { max: 100 });
  const code = readCode(req.body);

  const current = await query(
    `SELECT s.code, EXISTS (SELECT 1 FROM inventories i WHERE i.site_id = s.id) AS has_items
       FROM sites s WHERE s.id = $1`,
    [id],
  );
  if (!current.rows[0]) throw notFound('Site tidak ditemukan');
  if (current.rows[0].code !== code && current.rows[0].has_items) {
    throw conflict('Kode site tidak bisa diubah karena sudah dipakai di SKU barang');
  }

  const { rows } = await query(
    `UPDATE sites SET name = $1, code = $2 WHERE id = $3 RETURNING ${SITE_COLUMNS}`,
    [name, code, id],
  );
  res.json({ message: 'Site berhasil diperbarui', data: rows[0] });
}

/** DELETE /api/sites/:id (admin) — gagal (409) jika site masih punya user atau barang. */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const { rowCount } = await query('DELETE FROM sites WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Site tidak ditemukan');
  res.json({ message: 'Site berhasil dihapus' });
}
