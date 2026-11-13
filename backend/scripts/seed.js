/**
 * Data awal:
 * - Akun admin pusat dari ADMIN_USERNAME / ADMIN_PASSWORD di .env
 * - Daftar site beserta kodenya (dipakai di SKU: MEGS-<kode>-ET-001)
 *
 * Aman dijalankan berulang (tidak membuat duplikat).
 * Pemakaian: npm run seed
 */
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';

const SITES = [
  { name: 'Gunung Megang', code: 'GMG' },
  { name: 'POMS Rimau', code: 'POMS' },
  { name: 'GEG Rimau', code: 'GEG' },
  { name: 'FOL', code: 'FOL' },
  { name: 'Genset Tarakan', code: 'TRK' },
];

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(password, 10);

  const { rowCount } = await pool.query(
    `INSERT INTO users (username, name, password, role, site_id)
     VALUES ($1, 'Administrator', $2, 'admin_pusat', NULL)
     ON CONFLICT (username) DO NOTHING`,
    [username, hash],
  );
  console.log(
    rowCount ? `✔ Admin pusat "${username}" dibuat` : `• Admin pusat "${username}" sudah ada`,
  );
}

async function seedSites() {
  for (const site of SITES) {
    const { rowCount } = await pool.query(
      `INSERT INTO sites (name, code) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      [site.name, site.code],
    );
    console.log(
      rowCount ? `✔ Site ${site.code} - ${site.name} dibuat` : `• Site ${site.code} sudah ada`,
    );
  }
}

async function run() {
  await seedAdmin();
  await seedSites();
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
