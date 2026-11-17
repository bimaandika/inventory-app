const { Op } = require('sequelize');
const { sequelize, StockMovement } = require('../models');
const { badRequest } = require('../helpers/httpError');
const { assertCanActOnSite } = require('../middlewares/auth');
const { createGoodsIn } = require('../services/goodsInService');
const { findMovement, LIST_INCLUDE, LIST_TOTALS, dateRange } = require('../services/movementService');
const {
  parseId,
  requireString,
  optionalString,
  parsePagination,
  paginated,
} = require('../helpers/validate');

/*
 * Case 2 — Barang Masuk. Hanya admin pusat & admin site (diatur di routes).
 * Admin site hanya bisa mencatat barang masuk untuk site-nya sendiri.
 */

const INVENTORY_TYPES = ['CONSUMABLE', 'NON_CONSUMABLE'];
const MAX_ITEMS = 200;

/** Validasi satu baris item dari body. */
function readItem(raw, index) {
  const label = `items[${index}]`;
  if (!raw || typeof raw !== 'object') throw badRequest(`${label} tidak valid`);

  const quantity = Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw badRequest(`${label}.quantity harus bilangan bulat lebih dari 0`);
  }

  // Barang yang sudah ada
  if (raw.inventoryId !== undefined && raw.inventoryId !== null && raw.inventoryId !== '') {
    return { inventoryId: parseId(raw.inventoryId, `${label}.inventoryId`), quantity };
  }

  // Barang baru
  const type = String(raw.type || '').trim().toUpperCase();
  if (!INVENTORY_TYPES.includes(type)) {
    throw badRequest(`${label}.type harus CONSUMABLE atau NON_CONSUMABLE (barang baru)`);
  }
  return {
    name: requireString(raw, 'name', { max: 150 }),
    unit: requireString(raw, 'unit', { max: 30 }),
    type,
    description: optionalString(raw, 'description'),
    categoryId: parseId(raw.categoryId, `${label}.categoryId`),
    quantity,
  };
}

/** Validasi seluruh daftar item. */
function readItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw badRequest('items wajib berisi minimal 1 barang');
  }
  if (rawItems.length > MAX_ITEMS) throw badRequest(`Maksimal ${MAX_ITEMS} barang per transaksi`);

  const items = rawItems.map(readItem);

  const ids = items.filter((i) => i.inventoryId).map((i) => i.inventoryId);
  if (new Set(ids).size !== ids.length) {
    throw badRequest('Barang yang sama muncul lebih dari sekali; gabungkan jumlahnya dalam satu baris');
  }
  const names = items.filter((i) => !i.inventoryId).map((i) => i.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    throw badRequest('Ada barang baru dengan nama yang sama; gabungkan jumlahnya dalam satu baris');
  }
  return items;
}

/**
 * POST /api/goods-in
 * body: { siteId, remarks, items: [ { inventoryId, quantity } | { name, unit, type, categoryId, description, quantity } ] }
 */
async function create(req, res) {
  const siteId = parseId(req.body?.siteId, 'siteId');
  assertCanActOnSite(req.user, siteId, 'Anda hanya dapat mencatat barang masuk untuk site Anda sendiri');
  const remarks = optionalString(req.body, 'remarks');
  const items = readItems(req.body?.items);

  const id = await sequelize.transaction((transaction) =>
    createGoodsIn({ siteId, remarks, items, user: req.user }, transaction),
  );

  const movement = await findMovement(id, { type: 'GOODS_IN' });
  res.status(201).json({ message: `Barang masuk tercatat dengan nomor ${movement.number}`, data: movement });
}

/**
 * GET /api/goods-in?siteId=&search=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&limit=
 * - search mencari di nomor transaksi dan remarks
 */
async function list(req, res) {
  const pagination = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const where = { type: 'GOODS_IN' };

  if (req.query.siteId) where.siteId = parseId(req.query.siteId, 'siteId');
  if (search) {
    where[Op.or] = [{ number: { [Op.iLike]: `%${search}%` } }, { remarks: { [Op.iLike]: `%${search}%` } }];
  }
  const createdAt = dateRange(req.query.from, req.query.to);
  if (createdAt) where.createdAt = createdAt;

  const { rows, count } = await StockMovement.findAndCountAll({
    where,
    attributes: { include: LIST_TOTALS },
    include: LIST_INCLUDE,
    order: [['createdAt', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
    distinct: true,
  });

  const filtered = Boolean(req.query.siteId || search || createdAt);
  res.json(
    paginated(rows, count, pagination, {
      empty: 'Belum ada transaksi barang masuk',
      emptyFiltered: 'Tidak ada transaksi barang masuk yang cocok dengan pencarian atau filter',
    }, filtered),
  );
}

/** GET /api/goods-in/:id — detail beserta daftar barang, stok sebelum/sesudah, dan timeline. */
async function detail(req, res) {
  res.json({ data: await findMovement(parseId(req.params.id), { type: 'GOODS_IN' }) });
}

module.exports = { create, list, detail };
