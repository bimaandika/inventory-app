const { Op, ForeignKeyConstraintError } = require('sequelize');
const { sequelize, Inventory, Category, Site } = require('../models');
const { badRequest, notFound, forbidden, conflict } = require('../helpers/httpError');
const { generateSku } = require('../services/skuService');
const { canViewSite, assertCanActOnSite, isPusat } = require('../middlewares/auth');
const { inventoryImagePath, removeUploadedFile } = require('../config/upload');
const {
  parseId,
  requireString,
  optionalString,
  parseNonNegativeInt,
  parseBoolean,
  parsePagination,
  paginated,
} = require('../helpers/validate');

/*
 * Satu baris inventories = satu barang di satu site.
 *
 * Hak akses (docs/workflow/peran-hak-akses.md):
 * - Lihat  : crew hanya site sendiri & barang aktif; admin site & admin pusat semua site
 * - Kelola : admin pusat semua site; admin site hanya site sendiri; crew tidak bisa (routes)
 *
 * Aturan:
 * - SKU dibuat otomatis (services/skuService.js); dibuat ulang jika site/type berubah.
 * - quantity hanya diisi saat barang dibuat (stok awal); selanjutnya lewat stock movement.
 * - Barang yang sudah punya riwayat transaksi tidak bisa dihapus → nonaktifkan.
 */

const INVENTORY_TYPES = ['CONSUMABLE', 'NON_CONSUMABLE'];

/** Relasi yang selalu ikut ditampilkan. */
const INCLUDE = [
  { model: Category, as: 'category', attributes: ['id', 'name'] },
  { model: Site, as: 'site', attributes: ['id', 'name', 'code'] },
];

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

async function findInventory(id) {
  const inventory = await Inventory.findByPk(id, { include: INCLUDE });
  if (!inventory) throw notFound('Barang tidak ditemukan');
  return inventory;
}

/** Crew: hanya barang aktif di site sendiri. */
function assertCanView(user, inventory) {
  if (!canViewSite(user, inventory.site_id) || (user.role === 'crew' && !inventory.is_active)) {
    throw forbidden('Anda hanya dapat melihat barang di site Anda sendiri');
  }
}

async function ensureExists(Model, id, label) {
  if (!(await Model.count({ where: { id } }))) throw badRequest(`${label} tidak ditemukan`);
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
async function list(req, res) {
  const pagination = parsePagination(req.query);
  const isCrew = req.user.role === 'crew';
  const search = (req.query.search || '').trim();
  const where = {};

  if (search) {
    where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }, { sku: { [Op.iLike]: `%${search}%` } }];
  }
  if (req.query.category_id) where.category_id = parseId(req.query.category_id, 'category_id');
  const type = parseType(req.query.type, { required: false });
  if (type) where.type = type;

  if (isCrew) where.site_id = req.user.site_id;
  else if (req.query.site_id) where.site_id = parseId(req.query.site_id, 'site_id');

  if (isCrew || req.query.include_inactive !== 'true') where.is_active = true;

  const { rows, count } = await Inventory.findAndCountAll({
    where,
    include: INCLUDE,
    order: [
      [{ model: Site, as: 'site' }, 'name', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    distinct: true,
  });

  res.json(paginated(rows, count, pagination));
}

/** GET /api/inventories/:id */
async function detail(req, res) {
  const inventory = await findInventory(parseId(req.params.id));
  assertCanView(req.user, inventory);
  res.json({ data: inventory });
}

/** GET /api/inventories/sku/:sku — untuk scan barcode/SKU. */
async function findBySku(req, res) {
  const sku = String(req.params.sku || '').trim().toUpperCase();
  const inventory = await Inventory.findOne({ where: { sku }, include: INCLUDE });
  if (!inventory) throw notFound(`Barang dengan SKU ${sku} tidak ditemukan`);
  assertCanView(req.user, inventory);
  res.json({ data: inventory });
}

/** POST /api/inventories — quantity opsional sebagai stok awal (default 0). */
async function create(req, res) {
  const data = readBody(req.body);
  const quantity = parseNonNegativeInt(req.body?.quantity, 'quantity', 0);
  assertCanActOnSite(req.user, data.site_id, 'Anda hanya dapat menambah barang di site Anda sendiri');
  await ensureExists(Category, data.category_id, 'category_id');
  await ensureExists(Site, data.site_id, 'site_id');

  const id = await sequelize.transaction(async (transaction) => {
    const sku = await generateSku(data.site_id, data.type, transaction);
    const inventory = await Inventory.create({ ...data, sku, quantity }, { transaction });
    return inventory.id;
  });

  res.status(201).json({ message: 'Barang berhasil dibuat', data: await findInventory(id) });
}

/**
 * PUT /api/inventories/:id — quantity TIDAK bisa diubah di sini.
 * Admin site tidak bisa memindahkan barang ke site lain (gunakan transfer).
 */
async function update(req, res) {
  const id = parseId(req.params.id);
  if (req.body?.quantity !== undefined) {
    throw badRequest('quantity tidak bisa diubah lewat endpoint ini; gunakan stock movement');
  }
  const data = readBody(req.body);
  await ensureExists(Category, data.category_id, 'category_id');
  await ensureExists(Site, data.site_id, 'site_id');

  await sequelize.transaction(async (transaction) => {
    const inventory = await Inventory.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) throw notFound('Barang tidak ditemukan');

    assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');
    if (inventory.site_id !== data.site_id && !isPusat(req.user)) {
      throw forbidden('Memindahkan barang ke site lain dilakukan lewat transfer');
    }

    // SKU memuat kode site & jenis, jadi dibuat ulang jika salah satunya berubah
    const sku =
      inventory.site_id !== data.site_id || inventory.type !== data.type
        ? await generateSku(data.site_id, data.type, transaction)
        : inventory.sku;

    await inventory.update({ ...data, sku }, { transaction });
  });

  res.json({ message: 'Barang berhasil diperbarui', data: await findInventory(id) });
}

