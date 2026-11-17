require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 5050;

async function start() {
  // Pastikan database bisa dihubungi sebelum server menerima request
  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error(`\nTidak bisa terhubung ke database: ${err.message}`);
    console.error('Cek pengaturan DB_* di backend/.env dan pastikan PostgreSQL berjalan.\n');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`API berjalan di http://localhost:${PORT}/api`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} sudah dipakai aplikasi lain.\n` +
          'Ganti nilai PORT di backend/.env (dan proxy di frontend/vite.config.js), ' +
          `atau cek pemakainya dengan: lsof -i :${PORT}\n`,
      );
      process.exit(1);
    }
    throw err;
  });
}

start();
