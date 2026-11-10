import { query } from '../config/db.js';
import { notFound } from '../utils/httpError.js';
import { parseId, requireString } from '../utils/validate.js';

/** GET /api/categories?search= */
export async function list(req, res) {
  const search = (req.query.search || '').trim();
  const { rows } = await query(
    `SELECT c.id, c.name, c.created_at, c.updated_at,
            COUNT(i.id)::int AS total_items
       FROM categories c
       LEFT JOIN inventories i ON i.category_id = c.id
      WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%')
      GROUP BY c.id
      ORDER BY c.name`,
    [search],
  );
  res.json({ data: rows });
}

/** GET /api/categories/:id */
export async function detail(req, res) {
  const id = parseId(req.params.id);
  const { rows } = await query(
    'SELECT id, name, created_at, updated_at FROM categories WHERE id = $1',
    [id],
  );
  if (!rows[0]) throw notFound('Kategori tidak ditemukan');
  res.json({ data: rows[0] });
}

/** POST /api/categories (admin) — nama kategori unik. */
export async function create(req, res) {
  const name = requireString(req.body, 'name', { max: 100 });
  const { rows } = await query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at, updated_at',
    [name],
  );
  res.status(201).json({ message: 'Kategori berhasil dibuat', data: rows[0] });
}

/** PUT /api/categories/:id (admin) */
export async function update(req, res) {
  const id = parseId(req.params.id);
  const name = requireString(req.body, 'name', { max: 100 });
  const { rows } = await query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at, updated_at',
    [name, id],
  );
  if (!rows[0]) throw notFound('Kategori tidak ditemukan');
  res.json({ message: 'Kategori berhasil diperbarui', data: rows[0] });
}

/** DELETE /api/categories/:id (admin) — gagal (409) jika masih dipakai inventory. */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Kategori tidak ditemukan');
  res.json({ message: 'Kategori berhasil dihapus' });
}
