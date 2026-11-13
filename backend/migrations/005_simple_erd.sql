-- =========================================================
-- 005_simple_erd.sql — ERD versi sederhana (docs/erd.md)
--
--  1. users       : role admin_pusat / admin / crew, + name, + is_active
--  2. inventories : + is_active
--  3. stock_movements, inventory_carts, histories (lama, belum berisi data)
--     diganti dengan:
--       stock_movements       — header semua jenis transaksi
--       stock_movement_items  — item transaksi + isi keranjang
--       histories             — timeline (+ action)
-- =========================================================

-- ---------------------------------------------------------
-- 0. Pengaman: tabel transaksi lama harus masih kosong
-- ---------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM stock_movements)
     OR EXISTS (SELECT 1 FROM inventory_carts)
     OR EXISTS (SELECT 1 FROM histories) THEN
    RAISE EXCEPTION 'Tabel stock_movements / inventory_carts / histories sudah berisi data. Migrasi 005 dihentikan supaya data tidak hilang.';
  END IF;
END $$;

-- ---------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------
-- Enum role baru dibuat sebagai tipe baru (ALTER TYPE ... ADD VALUE
-- tidak bisa langsung dipakai di dalam transaksi yang sama).
CREATE TYPE user_role_v2 AS ENUM ('admin_pusat', 'admin', 'crew');

ALTER TABLE users DROP CONSTRAINT crew_must_have_site;
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- Admin tanpa site → admin pusat; admin dengan site → admin site
ALTER TABLE users
  ALTER COLUMN role TYPE user_role_v2
  USING (CASE
           WHEN role::text = 'admin' AND site_id IS NULL THEN 'admin_pusat'
           ELSE role::text
         END)::user_role_v2;

DROP TYPE user_role;
ALTER TYPE user_role_v2 RENAME TO user_role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'crew';

ALTER TABLE users
  ADD COLUMN name      VARCHAR(100),
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users SET name = username WHERE name IS NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- admin_pusat tanpa site; admin & crew wajib punya site
ALTER TABLE users
  ADD CONSTRAINT users_role_site_check CHECK (
    (role = 'admin_pusat' AND site_id IS NULL)
    OR (role IN ('admin', 'crew') AND site_id IS NOT NULL)
  );

-- ---------------------------------------------------------
-- 2. INVENTORIES
-- ---------------------------------------------------------
ALTER TABLE inventories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_inventories_active ON inventories(is_active);

-- ---------------------------------------------------------
-- 3. Tabel transaksi lama → baru
-- ---------------------------------------------------------
DROP TABLE histories;
DROP TABLE inventory_carts;
DROP TABLE stock_movements;
DROP TYPE cart_status;
DROP TYPE movement_type;
DROP TYPE movement_status;

CREATE TYPE movement_type AS ENUM (
  'REQUEST',      -- Case 1: permintaan crew
  'RETURN',       -- Case 1: pengembalian / laporan sisa
  'GOODS_IN',     -- Case 2: barang masuk
  'TRANSFER',     -- Case 3: pemindahan permanen
  'LOAN',         -- Case 3b: peminjaman antar site
  'LOAN_RETURN',  -- Case 3b: pengembalian pinjaman
  'ADJUSTMENT',   -- Case 4: adjustment harian
  'OPNAME'        -- Case 4: stock opname
);

-- ---------- stock_movements (header) ----------
CREATE TABLE stock_movements (
  id                 SERIAL PRIMARY KEY,
  number             VARCHAR(50)    NOT NULL UNIQUE,
  type               movement_type  NOT NULL,
  status             VARCHAR(30)    NOT NULL,
  status_changed_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  site_id            INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  to_site_id         INT REFERENCES sites(id) ON DELETE RESTRICT,
  parent_id          INT REFERENCES stock_movements(id) ON DELETE RESTRICT,
  requester_id       INT REFERENCES users(id) ON DELETE RESTRICT,
  inventory_type     inventory_type,
  reason             VARCHAR(30),
  remarks            TEXT,
  id_user            INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Status yang valid untuk setiap jenis transaksi
  CONSTRAINT sm_status_check CHECK (
       (type = 'REQUEST'     AND status IN ('PENDING','APPROVED','PICKED_UP','COMPLETED','REJECTED','CANCELLED'))
    OR (type = 'RETURN'      AND status IN ('SUBMITTED','CONFIRMED','CANCELLED'))
    OR (type = 'GOODS_IN'    AND status IN ('COMPLETED'))
    OR (type = 'TRANSFER'    AND status IN ('IN_TRANSIT','COMPLETED','CANCELLED'))
    OR (type = 'LOAN'        AND status IN ('IN_TRANSIT','BORROWED','COMPLETED','CANCELLED'))
    OR (type = 'LOAN_RETURN' AND status IN ('IN_TRANSIT','RECEIVED'))
    OR (type = 'ADJUSTMENT'  AND status IN ('COMPLETED'))
    OR (type = 'OPNAME'      AND status IN ('IN_PROGRESS','SUBMITTED','APPROVED','CANCELLED'))
  ),
  -- Site tujuan: wajib (dan berbeda) untuk transfer & peminjaman
  CONSTRAINT sm_to_site_check CHECK (
    CASE WHEN type IN ('TRANSFER','LOAN','LOAN_RETURN')
         THEN to_site_id IS NOT NULL AND to_site_id <> site_id
         ELSE to_site_id IS NULL
    END
  ),
  -- Transaksi asal: wajib untuk pengembalian
  CONSTRAINT sm_parent_check CHECK (
    type NOT IN ('RETURN','LOAN_RETURN') OR parent_id IS NOT NULL
  ),
  -- Crew peminta: wajib untuk permintaan
  CONSTRAINT sm_requester_check CHECK (
    type <> 'REQUEST' OR requester_id IS NOT NULL
  ),
  -- Jenis barang: wajib untuk opname
  CONSTRAINT sm_inventory_type_check CHECK (
    (type = 'OPNAME') = (inventory_type IS NOT NULL)
  ),
  -- Alasan pilihan untuk permintaan
  CONSTRAINT sm_reason_check CHECK (
    reason IS NULL OR reason IN ('PEMAKAIAN_HARIAN','PERBAIKAN','PROYEK','LAINNYA')
  )
);

