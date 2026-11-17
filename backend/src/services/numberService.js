/*
 * Pembuat nomor transaksi (docs/workflow/nomor-transaksi.md).
 *
 *   REQUEST    UTIL-<site>-<MMYY>-<nomor>          UTIL-GMG-1126-001
 *   GOODS_IN   IN-<site>-<MMYY>-<nomor>            IN-GMG-1126-001
 *   TRANSFER   TF-<site pengirim>-<MMYY>-<nomor>   TF-GMG-1126-001
 *   LOAN       LOAN-<site pemberi>-<MMYY>-<nomor>  LOAN-GMG-1126-001
 *   ADJUSTMENT ADJ-<site>-<MMYY>-<nomor>           ADJ-GMG-1126-001
 *   OPNAME     OPNAME-<ET|SM>-<site>-<MMYY>-<nomor> OPNAME-SM-GMG-1126-001
 *   RETURN / LOAN_RETURN  <nomor asal>-R<urutan>  UTIL-GMG-1126-001-R1
 *
 * - MMYY menurut waktu WIB (Asia/Jakarta); nomor urut kembali ke 001 tiap bulan.
 * - Panggil DI DALAM transaksi database bersama penyimpanan transaksinya.
 */
const { Op } = require('sequelize');
const { sequelize, StockMovement } = require('../models');
const { badRequest } = require('../helpers/httpError');
const { TYPE_CODES } = require('./skuService');

const TYPE_PREFIX = {
  REQUEST: 'UTIL',
  GOODS_IN: 'IN',
  TRANSFER: 'TF',
  LOAN: 'LOAN',
  ADJUSTMENT: 'ADJ',
  OPNAME: 'OPNAME',
};

const RETURN_OF = { RETURN: 'REQUEST', LOAN_RETURN: 'LOAN' };

/** Bulan & tahun (MMYY) menurut WIB. Contoh: 17 Nov 2026 → "1126". */
function periodCode(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    month: '2-digit',
    year: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('month')}${get('year')}`;
}

/** 1 → "001", 1000 → "1000" */
const formatNumber = (n) => String(n).padStart(3, '0');

/** Awalan nomor (tanpa nomor urut), misal "IN-GMG-1126" atau "OPNAME-SM-GMG-1126". */
function buildPrefix({ type, siteCode, inventoryType, date }) {
  const code = TYPE_PREFIX[type];
  if (!code) throw badRequest(`Jenis transaksi ${type} tidak punya format nomor sendiri`);
  if (!siteCode) throw badRequest('Kode site wajib untuk membuat nomor transaksi');

  const parts = [code];
  if (type === 'OPNAME') {
    if (!TYPE_CODES[inventoryType]) throw badRequest('Jenis barang opname tidak valid');
    parts.push(TYPE_CODES[inventoryType]); // ET / SM
  }
  parts.push(siteCode, periodCode(date));
  return parts.join('-');
}

/**
 * Nomor transaksi baru untuk REQUEST, GOODS_IN, TRANSFER, LOAN, ADJUSTMENT, OPNAME.
 * @param {object} p { type, siteCode, inventoryType (khusus OPNAME) }
 * @param {object} transaction transaksi Sequelize
 */
async function generateNumber({ type, siteCode, inventoryType }, transaction) {
  const prefix = buildPrefix({ type, siteCode, inventoryType });

  // Atomik: awalan baru mulai dari 1, awalan yang sudah ada ditambah 1.
  const [rows] = await sequelize.query(
    `INSERT INTO number_sequences (prefix, last_number)
     VALUES (:prefix, 1)
     ON CONFLICT (prefix)
     DO UPDATE SET last_number = number_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { prefix }, transaction },
  );

  return `${prefix}-${formatNumber(rows[0].last_number)}`;
}

/**
 * Nomor pengembalian: <nomor asal>-R<urutan>.
 * Baris transaksi asal dikunci supaya dua pengembalian bersamaan tidak mendapat urutan sama.
 * @param {string} type RETURN | LOAN_RETURN
 * @param {number} parentId id transaksi asal (REQUEST / LOAN)
 */
async function generateReturnNumber(type, parentId, transaction) {
  const parentType = RETURN_OF[type];
  if (!parentType) throw badRequest(`Jenis transaksi ${type} bukan pengembalian`);

  const parent = await StockMovement.findByPk(parentId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!parent || parent.type !== parentType) throw badRequest('Transaksi asal tidak ditemukan');

  const existing = await StockMovement.count({
    where: { parentId, type, number: { [Op.like]: `${parent.number}-R%` } },
    transaction,
  });
  return `${parent.number}-R${existing + 1}`;
}

module.exports = { TYPE_PREFIX, periodCode, formatNumber, buildPrefix, generateNumber, generateReturnNumber };
