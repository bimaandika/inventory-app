-- =========================================================
-- 001_init.sql — Skema awal Inventory App (ERD revisi)
-- =========================================================

-- ---------- ENUM ----------
CREATE TYPE user_role       AS ENUM ('admin', 'crew');
CREATE TYPE cart_status     AS ENUM ('in_cart', 'submitted');
CREATE TYPE movement_type   AS ENUM ('IN', 'OUT', 'ADJUSTMENT');
CREATE TYPE movement_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');

-- ---------- Trigger updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- sites ----------
CREATE TABLE sites (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- users ----------
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,              -- hash bcrypt
  role        user_role    NOT NULL DEFAULT 'crew',
  site_id     INT REFERENCES sites(id) ON DELETE RESTRICT,  -- NULL untuk admin
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- crew wajib terikat ke satu site
  CONSTRAINT crew_must_have_site CHECK (role = 'admin' OR site_id IS NOT NULL)
);

-- ---------- categories ----------
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- inventories (master barang) ----------
-- Catatan: kolom "desc" di ERD diganti "description" karena DESC adalah keyword SQL.
CREATE TABLE inventories (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  unit         VARCHAR(30)  NOT NULL,
  description  TEXT,
  category_id  INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- stocks (stok barang per site) ----------
CREATE TABLE stocks (
  id          SERIAL PRIMARY KEY,
  inv_id      INT NOT NULL REFERENCES inventories(id) ON DELETE RESTRICT,
  site_id     INT NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  sku         VARCHAR(50) NOT NULL UNIQUE,
  image       VARCHAR(255),                       -- path/URL foto kondisi barang di site ini
  quantity    INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stocks_inv_site_unique UNIQUE (inv_id, site_id)
);

-- ---------- stock_movements ----------
CREATE TABLE stock_movements (
  id          SERIAL PRIMARY KEY,
  type        movement_type   NOT NULL,
  reason      TEXT,
  status      movement_status NOT NULL DEFAULT 'pending',
  receipt     VARCHAR(50)     NOT NULL UNIQUE,
  id_user     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- inventory_carts ----------
CREATE TABLE inventory_carts (
  id          SERIAL PRIMARY KEY,
  status      cart_status NOT NULL DEFAULT 'in_cart',
  receipt     VARCHAR(50),                        -- terisi saat checkout
  quantity    INT NOT NULL CHECK (quantity > 0),
  id_stock    INT NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
  id_user     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  id_sm       INT REFERENCES stock_movements(id) ON DELETE SET NULL,  -- NULL sebelum checkout
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- histories ----------
CREATE TABLE histories (
  id          SERIAL PRIMARY KEY,
  date        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  status      movement_status NOT NULL,
  remarks     TEXT,
  id_sm       INT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  id_user     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   -- pelaku aksi
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Index untuk query yang sering dipakai ----------
CREATE INDEX idx_users_site            ON users(site_id);
CREATE INDEX idx_inventories_category  ON inventories(category_id);
CREATE INDEX idx_stocks_site           ON stocks(site_id);
CREATE INDEX idx_carts_user_status     ON inventory_carts(id_user, status);
CREATE INDEX idx_carts_sm              ON inventory_carts(id_sm);
CREATE INDEX idx_sm_user               ON stock_movements(id_user);
CREATE INDEX idx_sm_status             ON stock_movements(status);
CREATE INDEX idx_histories_sm          ON histories(id_sm);

-- ---------- Pasang trigger updated_at ke semua tabel ----------
CREATE TRIGGER trg_sites_updated            BEFORE UPDATE ON sites            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated            BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated       BEFORE UPDATE ON categories       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inventories_updated      BEFORE UPDATE ON inventories      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stocks_updated           BEFORE UPDATE ON stocks           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stock_movements_updated  BEFORE UPDATE ON stock_movements  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inventory_carts_updated  BEFORE UPDATE ON inventory_carts  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_histories_updated        BEFORE UPDATE ON histories        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
