import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

/** Query biasa: db.query('SELECT ...', [params]) */
export const query = (text, params) => pool.query(text, params);

/**
 * Jalankan beberapa query dalam satu transaksi.
 * Contoh: await withTransaction(async (client) => { await client.query(...) })
 * Dipakai untuk approve stock movement (kurangi stok + ubah status + catat history).
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
