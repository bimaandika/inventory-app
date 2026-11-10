import { query } from '../config/db.js';
import { notFound, forbidden } from '../utils/httpError.js';
import { parseId, requireString } from '../utils/validate.js';

/** GET /api/sites — admin: semua site, crew: hanya site miliknya. */
export async function list(req, res) {
  const isCrew = req.user.role === 'crew';
  const { rows } = await query(
    `SELECT id, name, created_at, updated_at
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
    `SELECT s.id, s.name, s.created_at, s.updated_at,
            (SELECT COUNT(*)::int FROM users  u  WHERE u.site_id  = s.id) AS total_users,
            (SELECT COUNT(*)::int FROM stocks st WHERE st.site_id = s.id) AS total_stocks
       FROM sites s
      WHERE s.id = $1`,
    [id],
  );
  if (!rows[0]) throw notFound('Site tidak ditemukan');
  res.json({ data: rows[0] });
}

/** POST /api/sites (admin) */
export async function create(req, res) {
  const name = requireString(req.body, 'name', { max: 100 });
  const { rows } = await query(
    'INSERT INTO sites (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
    [name],
  );
  res.status(201).json({ message: 'Site berhasil dibuat', data: rows[0] });
}

/** PUT /api/sites/:id (admin) */
export async function update(req, res) {
  const id = parseId(req.params.id);
  const name = requireString(req.body, 'name', { max: 100 });
  const { rows } = await query(
    'UPDATE sites SET name = $1 WHERE id = $2 RETURNING id, name, created_at, updated_at',
    [name, id],
  );
  if (!rows[0]) throw notFound('Site tidak ditemukan');
  res.json({ message: 'Site berhasil diperbarui', data: rows[0] });
}

/** DELETE /api/sites/:id (admin) — gagal (409) jika site masih punya user atau stok. */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const { rowCount } = await query('DELETE FROM sites WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Site tidak ditemukan');
  res.json({ message: 'Site berhasil dihapus' });
}
