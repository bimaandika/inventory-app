const { Site, User, Inventory } = require('../models');
const { badRequest, notFound, forbidden, conflict } = require('../helpers/httpError');
const { parseId, requireString } = require('../helpers/validate');
const { canViewSite } = require('../middlewares/auth');

/*
 * Setiap site punya `code` (misal GMG, POMS, GEG, FOL, TRK) yang dipakai
 * di SKU barang: MEGS-<code>-ET-001. Kode unik, huruf besar/angka, maks 10 karakter.
 *
 * Lihat: semua peran (crew hanya site sendiri). Kelola: admin pusat (diatur di routes).
 */

function readCode(body) {
  const code = requireString(body, 'code', { max: 10 }).toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(code)) {
    throw badRequest('code hanya boleh huruf dan angka tanpa spasi, maksimal 10 karakter');
  }
  return code;
}

async function findSite(id) {
  const site = await Site.findByPk(id);
  if (!site) throw notFound('Site tidak ditemukan');
  return site;
}

/** GET /api/sites — crew hanya melihat site-nya sendiri. */
async function list(req, res) {
  const where = req.user.role === 'crew' ? { id: req.user.site_id } : {};
  const sites = await Site.findAll({ where, order: [['name', 'ASC']] });
  res.json({ data: sites });
}

/** GET /api/sites/:id — termasuk jumlah user & barang di site tersebut. */
async function detail(req, res) {
  const id = parseId(req.params.id);
  if (!canViewSite(req.user, id)) throw forbidden('Anda hanya dapat melihat site Anda sendiri');

  const site = await findSite(id);
  const [totalUsers, totalItems] = await Promise.all([
    User.count({ where: { site_id: id } }),
    Inventory.count({ where: { site_id: id } }),
  ]);
  res.json({ data: { ...site.toJSON(), total_users: totalUsers, total_items: totalItems } });
}

/** POST /api/sites — body: { name, code } */
async function create(req, res) {
  const site = await Site.create({
    name: requireString(req.body, 'name', { max: 100 }),
    code: readCode(req.body),
  });
  res.status(201).json({ message: 'Site berhasil dibuat', data: site });
}

/**
 * PUT /api/sites/:id — body: { name, code }
 * Kode site tidak bisa diubah jika sudah dipakai di SKU barang.
 */
async function update(req, res) {
  const site = await findSite(parseId(req.params.id));
  const name = requireString(req.body, 'name', { max: 100 });
  const code = readCode(req.body);

  if (code !== site.code && (await Inventory.count({ where: { site_id: site.id } })) > 0) {
    throw conflict('Kode site tidak bisa diubah karena sudah dipakai di SKU barang');
  }

  await site.update({ name, code });
  res.json({ message: 'Site berhasil diperbarui', data: site });
}

/** DELETE /api/sites/:id — gagal (409) jika site masih punya user atau barang. */
async function remove(req, res) {
  const site = await findSite(parseId(req.params.id));
  await site.destroy();
  res.json({ message: 'Site berhasil dihapus' });
}

module.exports = { list, detail, create, update, remove };
