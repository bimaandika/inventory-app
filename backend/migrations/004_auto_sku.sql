-- =========================================================
-- 004_auto_sku.sql — SKU otomatis
-- Format: MEGS-<kode site>-<kode jenis>-<nomor urut>
--   kode jenis : NON_CONSUMABLE = ET, CONSUMABLE = SM
--   nomor urut : per site per jenis, minimal 3 digit (001, 002, ... 999, 1000)
-- Contoh     : MEGS-GMG-ET-001
-- =========================================================

-- 1. Kode site (huruf besar/angka, maks 10 karakter, unik)
ALTER TABLE sites ADD COLUMN code VARCHAR(10);

-- Site yang sudah ada diberi kode sesuai aturan; nama lain dapat kode sementara "S<id>"
UPDATE sites
   SET code = CASE LOWER(TRIM(name))
                WHEN 'gunung megang'  THEN 'GMG'
                WHEN 'poms rimau'     THEN 'POMS'
                WHEN 'geg rimau'      THEN 'GEG'
                WHEN 'fol'            THEN 'FOL'
                WHEN 'genset tarakan' THEN 'TRK'
              END;
UPDATE sites SET code = 'S' || id WHERE code IS NULL;

ALTER TABLE sites
  ALTER COLUMN code SET NOT NULL,
  ADD CONSTRAINT sites_code_unique UNIQUE (code),
  ADD CONSTRAINT sites_code_format CHECK (code ~ '^[A-Z0-9]{1,10}$');

-- 2. Penghitung nomor urut terakhir per site per jenis.
--    Dipakai dengan INSERT ... ON CONFLICT supaya aman saat dua request bersamaan,
--    dan nomor yang pernah dipakai tidak dipakai ulang walaupun barangnya dihapus.
CREATE TABLE sku_sequences (
  site_id      INT            NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type         inventory_type NOT NULL,
  last_number  INT            NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, type)
);

-- 3. Buat ulang SKU barang yang sudah ada dengan format baru (urut berdasarkan id)
WITH numbered AS (
  SELECT i.id, i.site_id, i.type,
         ROW_NUMBER() OVER (PARTITION BY i.site_id, i.type ORDER BY i.id) AS n
    FROM inventories i
)
UPDATE inventories i
   SET sku = 'MEGS-' || s.code || '-'
             || CASE n.type WHEN 'NON_CONSUMABLE' THEN 'ET' ELSE 'SM' END || '-'
             || CASE WHEN n.n < 1000 THEN LPAD(n.n::text, 3, '0') ELSE n.n::text END
  FROM numbered n
  JOIN sites s ON s.id = n.site_id
 WHERE i.id = n.id;

INSERT INTO sku_sequences (site_id, type, last_number)
SELECT site_id, type, COUNT(*)
  FROM inventories
 GROUP BY site_id, type;
