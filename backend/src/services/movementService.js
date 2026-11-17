/*
 * Membaca transaksi (stock_movements) beserta relasinya.
 * Dipakai bersama oleh semua case (barang masuk, permintaan, transfer, dst.).
 */
const { Op } = require('sequelize');
const { sequelize, StockMovement, StockMovementItem, Inventory, Category, Site, User, History } = require('../models');
const { notFound } = require('../helpers/httpError');

const USER_ATTRS = ['id', 'username', 'name', 'role'];
const SITE_ATTRS = ['id', 'name', 'code'];

/** Relasi untuk detail satu transaksi. */
const DETAIL_INCLUDE = [
  { model: Site, as: 'site', attributes: SITE_ATTRS },
  { model: Site, as: 'toSite', attributes: SITE_ATTRS },
  { model: User, as: 'creator', attributes: USER_ATTRS },
  { model: User, as: 'requester', attributes: USER_ATTRS },
  {
    model: StockMovementItem,
    as: 'items',
    include: [
      {
        model: Inventory,
        as: 'inventory',
        attributes: ['id', 'name', 'sku', 'unit', 'type', 'image'],
        include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      },
    ],
  },
  {
    model: History,
    as: 'histories',
    include: [{ model: User, as: 'user', attributes: USER_ATTRS }],
  },
];

/** Relasi ringkas untuk daftar transaksi. */
const LIST_INCLUDE = [
  { model: Site, as: 'site', attributes: SITE_ATTRS },
  { model: Site, as: 'toSite', attributes: SITE_ATTRS },
  { model: User, as: 'creator', attributes: USER_ATTRS },
];

/** Jumlah baris barang & total kuantitas, sebagai kolom tambahan di daftar transaksi. */
const LIST_TOTALS = [
  [
    sequelize.literal('(SELECT COUNT(*) FROM stock_movement_items smi WHERE smi.movement_id = "StockMovement"."id")::int'),
    'totalItems',
  ],
  [
    sequelize.literal(
      '(SELECT COALESCE(SUM(smi.quantity), 0) FROM stock_movement_items smi WHERE smi.movement_id = "StockMovement"."id")::int',
    ),
    'totalQuantity',
  ],
];

/**
 * Detail satu transaksi.
 * @param {number} id
 * @param {object} opts { type: jenis yang diharapkan (opsional), transaction }
 */
async function findMovement(id, { type, transaction } = {}) {
  const movement = await StockMovement.findByPk(id, {
    include: DETAIL_INCLUDE,
    order: [
      [{ model: StockMovementItem, as: 'items' }, 'id', 'ASC'],
      [{ model: History, as: 'histories' }, 'date', 'ASC'],
    ],
    transaction,
  });
  if (!movement || (type && movement.type !== type)) throw notFound('Transaksi tidak ditemukan');
  return movement;
}

/**
 * Filter tanggal dari query ?from=YYYY-MM-DD&to=YYYY-MM-DD (tanggal WIB).
 * Mengembalikan kondisi untuk kolom createdAt, atau null jika tidak ada filter.
 */
function dateRange(from, to) {
  const valid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const range = {};
  if (valid(from)) range[Op.gte] = new Date(`${from}T00:00:00+07:00`);
  if (valid(to)) range[Op.lte] = new Date(`${to}T23:59:59.999+07:00`);
  return Object.getOwnPropertySymbols(range).length ? range : null;
}

module.exports = { DETAIL_INCLUDE, LIST_INCLUDE, LIST_TOTALS, findMovement, dateRange };
