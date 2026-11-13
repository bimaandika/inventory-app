import { query, withTransaction } from '../config/db.js';
import { badRequest, notFound, forbidden, conflict } from '../utils/httpError.js';
import { generateSku } from '../services/skuService.js';
import { canViewSite, assertCanActOnSite, isPusat } from '../middlewares/auth.js';
import { inventoryImagePath, removeUploadedFile } from '../config/upload.js';
import {
  parseId,
  requireString,
  optionalString,
  parseNonNegativeInt,
  parsePagination,
} from '../utils/validate.js';

/*
 * Satu baris inventories = satu barang di satu site.
 *
 * Hak akses (docs/workflow/peran-hak-akses.md):
 * - Lihat     : crew hanya site sendiri; admin site & admin pusat semua site
 * - Kelola    : admin pusat semua site; admin site hanya site sendiri; crew tidak bisa
 *
 * Aturan:
 * - SKU dibuat otomatis (services/skuService.js); dibuat ulang jika site/type berubah.
 * - quantity hanya diisi saat barang dibuat (stok awal); selanjutnya lewat stock movement.
 * - Barang yang sudah punya riwayat transaksi tidak bisa dihapus → nonaktifkan.
 * - Barang nonaktif tidak tampil untuk crew; admin bisa melihatnya dengan ?include_inactive=true.
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

function parseBoolean(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw badRequest(`${label} harus true atau false`);
}

const SELECT_INVENTORY = `
  SELECT i.id, i.name, i.unit, i.type, i.description,
         i.category_id, c.name AS category_name,
         i.site_id, s.name AS site_name, s.code AS site_code,
         i.sku, i.image, i.quantity, i.is_active,
         i.created_at, i.updated_at
    FROM inventories i
    JOIN categories c ON c.id = i.category_id
    JOIN sites s      ON s.id = i.site_id`;

async function findInventory(id) {
  const { rows } = await query(`${SELECT_INVENTORY} WHERE i.id = $1`, [id]);
  if (!rows[0]) throw notFound('Barang tidak ditemukan');
  return rows[0];
}

/** Barang boleh dilihat? Crew: site sendiri & aktif saja. */
function assertCanView(user, inventory) {
  if (!canViewSite(user, inventory.site_id) || (user.role === 'crew' && !inventory.is_active)) {
    throw forbidden('Anda hanya dapat melihat barang di site Anda sendiri');
  }
}

async function ensureExists(table, id, label) {
  const { rowCount } = await query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
  if (!rowCount) throw badRequest(`${label} tidak ditemukan`);
}

/** Field yang sama untuk create & update. */
function readBody(body) {
  if (body?.sku !== undefined) {
    throw badRequest('sku dibuat otomatis oleh sistem, tidak perlu dikirim');
  }
  return {
    name: requireString(body, 'name', { max: 150 }),
    unit: requireString(body, 'unit', { max: 30 }),
    type: parseType(body?.type),
    description: optionalString(body, 'description'),
    category_id: parseId(body?.category_id, 'category_id'),
    site_id: parseId(body?.site_id, 'site_id'),
  };
}

/**
 * GET /api/inventories?search=&category_id=&type=&site_id=&include_inactive=&page=&limit=
 * - search mencari di nama barang dan SKU
 * - crew selalu dibatasi ke site-nya dan hanya barang aktif
 */
