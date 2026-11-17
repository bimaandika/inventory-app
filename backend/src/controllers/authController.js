const { User, Site } = require('../models');
const { comparePassword } = require('../helpers/bcrypt');
const { signToken } = require('../helpers/jwt');
const { badRequest, unauthorized, forbidden, notFound } = require('../helpers/httpError');

/** Profil user beserta site-nya (password otomatis tidak ikut, lihat models/user.js). */
const findProfile = (id) =>
  User.findByPk(id, {
    attributes: ['id', 'username', 'name', 'role', 'siteId'],
    include: [{ model: Site, as: 'site', attributes: ['id', 'name', 'code'] }],
  });

/** POST /api/auth/login — body: { username, password } */
async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) throw badRequest('Username dan password wajib diisi');

  const user = await User.findOne({ where: { username: String(username).trim().toLowerCase() } });
  if (!user || !(await comparePassword(password, user.password))) {
    throw unauthorized('Username atau password salah');
  }
  if (!user.isActive) throw forbidden('Akun Anda sudah dinonaktifkan. Hubungi admin.');

  res.json({ token: signToken(user), user: await findProfile(user.id) });
}

/** GET /api/auth/me */
async function me(req, res) {
  const profile = await findProfile(req.user.id);
  if (!profile) throw notFound('User tidak ditemukan');
  res.json(profile);
}

/** PATCH /api/auth/password — body: { oldPassword, newPassword } */
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) throw badRequest('Password lama dan baru wajib diisi');
  if (String(newPassword).length < 6) throw badRequest('Password baru minimal 6 karakter');

  const user = await User.findByPk(req.user.id);
  if (!user || !(await comparePassword(oldPassword, user.password))) {
    throw badRequest('Password lama salah');
  }

  await user.update({ password: newPassword }); // di-hash oleh hook model
  res.json({ message: 'Password berhasil diubah' });
}

module.exports = { login, me, changePassword };
