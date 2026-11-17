/*
 * Logika bersama untuk semua case yang mengubah stok.
 * Semua fungsi di sini WAJIB dipanggil di dalam transaksi database.
 *
 * - changeStock          : ubah inventories.quantity (dengan kunci baris), kembalikan stok sebelum/sesudah
 * - addHistory           : catat timeline transaksi (tabel histories)
 * - assertNotInOpname    : tolak perubahan stok bila site sedang stock opname untuk jenis barang tsb.
 */
const { Op } = require('sequelize');
const { Inventory, History, StockMovement, Site } = require('../models');
const { badRequest, conflict, notFound } = require('../helpers/httpError');

const TYPE_LABEL = { CONSUMABLE: 'Consumable', NON_CONSUMABLE: 'Non-Consumable' };

/**
 * Tambah/kurangi stok satu barang.
 * Baris barang dikunci (SELECT ... FOR UPDATE) supaya dua transaksi bersamaan
 * tidak saling menimpa jumlah stok.
 *
 * @param {number} inventoryId
 * @param {number} delta  positif = tambah, negatif = kurang
 * @returns {{ inventory, before: number, after: number }}
 */
async function changeStock(inventoryId, delta, transaction) {
  if (!Number.isInteger(delta)) throw badRequest('Perubahan stok harus bilangan bulat');

  const inventory = await Inventory.findByPk(inventoryId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!inventory) throw notFound(`Barang id ${inventoryId} tidak ditemukan`);

  const before = inventory.quantity;
  const after = before + delta;
  if (after < 0) {
    throw badRequest(
      `Stok ${inventory.name} (${inventory.sku}) tidak cukup: tersedia ${before}, dibutuhkan ${-delta}`,
    );
  }

  await inventory.update({ quantity: after }, { transaction });
  return { inventory, before, after };
}

/** Catat satu baris timeline untuk transaksi. */
function addHistory({ movementId, action, status, remarks = null, userId }, transaction) {
  return History.create(
    { idSm: movementId, action, status, remarks, idUser: userId, date: new Date() },
    { transaction },
  );
}

/**
 * Tolak jika ada stock opname aktif (IN_PROGRESS / SUBMITTED) di site tersebut
 * untuk salah satu jenis barang yang terlibat (docs/workflow/case-4-adjustment-stock-opname.md).
 *
 * @param {number}   siteId
 * @param {string[]} inventoryTypes  misal ['CONSUMABLE', 'NON_CONSUMABLE']
 */
async function assertNotInOpname(siteId, inventoryTypes, transaction) {
  const types = [...new Set(inventoryTypes)].filter(Boolean);
  if (types.length === 0) return;

  const opname = await StockMovement.findOne({
    where: {
      type: 'OPNAME',
      status: { [Op.in]: ['IN_PROGRESS', 'SUBMITTED'] },
      siteId,
      inventoryType: { [Op.in]: types },
    },
    include: [{ model: Site, as: 'site', attributes: ['code'] }],
    transaction,
  });

  if (opname) {
    throw conflict(
      `Site ${opname.site.code} sedang stock opname ${TYPE_LABEL[opname.inventoryType]} ` +
        `(${opname.number}). Transaksi untuk jenis barang ini ditahan sampai opname selesai.`,
    );
  }
}

module.exports = { changeStock, addHistory, assertNotInOpname };
