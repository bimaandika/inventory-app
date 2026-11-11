-- =========================================================
-- 003_merge_stocks_into_inventories.sql
-- Menggabungkan tabel stocks ke inventories.
-- Setelah migrasi ini, 1 baris inventories = 1 barang di 1 site,
-- berisi: name, unit, type, description, category_id,
--         site_id, sku, image, quantity.
--
-- Data lama dipertahankan:
--   - Barang yang punya stok: stok pertama digabung ke baris barangnya,
--     stok di site lain menjadi baris inventories baru (salinan data barang).
--   - Barang yang belum punya stok: ditempatkan di site dengan id terkecil,
--     quantity 0, dan SKU otomatis "INV-00001" (silakan sesuaikan manual).
--   - inventory_carts.id_stock diganti inventory_carts.id_inventory.
-- =========================================================

-- 1. Kolom baru (sementara boleh NULL selama data dipindahkan)
ALTER TABLE inventories
  ADD COLUMN site_id  INT REFERENCES sites(id) ON DELETE RESTRICT,
  ADD COLUMN sku      VARCHAR(50),
  ADD COLUMN image    VARCHAR(255),
  ADD COLUMN quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0);

-- Pemetaan stocks.id lama -> inventories.id baru (untuk inventory_carts)
CREATE TEMP TABLE stock_map (stock_id INT PRIMARY KEY, inventory_id INT NOT NULL) ON COMMIT DROP;

-- 2. Stok pertama tiap barang digabung ke baris barang itu sendiri
INSERT INTO stock_map (stock_id, inventory_id)
SELECT DISTINCT ON (inv_id) id, inv_id
  FROM stocks
 ORDER BY inv_id, id;

UPDATE inventories i
   SET site_id  = s.site_id,
       sku      = s.sku,
       image    = s.image,
       quantity = s.quantity
  FROM stocks s
  JOIN stock_map m ON m.stock_id = s.id
 WHERE i.id = s.inv_id;

-- 3. Stok di site lain -> baris inventories baru
DO $$
DECLARE
  s      RECORD;
  new_id INT;
BEGIN
  FOR s IN
    SELECT st.* FROM stocks st
     WHERE st.id NOT IN (SELECT stock_id FROM stock_map)
     ORDER BY st.id
  LOOP
    INSERT INTO inventories
      (name, unit, type, description, category_id, site_id, sku, image, quantity, created_at)
    SELECT name, unit, type, description, category_id,
           s.site_id, s.sku, s.image, s.quantity, s.created_at
      FROM inventories
     WHERE id = s.inv_id
    RETURNING id INTO new_id;

    INSERT INTO stock_map (stock_id, inventory_id) VALUES (s.id, new_id);
  END LOOP;

  -- 4. Barang yang belum punya stok -> site dengan id terkecil
  IF EXISTS (SELECT 1 FROM inventories WHERE site_id IS NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM sites) THEN
      RAISE EXCEPTION 'Ada data inventories tanpa site, tetapi tabel sites masih kosong. Buat minimal 1 site, lalu jalankan "npm run migrate" lagi.';
    END IF;
    UPDATE inventories
       SET site_id = (SELECT MIN(id) FROM sites)
     WHERE site_id IS NULL;
  END IF;
END $$;

UPDATE inventories
   SET sku = 'INV-' || LPAD(id::text, 5, '0')
 WHERE sku IS NULL;

-- 5. inventory_carts: id_stock -> id_inventory
ALTER TABLE inventory_carts
  ADD COLUMN id_inventory INT REFERENCES inventories(id) ON DELETE RESTRICT;

UPDATE inventory_carts c
   SET id_inventory = m.inventory_id
  FROM stock_map m
 WHERE m.stock_id = c.id_stock;

ALTER TABLE inventory_carts ALTER COLUMN id_inventory SET NOT NULL;
ALTER TABLE inventory_carts DROP COLUMN id_stock;
CREATE INDEX idx_carts_inventory ON inventory_carts(id_inventory);

-- 6. Kunci aturan baru di inventories
ALTER TABLE inventories
  ALTER COLUMN site_id SET NOT NULL,
  ALTER COLUMN sku     SET NOT NULL,
  ADD CONSTRAINT inventories_sku_unique UNIQUE (sku);

-- Satu nama barang hanya boleh sekali per site (tidak peka huruf besar/kecil)
CREATE UNIQUE INDEX inventories_site_name_unique ON inventories (site_id, LOWER(name));
CREATE INDEX idx_inventories_site ON inventories(site_id);

-- 7. Tabel stocks tidak dipakai lagi
DROP TABLE stocks;
