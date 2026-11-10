/**
 * Wrapper fetch untuk memanggil backend.
 * - Otomatis menambahkan header Authorization dari token di localStorage.
 * - Melempar Error berisi pesan dari backend jika status bukan 2xx.
 */
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'inventory_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = tokenStorage.get();
  const isForm = body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(!isForm && body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) tokenStorage.clear();
    throw new Error(data?.message || `Request gagal (${res.status})`);
  }
  return data;
}
