import { query } from '../config/db.js';
import { badRequest, notFound, forbidden } from '../utils/httpError.js';
import {
  parseId,
  requireString,
  optionalString,
  parseNonNegativeInt,
  parsePagination,
} from '../utils/validate.js';

/*
 * Satu baris inventories = satu barang di satu site.
 * Kolom: name, unit, type, description, category_id, site_id, sku, image, quantity.
 *
 * Aturan:
 * - quantity hanya bisa diisi saat barang dibuat (stok awal).
 *   Perubahan setelahnya lewat stock movement, supaya ada jejak auditnya.
 * - Crew hanya bisa melihat barang di site-nya sendiri.
 */

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
  SELECT i.id, i.name, i.unit, i.type, i.description,
         i.category_id, c.name AS category_name,
         i.site_id, s.name AS site_name,
         i.sku, i.image, i.quantity,
         i.created_at, i.updated_at
    FROM inventories i
    JOIN categories c ON c.id = i.category_id
    JOIN sites s      ON s.id = i.site_id`;

async function ensureExists(table, id, label) {
  const { rowCount } = await query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  if (!rowCount) throw badRequest(`${label} tidak ditemukan`);
}

/** Field yang sama untuk create & update. */
function readBody(body) {
  return {
    name: requireString(body, 'name', { max: 150 }),
    unit: requireString(body, 'unit', { max: 30 }),
    type: parseType(body?.type),
    description: optionalString(body, 'description'),
    category_id: parseId(body?.category_id, 'category_id'),
    site_id: parseId(body?.site_id, 'site_id'),
    sku: requireString(body, 'sku', { max: 50 }).toUpperCase(),
  };
}

/** Crew hanya boleh mengakses barang di site-nya. */
function assertCanView(user, inventory) {
  if (user.role === 'crew' && inventory.site_id !== user.site_id) {
    throw forbidden('Anda hanya dapat melihat barang di site Anda sendiri');
  }
}

/**
 * GET /api/inventories?search=&category_id=&type=&site_id=&page=&limit=
 * - search mencari di nama barang dan SKU
 * - site_id hanya berlaku untuk admin; crew selalu dibatasi ke site-nya
 */
export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const categoryId = req.query.category_id ? parseId(req.query.category_id, 'category_id') : null;
  const type = parseType(req.query.type, { required: false });
  const siteId =
    req.user.role === 'crew'
      ? req.user.site_id
      : req.query.site_id
        ? parseId(req.query.site_id, 'site_id')
        : null;

  const where = `
    WHERE ($1 = '' OR i.name ILIKE '%' || $1 || '%' OR i.sku ILIKE '%' || $1 || '%')
      AND ($2::int IS NULL OR i.category_id = $2::int)
      AND ($3::inventory_type IS NULL OR i.type = $3::inventory_type)
      AND ($4::int IS NULL OR i.site_id = $4::int)`;
  const params = [search, categoryId, type, siteId];

  const [items, count] = await Promise.all([
    query(`${SELECT_INVENTORY} ${where} ORDER BY s.name, i.name LIMIT $5 OFFSET $6`, [
      ...params, limit, offset,
    ]),
    query(`SELECT COUNT(*)::int AS total FROM inventories i ${where}`, params),
  ]);

  const total = count.rows[0].total;
  res.json({
    data: items.rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
}

/** GET /api/inventories/:id */
export async function detail(req, res) {
  const id = parseId(req.params.id);
  const { rows } = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [id]);
  if (!rows[0]) throw notFound('Barang tidak ditemukan');
  assertCanView(req.user, rows[0]);
  res.json({ data: rows[0] });
}

/** GET /api/inventories/sku/:sku — untuk scan barcode/SKU. */
export async function findBySku(req, res) {
  const sku = String(req.params.sku || '').trim().toUpperCase();
  const { rows } = await query(`${SELECT_INVENTORY} WHERE i.sku = $1`, [sku]);
  if (!rows[0]) throw notFound(`Barang dengan SKU ${sku} tidak ditemukan`);
  assertCanView(req.user, rows[0]);
  res.json({ data: rows[0] });
}

/** POST /api/inventories (admin) — quantity opsional sebagai stok awal (default 0). */
export async function create(req, res) {
  const data = readBody(req.body);
  const quantity = parseNonNegativeInt(req.body?.quantity, 'quantity', 0);
  await ensureExists('categories', data.category_id, 'category_id');
  await ensureExists('sites', data.site_id, 'site_id');

  const { rows } = await query(
    `INSERT INTO inventories
       (name, unit, type, description, category_id, site_id, sku, quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [data.name, data.unit, data.type, data.description, data.category_id, data.site_id, data.sku, quantity],
  );
  const created = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [rows[0].id]);
  res.status(201).json({ message: 'Barang berhasil dibuat', data: created.rows[0] });
}

/** PUT /api/inventories/:id (admin) — quantity TIDAK bisa diubah di sini. */
export async function update(req, res) {
  const id = parseId(req.params.id);
  if (req.body?.quantity !== undefined) {
    throw badRequest('quantity tidak bisa diubah lewat endpoint ini; gunakan stock movement');
  }
  const data = readBody(req.body);
  await ensureExists('categories', data.category_id, 'category_id');
  await ensureExists('sites', data.site_id, 'site_id');

  const { rowCount } = await query(
    `UPDATE inventories
        SET name = $1, unit = $2, type = $3, description = $4,
            category_id = $5, site_id = $6, sku = $7
      WHERE id = $8`,
    [data.name, data.unit, data.type, data.description, data.category_id, data.site_id, data.sku, id],
  );
  if (!rowCount) throw notFound('Barang tidak ditemukan');

  const updated = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [id]);
  res.json({ message: 'Barang berhasil diperbarui', data: updated.rows[0] });
}

/** DELETE /api/inventories/:id (admin) — gagal (409) jika barang sudah dipakai di cart. */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const { rowCount } = await query('DELETE FROM inventories WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Barang tidak ditemukan');
  res.json({ message: 'Barang berhasil dihapus' });
}