export async function list(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const categoryId = req.query.category_id ? parseId(req.query.category_id, 'category_id') : null;
  const type = parseType(req.query.type, { required: false });
  const isCrew = req.user.role === 'crew';
  const siteId = isCrew
    ? req.user.site_id
    : req.query.site_id
      ? parseId(req.query.site_id, 'site_id')
      : null;
  const includeInactive = !isCrew && req.query.include_inactive === 'true';

  const where = `
    WHERE ($1 = '' OR i.name ILIKE '%' || $1 || '%' OR i.sku ILIKE '%' || $1 || '%')
      AND ($2::int IS NULL OR i.category_id = $2::int)
      AND ($3::inventory_type IS NULL OR i.type = $3::inventory_type)
      AND ($4::int IS NULL OR i.site_id = $4::int)
      AND ($5::boolean OR i.is_active)`;
  const params = [search, categoryId, type, siteId, includeInactive];

  const [items, count] = await Promise.all([
    query(`${SELECT_INVENTORY} ${where} ORDER BY s.name, i.name LIMIT $6 OFFSET $7`, [
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
  const inventory = await findInventory(parseId(req.params.id));
  assertCanView(req.user, inventory);
  res.json({ data: inventory });
}

/** GET /api/inventories/sku/:sku — untuk scan barcode/SKU. */
export async function findBySku(req, res) {
  const sku = String(req.params.sku || '').trim().toUpperCase();
  const { rows } = await query(`${SELECT_INVENTORY} WHERE i.sku = $1`, [sku]);
  if (!rows[0]) throw notFound(`Barang dengan SKU ${sku} tidak ditemukan`);
  assertCanView(req.user, rows[0]);
  res.json({ data: rows[0] });
}

/** POST /api/inventories (admin pusat, admin site) — quantity opsional sebagai stok awal. */
export async function create(req, res) {
  const data = readBody(req.body);
  const quantity = parseNonNegativeInt(req.body?.quantity, 'quantity', 0);
  assertCanActOnSite(req.user, data.site_id, 'Anda hanya dapat menambah barang di site Anda sendiri');
  await ensureExists('categories', data.category_id, 'category_id');
  await ensureExists('sites', data.site_id, 'site_id');

  const id = await withTransaction(async (client) => {
    const sku = await generateSku(client, data.site_id, data.type);
    const { rows } = await client.query(
      `INSERT INTO inventories
         (name, unit, type, description, category_id, site_id, sku, quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [data.name, data.unit, data.type, data.description, data.category_id, data.site_id, sku, quantity],
    );
    return rows[0].id;
  });

  res.status(201).json({ message: 'Barang berhasil dibuat', data: await findInventory(id) });
}

/**
 * PUT /api/inventories/:id (admin pusat, admin site) — quantity TIDAK bisa diubah di sini.
 * Admin site tidak bisa memindahkan barang ke site lain (gunakan transfer).
 */
export async function update(req, res) {
  const id = parseId(req.params.id);
  if (req.body?.quantity !== undefined) {
    throw badRequest('quantity tidak bisa diubah lewat endpoint ini; gunakan stock movement');
  }
  const data = readBody(req.body);
  await ensureExists('categories', data.category_id, 'category_id');
  await ensureExists('sites', data.site_id, 'site_id');

  await withTransaction(async (client) => {
    const current = await client.query(
      'SELECT site_id, type, sku FROM inventories WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!current.rows[0]) throw notFound('Barang tidak ditemukan');

    const { site_id: oldSite, type: oldType, sku: oldSku } = current.rows[0];
    assertCanActOnSite(req.user, oldSite, 'Anda hanya dapat mengubah barang di site Anda sendiri');
    if (oldSite !== data.site_id && !isPusat(req.user)) {
      throw forbidden('Memindahkan barang ke site lain dilakukan lewat transfer');
    }

    // SKU memuat kode site & jenis, jadi dibuat ulang jika salah satunya berubah
    const sku =
      oldSite !== data.site_id || oldType !== data.type
        ? await generateSku(client, data.site_id, data.type)
        : oldSku;

    await client.query(
      `UPDATE inventories
          SET name = $1, unit = $2, type = $3, description = $4,
              category_id = $5, site_id = $6, sku = $7
        WHERE id = $8`,
      [data.name, data.unit, data.type, data.description, data.category_id, data.site_id, sku, id],
    );
  });

  res.json({ message: 'Barang berhasil diperbarui', data: await findInventory(id) });
}

/** PATCH /api/inventories/:id/active — body: { is_active: true | false } */
export async function setActive(req, res) {
  const id = parseId(req.params.id);
  const isActive = parseBoolean(req.body?.is_active, 'is_active');
  const inventory = await findInventory(id);
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');

  await query('UPDATE inventories SET is_active = $1 WHERE id = $2', [isActive, id]);
  res.json({
    message: isActive ? 'Barang diaktifkan kembali' : 'Barang dinonaktifkan',
    data: await findInventory(id),
  });
}

/**
 * DELETE /api/inventories/:id — hanya untuk barang yang belum punya riwayat transaksi
 * (misal salah input). Barang yang sudah dipakai → nonaktifkan.
 */
export async function remove(req, res) {
  const id = parseId(req.params.id);
  const inventory = await findInventory(id);
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat menghapus barang di site Anda sendiri');

  try {
    await query('DELETE FROM inventories WHERE id = $1', [id]);
  } catch (err) {
    if (err.code === '23503') {
      throw conflict(
        'Barang sudah punya riwayat transaksi sehingga tidak bisa dihapus. Nonaktifkan barang ini sebagai gantinya.',
      );
    }
    throw err;
  }

  removeUploadedFile(inventory.image);
  res.json({ message: 'Barang berhasil dihapus' });
}

/**
 * PATCH /api/inventories/:id/image — form-data, field "image" (JPG/PNG/WEBP).
 * Mengganti foto kondisi barang; foto lama dihapus dari disk.
 */
export async function uploadImage(req, res) {
  if (!req.file) throw badRequest('Pilih file foto pada field "image"');
  const newPath = inventoryImagePath(req.file.filename);

  try {
    const id = parseId(req.params.id);
    const inventory = await findInventory(id);
    assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');

    await query('UPDATE inventories SET image = $1 WHERE id = $2', [newPath, id]);
    removeUploadedFile(inventory.image);

    res.json({ message: 'Foto berhasil diunggah', data: await findInventory(id) });
  } catch (err) {
    removeUploadedFile(newPath); // jangan tinggalkan file yatim jika gagal
    throw err;
  }
}

/** DELETE /api/inventories/:id/image — hapus foto tanpa menghapus barangnya. */
export async function removeImage(req, res) {
  const id = parseId(req.params.id);
  const inventory = await findInventory(id);
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');
  if (!inventory.image) throw badRequest('Barang ini belum punya foto');

  await query('UPDATE inventories SET image = NULL WHERE id = $1', [id]);
  removeUploadedFile(inventory.image);
  res.json({ message: 'Foto berhasil dihapus', data: await findInventory(id) });
}
