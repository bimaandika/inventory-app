/*
 * Case 2 — Barang Masuk (docs/workflow/case-2-pengadaan-barang-masuk.md)
 *
 * Satu transaksi = satu site, boleh berisi banyak barang:
 *   - barang yang sudah ada : { inventoryId, quantity }
 *   - barang baru           : { name, unit, type, categoryId, description, quantity }
 * Tanpa approval: stok langsung bertambah, tercatat sebagai stock movement GOODS_IN.
 */
const { Op, fn, col, where: sqlWhere } = require('sequelize');
const { StockMovement, StockMovementItem, Inventory, Category, Site } = require('../models');
const { badRequest } = require('../helpers/httpError');
const { generateNumber } = require('./numberService');
const { generateSku } = require('./skuService');
const { changeStock, addHistory, assertNotInOpname } = require('./stockService');

const NEW_ITEM_NOTE = 'Barang baru';

/**
 * Simpan transaksi barang masuk. WAJIB dipanggil di dalam transaksi database.
 *
 * @param {object} p
 * @param {number} p.siteId
 * @param {string|null} p.remarks
 * @param {Array}  p.items  sudah tervalidasi bentuknya oleh controller
 * @param {object} p.user   req.user
 * @returns {Promise<number>} id transaksi
 */
async function createGoodsIn({ siteId, remarks, items, user }, transaction) {
  const site = await Site.findByPk(siteId, { transaction });
  if (!site) throw badRequest('siteId tidak ditemukan');

  const existingItems = items.filter((i) => i.inventoryId);
  const newItems = items.filter((i) => !i.inventoryId);

  // ---- Barang yang sudah ada: harus milik site ini dan masih aktif
  const inventories = await Inventory.findAll({
    where: { id: existingItems.map((i) => i.inventoryId) },
    transaction,
  });
  const byId = new Map(inventories.map((inv) => [inv.id, inv]));
  for (const item of existingItems) {
    const inv = byId.get(item.inventoryId);
    if (!inv) throw badRequest(`Barang id ${item.inventoryId} tidak ditemukan`);
    if (inv.siteId !== site.id) {
      throw badRequest(`${inv.name} (${inv.sku}) bukan barang site ${site.code}`);
    }
    if (!inv.isActive) {
      throw badRequest(`${inv.name} (${inv.sku}) sedang nonaktif. Aktifkan dulu sebelum menambah stok.`);
    }
  }

  // ---- Barang baru: kategori harus ada, nama belum dipakai di site ini
  if (newItems.length) {
    const categoryIds = [...new Set(newItems.map((i) => i.categoryId))];
    const found = await Category.count({ where: { id: categoryIds }, transaction });
    if (found !== categoryIds.length) throw badRequest('Ada categoryId yang tidak ditemukan');

    const lowerNames = newItems.map((i) => i.name.toLowerCase());
    const taken = await Inventory.findAll({
      attributes: ['name', 'sku'],
      where: {
        siteId: site.id,
        [Op.and]: [sqlWhere(fn('LOWER', col('name')), { [Op.in]: lowerNames })],
      },
      transaction,
    });
    if (taken.length) {
      const list = taken.map((t) => `${t.name} (${t.sku})`).join(', ');
      throw badRequest(
        `Barang sudah ada di site ${site.code}: ${list}. Pilih barang tersebut dari katalog, jangan ditambahkan sebagai barang baru.`,
      );
    }
  }

  // ---- Tahan bila site sedang stock opname untuk jenis barang yang terlibat
  await assertNotInOpname(
    site.id,
    [...inventories.map((inv) => inv.type), ...newItems.map((i) => i.type)],
    transaction,
  );

  // ---- Simpan header transaksi
  const now = new Date();
  const movement = await StockMovement.create(
    {
      number: await generateNumber({ type: 'GOODS_IN', siteCode: site.code }, transaction),
      type: 'GOODS_IN',
      status: 'COMPLETED',
      statusChangedAt: now,
      siteId: site.id,
      remarks,
      idUser: user.id,
    },
    { transaction },
  );

  // ---- Simpan item + tambah stok (urutan sesuai input)
  for (const item of items) {
    let inventoryId = item.inventoryId;
    let note = null;

    if (!inventoryId) {
      const created = await Inventory.create(
        {
          name: item.name,
          unit: item.unit,
          type: item.type,
          description: item.description,
          categoryId: item.categoryId,
          siteId: site.id,
          sku: await generateSku(site.id, item.type, transaction),
          quantity: 0,
        },
        { transaction },
      );
      inventoryId = created.id;
      note = NEW_ITEM_NOTE;
    }

    const { before, after } = await changeStock(inventoryId, item.quantity, transaction);
    await StockMovementItem.create(
      {
        movementId: movement.id,
        inventoryId,
        quantity: item.quantity,
        qtyBefore: before,
        qtyAfter: after,
        note,
      },
      { transaction },
    );
  }

  await addHistory(
    { movementId: movement.id, action: 'CREATED', status: 'COMPLETED', remarks, userId: user.id },
    transaction,
  );

  return movement.id;
}

module.exports = { createGoodsIn, NEW_ITEM_NOTE };
