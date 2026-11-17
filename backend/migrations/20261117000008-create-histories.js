'use strict';

/** Timeline setiap transaksi: siapa melakukan apa dan kapan. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('histories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      id_sm: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'stock_movements', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      action: { type: Sequelize.STRING(30), allowNull: false }, // CREATED, APPROVED, PICKED_UP, ...
      status: { type: Sequelize.STRING(30), allowNull: true }, // status transaksi setelah aksi
      remarks: { type: Sequelize.TEXT, allowNull: true },
      id_user: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('histories', ['id_sm']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('histories');
  },
};
