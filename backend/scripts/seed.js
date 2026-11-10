/**
 * Membuat akun admin awal dari ADMIN_USERNAME / ADMIN_PASSWORD di .env.
 * Aman dijalankan berulang (tidak membuat duplikat).
 *
 * Pemakaian: npm run seed
 */
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';

async function run() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);

  const { rowCount } = await pool.query(
    `INSERT INTO users (username, password, role, site_id)
     VALUES ($1, $2, 'admin', NULL)
     ON CONFLICT (username) DO NOTHING`,
    [username, hash],
  );

  console.log(rowCount ? `✔ Admin "${username}" dibuat` : `• Admin "${username}" sudah ada`);
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
