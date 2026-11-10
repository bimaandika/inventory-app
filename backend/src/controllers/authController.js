import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { badRequest, unauthorized, notFound } from '../utils/httpError.js';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, site_id: user.site_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
  );
}

/** POST /api/auth/login */
export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) throw badRequest('Username dan password wajib diisi');

  const { rows } = await query(
    'SELECT id, username, password, role, site_id FROM users WHERE username = $1',
    [username],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized('Username atau password salah');
  }

  const { password: _omit, ...safeUser } = user;
  res.json({ token: signToken(user), user: safeUser });
}

/** GET /api/auth/me */
export async function me(req, res) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.role, u.site_id, s.name AS site_name
       FROM users u
       LEFT JOIN sites s ON s.id = u.site_id
      WHERE u.id = $1`,
    [req.user.id],
  );
  if (!rows[0]) throw notFound('User tidak ditemukan');
  res.json(rows[0]);
}

/** PATCH /api/auth/password */
export async function changePassword(req, res) {
  const { old_password, new_password } = req.body || {};
  if (!old_password || !new_password) throw badRequest('Password lama dan baru wajib diisi');
  if (new_password.length < 6) throw badRequest('Password baru minimal 6 karakter');

  const { rows } = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(old_password, rows[0].password))) {
    throw badRequest('Password lama salah');
  }

  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ message: 'Password berhasil diubah' });
}
