// Konfigurasi database untuk Sequelize & sequelize-cli.
// Nilai dibaca dari backend/.env, jadi password tidak ikut ter-commit
// (berbeda dengan config.json bawaan sequelize-cli).
require('dotenv').config();

const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false, // ganti ke console.log untuk melihat query SQL
  define: {
    underscored: true, // createdAt/updatedAt → kolom created_at/updated_at
  },
};

module.exports = {
  development: { ...base },
  test: { ...base, database: process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test` },
  production: { ...base },
};
