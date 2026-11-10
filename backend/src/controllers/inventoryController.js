import { query } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { parseId, requireString, optionalString, parsePagination } from '../utils/validate.js';

const INVENTORY_TYPES = ['CONSUMABLE', 'NON_CONSUMABLE'];

function parseType(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`type wajib diisi (${INVENTORY_TYPES.join(' / ')})`);
    return null;
  }
  const type = String(value).trim().toUpperCase();
  if (!INVENTORY_TYPES.includes(type)) {
    throw badRequest(`type harus salah satu dari: ${INVENTORY_TYPES.join(', ')}`);
  }
  return type;
}

const SELECT_INVENTORY = `
  SELECT i.id, i.name, i.unit, i.type, i.description, i.category_id,
         c.name AS category_name, i.created_at, i.updated_at
    FROM inventories i
    JOIN categories c ON c.id = i.category_id`;

async function ensureCategoryExists(categoryId) {
  const { rowCount } = await query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
  if (!rowCount) throw badRequest('category_id tidak ditemukan');
}

function readBody(body) {
  return {
    name: requireString(body, 'name', { max: 150 }),
    unit: requireString(body, 'unit', { max: 30 }),
    type: parseType(body?.type),
    description: optionalString(body, 'description'),
    category_id: parseId(body?.category_id, 'category_id'),
  };
}

/** GET /api/inventories?category_id=&type=&search=&page=&limit= */
export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const categoryId = req.query.category_id ? parseId(req.query.category_id, 'category_id') : null;
  const type = parseType(req.query.type, { required: false });

  const where = `
    WHERE ($1 = '' OR i.name ILIKE '%' || $1 || '%')
      AND ($2::int IS NULL OR i.category_id = $2)
      AND ($3::inventory_type IS NULL OR i.type = $3::inventory_type)`;

  const [items, count] = await Promise.all([
    query(`${SELECT_INVENTORY} ${where} ORDER BY i.name LIMIT $4 OFFSET $5`, [
      search, categoryId, type, limit, offset,
    ]),
    query(`SELECT COUNT(*)::int AS total FROM inventories i ${where}`, [search, categoryId, type]),
  ]);

  const total = count.rows[0].total;
  res.json({
    data: items.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
}

/**
 * GET /api/inventories/:id
 * Termasuk daftar stok barang ini di tiap site (crew hanya melihat site-nya).
 */
export async function detail(req, res) {
  const id = parseId(req.params.id);
  const { rows } = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [id]);
  if (!rows[0]) throw notFound('Barang tidak ditemukan');

  const siteFilter = req.user.role === 'crew' ? req.user.site_id : null;
  const stocks = await query(
    `SELECT st.id, st.sku, st.quantity, st.image, st.site_id, s.name AS site_name
       FROM stocks st
       JOIN sites s ON s.id = st.site_id
      WHERE st.inv_id = $1
        AND ($2::int IS NULL OR st.site_id = $2)
      ORDER BY s.name`,
    [id, siteFilter],
  );

  res.json({ data: { ...rows[0], stocks: stocks.rows } });
}

/** POST /api/inventories (admin) */
export async function create(req, res) {
  const data = readBody(req.body);
  await ensureCategoryExists(data.category_id);

  const { rows } = await query(
    `INSERT INTO inventories (name, unit, type, description, category_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [data.name, data.unit, data.type, data.description, data.category_id],
  );
  const created = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [rows[0].id]);
  res.status(201).json({ message: 'Barang berhasil dibuat', data: created.rows[0] });
}

/** PUT /api/inventories/:id (admin) */
export async function update(req, res) {
  const id = parseId(req.params.id);
  const data = readBody(req.body);
  await ensureCategoryExists(data.category_id);

  const { rowCount } = await query(
    `UPDATE inventories
        SET name = $1, unit = $2, type = $3, description = $4, category_id = $5
      WHERE id = $6`,
    [data.name, data.unit, data.type, data.description, data.category_id, id],
  );
  if (!rowCount) throw notFound('Barang tidak ditemukan');

  const updated = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [id]);
  res.json({ message: 'Barang berhasil diperbarui', data: updated.rows[0] });
}

/** DELETE /api/inventories/:id (admin) — gagal (409) jika barang masih punya stok di site. */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const { rowCount } = await query('DELETE FROM inventories WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Barang tidak ditemukan');
  res.json({ message: 'Barang berhasil dihapus' });
}