CREATE INDEX idx_sm_type_status  ON stock_movements(type, status);
CREATE INDEX idx_sm_site         ON stock_movements(site_id);
CREATE INDEX idx_sm_to_site      ON stock_movements(to_site_id);
CREATE INDEX idx_sm_parent       ON stock_movements(parent_id);
CREATE INDEX idx_sm_requester    ON stock_movements(requester_id);

-- Hanya satu opname aktif per site per jenis barang
CREATE UNIQUE INDEX sm_one_active_opname
  ON stock_movements(site_id, inventory_type)
  WHERE type = 'OPNAME' AND status IN ('IN_PROGRESS','SUBMITTED');

-- ---------- stock_movement_items (item + keranjang) ----------
CREATE TABLE stock_movement_items (
  id                 SERIAL PRIMARY KEY,
  movement_id        INT REFERENCES stock_movements(id) ON DELETE CASCADE,  -- NULL = di keranjang
  id_user            INT REFERENCES users(id) ON DELETE RESTRICT,           -- pemilik keranjang
  inventory_id       INT NOT NULL REFERENCES inventories(id) ON DELETE RESTRICT,
  dest_inventory_id  INT REFERENCES inventories(id) ON DELETE RESTRICT,     -- transfer: barang di site tujuan
  ref_item_id        INT REFERENCES stock_movement_items(id) ON DELETE RESTRICT, -- item asal
  quantity           INT,          -- arti tergantung jenis transaksi (lihat docs/erd.md)
  qty_approved       INT CHECK (qty_approved >= 0),
  qty_good           INT CHECK (qty_good     >= 0),
  qty_damaged        INT CHECK (qty_damaged  >= 0),
  qty_lost           INT CHECK (qty_lost     >= 0),
  qty_used           INT CHECK (qty_used     >= 0),
  qty_before         INT CHECK (qty_before   >= 0),
  qty_after          INT CHECK (qty_after    >= 0),
  reason             VARCHAR(30),
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Baris keranjang wajib punya pemilik dan jumlah > 0
  CONSTRAINT smi_cart_check CHECK (
    movement_id IS NOT NULL OR (id_user IS NOT NULL AND quantity > 0)
  ),
  -- Alasan pilihan untuk adjustment
  CONSTRAINT smi_reason_check CHECK (
    reason IS NULL OR reason IN ('RUSAK','HILANG','KOREKSI','DITEMUKAN','LAINNYA')
  )
);

CREATE INDEX idx_smi_movement   ON stock_movement_items(movement_id);
CREATE INDEX idx_smi_inventory  ON stock_movement_items(inventory_id);
CREATE INDEX idx_smi_ref        ON stock_movement_items(ref_item_id);

-- Keranjang: satu barang hanya satu baris per user
CREATE UNIQUE INDEX smi_cart_unique
  ON stock_movement_items(id_user, inventory_id)
  WHERE movement_id IS NULL;

-- ---------- histories (timeline) ----------
CREATE TABLE histories (
  id          SERIAL PRIMARY KEY,
  id_sm       INT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  action      VARCHAR(30) NOT NULL,   -- CREATED, APPROVED, REJECTED, PICKED_UP, ...
  status      VARCHAR(30),            -- status transaksi setelah aksi
  remarks     TEXT,
  id_user     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_histories_sm ON histories(id_sm);

-- ---------- Trigger updated_at ----------
CREATE TRIGGER trg_stock_movements_updated      BEFORE UPDATE ON stock_movements      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stock_movement_items_updated BEFORE UPDATE ON stock_movement_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_histories_updated            BEFORE UPDATE ON histories            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
