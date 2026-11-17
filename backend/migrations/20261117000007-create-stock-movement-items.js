'use strict';

/**
 * Item SEMUA jenis transaksi + isi keranjang.
 * - movement_id NULL  → baris masih di keranjang milik id_user
 * - arti tiap kolom qty_* tergantung jenis transaksi (lihat docs/erd.md)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const fk = (table, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: table, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });
    const qty = { type: Sequelize.INTEGER, allowNull: true };

    await queryInterface.createTable('stock_movement_items', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      movement_id: fk('stock_movements', 'CASCADE'),
      id_user: fk('users'),
      inventory_id: { ...fk('inventories'), allowNull: false },
      dest_inventory_id: fk('inventories'),
      ref_item_id: fk('stock_movement_items'),
      quantity: qty,
      qty_approved: qty,
      qty_good: qty,
      qty_damaged: qty,
      qty_lost: qty,
      qty_used: qty,
      qty_before: qty,
      qty_after: qty,
      reason: { type: Sequelize.STRING(30), allowNull: true },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('stock_movement_items', ['movement_id']);
    await queryInterface.addIndex('stock_movement_items', ['inventory_id']);
    await queryInterface.addIndex('stock_movement_items', ['ref_item_id']);

    await queryInterface.sequelize.query(`
      ALTER TABLE stock_movement_items
        ADD CONSTRAINT smi_qty_check CHECK (
              COALESCE(qty_approved, 0) >= 0 AND COALESCE(qty_good, 0) >= 0
          AND COALESCE(qty_damaged, 0)  >= 0 AND COALESCE(qty_lost, 0) >= 0
          AND COALESCE(qty_used, 0)     >= 0 AND COALESCE(qty_before, 0) >= 0
          AND COALESCE(qty_after, 0)    >= 0
        ),
        -- Baris keranjang wajib punya pemilik dan jumlah > 0
        ADD CONSTRAINT smi_cart_check CHECK (
          movement_id IS NOT NULL OR (id_user IS NOT NULL AND quantity > 0)
        ),
        -- Alasan pilihan untuk adjustment
        ADD CONSTRAINT smi_reason_check CHECK (
          reason IS NULL OR reason IN ('RUSAK','HILANG','KOREKSI','DITEMUKAN','LAINNYA')
        );

      -- Keranjang: satu barang hanya satu baris per user
      CREATE UNIQUE INDEX smi_cart_unique
        ON stock_movement_items (id_user, inventory_id)
        WHERE movement_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_movement_items');
  },
};
