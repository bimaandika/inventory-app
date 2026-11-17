'use strict';

/**
 * Header SEMUA jenis transaksi (lihat docs/erd.md):
 *   REQUEST, RETURN, GOODS_IN, TRANSFER, LOAN, LOAN_RETURN, ADJUSTMENT, OPNAME
 * Status yang valid untuk tiap jenis dijaga oleh CHECK constraint di bawah.
 */
const TYPES = ['REQUEST', 'RETURN', 'GOODS_IN', 'TRANSFER', 'LOAN', 'LOAN_RETURN', 'ADJUSTMENT', 'OPNAME'];

module.exports = {
  async up(queryInterface, Sequelize) {
    const fk = (table, onDelete = 'RESTRICT') => ({
      type: Sequelize.INTEGER,
      references: { model: table, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.createTable('stock_movements', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      type: { type: Sequelize.ENUM(...TYPES), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false },
      status_changed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      site_id: { ...fk('sites'), allowNull: false },
      to_site_id: { ...fk('sites'), allowNull: true },
      parent_id: { ...fk('stock_movements'), allowNull: true },
      requester_id: { ...fk('users'), allowNull: true },
      inventory_type: { type: Sequelize.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), allowNull: true },
      reason: { type: Sequelize.STRING(30), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      id_user: { ...fk('users'), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('stock_movements', ['type', 'status']);
    await queryInterface.addIndex('stock_movements', ['site_id']);
    await queryInterface.addIndex('stock_movements', ['to_site_id']);
    await queryInterface.addIndex('stock_movements', ['parent_id']);
    await queryInterface.addIndex('stock_movements', ['requester_id']);

    await queryInterface.sequelize.query(`
      ALTER TABLE stock_movements
        -- Status yang valid untuk setiap jenis transaksi
        ADD CONSTRAINT sm_status_check CHECK (
             (type = 'REQUEST'     AND status IN ('PENDING','APPROVED','PICKED_UP','COMPLETED','REJECTED','CANCELLED'))
          OR (type = 'RETURN'      AND status IN ('SUBMITTED','CONFIRMED','CANCELLED'))
          OR (type = 'GOODS_IN'    AND status IN ('COMPLETED'))
          OR (type = 'TRANSFER'    AND status IN ('IN_TRANSIT','COMPLETED','CANCELLED'))
          OR (type = 'LOAN'        AND status IN ('IN_TRANSIT','BORROWED','COMPLETED','CANCELLED'))
          OR (type = 'LOAN_RETURN' AND status IN ('IN_TRANSIT','RECEIVED'))
          OR (type = 'ADJUSTMENT'  AND status IN ('COMPLETED'))
          OR (type = 'OPNAME'      AND status IN ('IN_PROGRESS','SUBMITTED','APPROVED','CANCELLED'))
        ),
        -- Site tujuan: wajib (dan berbeda dari site asal) untuk transfer & peminjaman
        ADD CONSTRAINT sm_to_site_check CHECK (
          CASE WHEN type IN ('TRANSFER','LOAN','LOAN_RETURN')
               THEN to_site_id IS NOT NULL AND to_site_id <> site_id
               ELSE to_site_id IS NULL
          END
        ),
        -- Transaksi asal: wajib untuk pengembalian
        ADD CONSTRAINT sm_parent_check CHECK (type NOT IN ('RETURN','LOAN_RETURN') OR parent_id IS NOT NULL),
        -- Crew peminta: wajib untuk permintaan
        ADD CONSTRAINT sm_requester_check CHECK (type <> 'REQUEST' OR requester_id IS NOT NULL),
        -- Jenis barang: wajib untuk opname (dan hanya untuk opname)
        ADD CONSTRAINT sm_inventory_type_check CHECK ((type = 'OPNAME') = (inventory_type IS NOT NULL)),
        -- Alasan pilihan untuk permintaan
        ADD CONSTRAINT sm_reason_check CHECK (
          reason IS NULL OR reason IN ('PEMAKAIAN_HARIAN','PERBAIKAN','PROYEK','LAINNYA')
        );

      -- Hanya satu opname aktif per site per jenis barang
      CREATE UNIQUE INDEX sm_one_active_opname
        ON stock_movements (site_id, inventory_type)
        WHERE type = 'OPNAME' AND status IN ('IN_PROGRESS','SUBMITTED');
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('stock_movements');
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_stock_movements_type";
      DROP TYPE IF EXISTS "enum_stock_movements_inventory_type";
    `);
  },
};
