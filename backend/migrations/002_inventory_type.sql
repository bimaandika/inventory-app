-- =========================================================
-- 002_inventory_type.sql — Tambah jenis barang di inventories
--   CONSUMABLE     : barang habis pakai (sarung tangan, ATK, dll.)
--   NON_CONSUMABLE : barang tidak habis pakai (alat, perkakas, dll.)
-- =========================================================

CREATE TYPE inventory_type AS ENUM ('CONSUMABLE', 'NON_CONSUMABLE');

-- Barang yang sudah ada diisi CONSUMABLE dulu (ubah manual jika perlu),
-- lalu default dihapus supaya barang baru wajib menyebutkan jenisnya.
ALTER TABLE inventories
  ADD COLUMN type inventory_type NOT NULL DEFAULT 'CONSUMABLE';

ALTER TABLE inventories
  ALTER COLUMN type DROP DEFAULT;

CREATE INDEX idx_inventories_type ON inventories(type);