/** PATCH /api/inventories/:id/active — body: { is_active: true | false } */
async function setActive(req, res) {
  const isActive = parseBoolean(req.body?.is_active, 'is_active');
  const inventory = await findInventory(parseId(req.params.id));
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');

  await inventory.update({ is_active: isActive });
  res.json({
    message: isActive ? 'Barang diaktifkan kembali' : 'Barang dinonaktifkan',
    data: inventory,
  });
}

/**
 * DELETE /api/inventories/:id — hanya untuk barang tanpa riwayat transaksi
 * (misal salah input). Barang yang sudah dipakai → nonaktifkan.
 */
async function remove(req, res) {
  const inventory = await findInventory(parseId(req.params.id));
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat menghapus barang di site Anda sendiri');

  try {
    await inventory.destroy();
  } catch (err) {
    if (err instanceof ForeignKeyConstraintError) {
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
async function uploadImage(req, res) {
  if (!req.file) throw badRequest('Pilih file foto pada field "image"');
  const newPath = inventoryImagePath(req.file.filename);

  try {
    const inventory = await findInventory(parseId(req.params.id));
    assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');

    const oldPath = inventory.image;
    await inventory.update({ image: newPath });
    removeUploadedFile(oldPath);

    res.json({ message: 'Foto berhasil diunggah', data: inventory });
  } catch (err) {
    removeUploadedFile(newPath); // jangan tinggalkan file yatim jika gagal
    throw err;
  }
}

/** DELETE /api/inventories/:id/image — hapus foto tanpa menghapus barangnya. */
async function removeImage(req, res) {
  const inventory = await findInventory(parseId(req.params.id));
  assertCanActOnSite(req.user, inventory.site_id, 'Anda hanya dapat mengubah barang di site Anda sendiri');
  if (!inventory.image) throw badRequest('Barang ini belum punya foto');

  const oldPath = inventory.image;
  await inventory.update({ image: null });
  removeUploadedFile(oldPath);
  res.json({ message: 'Foto berhasil dihapus', data: inventory });
}

module.exports = {
  list,
  detail,
  findBySku,
  create,
  update,
  setActive,
  remove,
  uploadImage,
  removeImage,
};
