import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { api } from './api/client.js';

function Home() {
  const [status, setStatus] = useState('memeriksa...');

  useEffect(() => {
    api('/health')
      .then((d) => setStatus(`terhubung (${d.status})`))
      .catch((e) => setStatus(`gagal: ${e.message}`));
  }, []);

  return (
    <main className="container">
      <h1>Inventory App</h1>
      <p>Status backend: <strong>{status}</strong></p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Halaman berikut akan ditambahkan bertahap:
          /login, /stocks, /cart, /requests (crew)
          /admin/users, /admin/inventories, /admin/approvals, ... (admin) */}
    </Routes>
  );
}
