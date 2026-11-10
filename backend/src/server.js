import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 5050;

const server = app.listen(PORT, () => {
  console.log(`API berjalan di http://localhost:${PORT}/api`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} sudah dipakai aplikasi lain.\n` +
        `Ganti nilai PORT di backend/.env (dan proxy di frontend/vite.config.js), ` +
        `atau cek pemakainya dengan: lsof -i :${PORT}\n`,
    );
    process.exit(1);
  }
  throw err;
});
