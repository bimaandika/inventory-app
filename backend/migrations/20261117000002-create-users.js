'use strict';

/**
 * Pengguna dengan 3 peran:
 *   admin_pusat — tanpa site (semua site)
 *   admin       — admin site, wajib punya site
 *   crew        — wajib punya site
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      password: { type: Sequelize.STRING(255), allowNull: false },
      role: {
        type: Sequelize.ENUM('admin_pusat', 'admin', 'crew'),
        allowNull: false,
        defaultValue: 'crew',
      },
      site_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('users', ['site_id']);
    await queryInterface.sequelize.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_site_check CHECK (
        (role = 'admin_pusat' AND site_id IS NULL)
        OR (role IN ('admin', 'crew') AND site_id IS NOT NULL)
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },
};
