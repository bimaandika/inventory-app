'use strict';

/**
 * Akun admin pusat awal dari ADMIN_USERNAME / ADMIN_PASSWORD di .env.
 * Aman dijalankan berulang (username yang sudah ada dilewati).
 */
require('dotenv').config();
const { hashPassword } = require('../src/helpers/bcrypt');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'users',
      [
        {
          username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
          name: 'Administrator',
          password: await hashPassword(process.env.ADMIN_PASSWORD || 'admin123'),
          role: 'admin_pusat',
          site_id: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
    });
  },
};
