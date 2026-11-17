const { Op } = require('sequelize');
const { User, Site } = require('../models');
const { badRequest, notFound, conflict } = require('../helpers/httpError');
const { ROLES } = require('../middlewares/auth');
const {
  parseId,
  requireString,
  parseBoolean,
  parsePagination,
  paginated,
} = require('../helpers/validate');

/*
 * Kelola akun pengguna — khusus ADMIN PUSAT (diatur di routes).
 *
 * Aturan:
 * - admin_pusat tanpa site; admin (admin site) & crew wajib punya site.
 * - User tidak dihapus, tetapi dinonaktifkan (riwayat transaksinya tetap utuh).
 * - Admin pusat tidak bisa menonaktifkan / mengubah role dirinya sendiri.
 * - Harus selalu ada minimal satu admin pusat yang aktif.
 * - Username tidak bisa diubah setelah dibuat.
 * - Password di-hash otomatis oleh hook di models/user.js.
 */

const INCLUDE = [{ model: Site, as: 'site', attributes: ['id', 'name', 'code'] }];

async function findUser(id) {
  const user = await User.findByPk(id, { include: INCLUDE });
  if (!user) throw notFound('User tidak ditemukan');
  return user;
}

function parseRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (!ROLES.includes(role)) throw badRequest(`role harus salah satu dari: ${ROLES.join(', ')}`);
  return role;
}

/** Validasi kombinasi role + site, kembalikan siteId yang akan disimpan. */
async function resolveSite(role, rawSiteId) {
  const empty = rawSiteId === undefined || rawSiteId === null || rawSiteId === '';
  if (role === 'admin_pusat') {
    if (!empty) throw badRequest('Admin pusat tidak terikat ke site; kosongkan siteId');
    return null;
  }
  if (empty) throw badRequest('siteId wajib diisi untuk admin site dan crew');
  const siteId = parseId(rawSiteId, 'siteId');
  if (!(await Site.count({ where: { id: siteId } }))) throw badRequest('siteId tidak ditemukan');
  return siteId;
}

function readPassword(body, field) {
  const password = typeof body?.[field] === 'string' ? body[field] : '';
  if (password.length < 6) throw badRequest(`${field} minimal 6 karakter`);
  return password;
}

/** Pastikan masih ada admin pusat aktif lain selain user ini. */
async function ensureAnotherActivePusat(userId) {
  const others = await User.count({
    where: { role: 'admin_pusat', isActive: true, id: { [Op.ne]: userId } },
  });
  if (others === 0) throw conflict('Harus ada minimal satu admin pusat yang aktif');
}

/** GET /api/users?role=&siteId=&search=&includeInactive=&page=&limit= */
async function list(req, res) {
  const pagination = parsePagination(req.query);
  const search = (req.query.search || '').trim();
  const where = {};

  if (search) {
    where[Op.or] = [
      { username: { [Op.iLike]: `%${search}%` } },
      { name: { [Op.iLike]: `%${search}%` } },
    ];
  }
  if (req.query.role) where.role = parseRole(req.query.role);
  if (req.query.siteId) where.siteId = parseId(req.query.siteId, 'siteId');
  if (req.query.includeInactive !== 'true') where.isActive = true;

  const { rows, count } = await User.findAndCountAll({
    where,
    include: INCLUDE,
    order: [
      ['role', 'ASC'],
      ['name', 'ASC'],
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    distinct: true,
  });

  const filtered = Boolean(search || req.query.role || req.query.siteId);
  res.json(
    paginated(rows, count, pagination, {
      empty: 'Belum ada data user',
      emptyFiltered: 'Tidak ada user yang cocok dengan pencarian atau filter',
    }, filtered),
  );
}

/** GET /api/users/:id */
async function detail(req, res) {
  res.json({ data: await findUser(parseId(req.params.id)) });
}

/** POST /api/users — body: { username, name, password, role, siteId } */
async function create(req, res) {
  const username = requireString(req.body, 'username', { max: 50 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw badRequest('username 3–50 karakter: huruf kecil, angka, titik, garis bawah, atau strip');
  }
  const role = parseRole(req.body?.role);

  const user = await User.create({
    username,
    name: requireString(req.body, 'name', { max: 100 }),
    password: readPassword(req.body, 'password'),
    role,
    siteId: await resolveSite(role, req.body?.siteId),
  });

  res.status(201).json({ message: 'User berhasil dibuat', data: await findUser(user.id) });
}

/** PUT /api/users/:id — body: { name, role, siteId } (username & password tidak diubah di sini) */
async function update(req, res) {
  const user = await findUser(parseId(req.params.id));
  const name = requireString(req.body, 'name', { max: 100 });
  const role = parseRole(req.body?.role);
  const siteId = await resolveSite(role, req.body?.siteId);

  if (role !== user.role) {
    if (user.id === req.user.id) throw badRequest('Anda tidak bisa mengubah role akun Anda sendiri');
    if (user.role === 'admin_pusat' && user.isActive) await ensureAnotherActivePusat(user.id);
  }

  await user.update({ name, role, siteId: siteId });
  res.json({ message: 'User berhasil diperbarui', data: await findUser(user.id) });
}

/** PATCH /api/users/:id/password — body: { newPassword } (reset oleh admin pusat) */
async function resetPassword(req, res) {
  const user = await findUser(parseId(req.params.id));
  await user.update({ password: readPassword(req.body, 'newPassword') });
  res.json({ message: 'Password berhasil direset' });
}

/** PATCH /api/users/:id/active — body: { isActive: true | false } */
async function setActive(req, res) {
  const isActive = parseBoolean(req.body?.isActive, 'isActive');
  const user = await findUser(parseId(req.params.id));

  if (!isActive) {
    if (user.id === req.user.id) throw badRequest('Anda tidak bisa menonaktifkan akun Anda sendiri');
    if (user.role === 'admin_pusat') await ensureAnotherActivePusat(user.id);
  }

  await user.update({ isActive: isActive });
  res.json({
    message: isActive ? 'User diaktifkan kembali' : 'User dinonaktifkan',
    data: user,
  });
}

module.exports = { list, detail, create, update, resetPassword, setActive };
