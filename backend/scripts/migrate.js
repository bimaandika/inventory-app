/**
 * Menjalankan file SQL di folder migrations/ secara berurutan.
 * File yang sudah pernah dijalankan dicatat di tabel schema_migrations
 * sehingga tidak dijalankan dua kali.
 *
 * Pemakaian: npm run migrate
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'migrations');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const done = new Set(rows.map((r) => r.filename));
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✔ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✘ ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

run();
