const { Op, fn, col } = require('sequelize');
const { Category, Inventory } = require('../models');
const { notFound } = require('../helpers/httpError');
const { parseId, requireString } = require('../helpers/validate');

/* Lihat: semua peran. Kelola: admin pusat (diatur di routes). */

async function findCategory(id) {
  const category = await Category.findByPk(id);
  if (!category) throw notFound('Kategori tidak ditemukan');
  return category;
}

/** GET /api/categories?search= — termasuk jumlah barang per kategori. */
async function list(req, res) {
  const search = (req.query.search || '').trim();
  const categories = await Category.findAll({
    where: search ? { name: { [Op.iLike]: `%${search}%` } } : {},
    attributes: {
      include: [[fn('COUNT', col('inventories.id')), 'total_items']],
    },
    include: [{ model: Inventory, as: 'inventories', attributes: [] }],
    group: ['Category.id'],
    order: [['name', 'ASC']],
  });

  res.json({
    data: categories.map((c) => ({ ...c.toJSON(), total_items: Number(c.get('total_items')) })),
  });
}

/** GET /api/categories/:id */
async function detail(req, res) {
  res.json({ data: await findCategory(parseId(req.params.id)) });
}

/** POST /api/categories — body: { name } (nama unik) */
async function create(req, res) {
  const category = await Category.create({ name: requireString(req.body, 'name', { max: 100 }) });
  res.status(201).json({ message: 'Kategori berhasil dibuat', data: category });
}

/** PUT /api/categories/:id — body: { name } */
async function update(req, res) {
  const category = await findCategory(parseId(req.params.id));
  await category.update({ name: requireString(req.body, 'name', { max: 100 }) });
  res.json({ message: 'Kategori berhasil diperbarui', data: category });
}

/** DELETE /api/categories/:id — gagal (409) jika masih dipakai barang. */
async function remove(req, res) {
  const category = await findCategory(parseId(req.params.id));
  await category.destroy();
  res.json({ message: 'Kategori berhasil dihapus' });
}

module.exports = { list, detail, create, update, remove };
