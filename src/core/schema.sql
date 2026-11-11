-- Stamp Addict: local database schema (SQLite)
-- Version 1
--
-- Design rules
--   * Every descriptive field on a stamp is optional (NULL allowed).
--   * Pick-list fields are checked against fixed values so data stays
--     consistent and searchable; NULL always means "not recorded".
--   * Catalog numbers, photos and tags live in their own tables so a
--     stamp can have any number of each.
--   * IDs are text UUIDs so records can later sync between devices
--     without ID collisions (task 7.3).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Collections (albums / stock books the user organizes stamps into)
-- ---------------------------------------------------------------------
CREATE TABLE collections (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------
-- Sets: a stamp issue as published (e.g. "1869 Pictorial Issue"),
-- with the stamps it is expected to contain. Used for set completion.
-- ---------------------------------------------------------------------
CREATE TABLE stamp_sets (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  country      TEXT,
  year         INTEGER,
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE set_items (
  id              TEXT PRIMARY KEY,
  set_id          TEXT NOT NULL REFERENCES stamp_sets(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  label           TEXT NOT NULL,            -- e.g. "1c buff, Franklin"
  face_value      TEXT,
  catalog         TEXT CHECK (catalog IN ('scott','stanley_gibbons','michel','yvert_tellier','sakura','facit','other')),
  catalog_number  TEXT,
  UNIQUE (set_id, position)
);
CREATE INDEX idx_set_items_catalog ON set_items (catalog, catalog_number);

-- ---------------------------------------------------------------------
-- Stamps: one row per Stamp Card
-- ---------------------------------------------------------------------
CREATE TABLE stamps (
  id                 TEXT PRIMARY KEY,
  collection_id      TEXT REFERENCES collections(id) ON DELETE SET NULL,
  set_item_id        TEXT REFERENCES set_items(id) ON DELETE SET NULL,

  -- Identification
  country            TEXT,
  year               INTEGER CHECK (year IS NULL OR year BETWEEN 1840 AND 2100),
  issue_date         TEXT,                 -- ISO date, YYYY-MM-DD
  face_value         TEXT,                 -- as printed, e.g. "2½d", "60c"
  currency           TEXT,
  colors             TEXT,
  design_subject     TEXT,
  stamp_type         TEXT CHECK (stamp_type IN ('definitive','commemorative','airmail','postage_due','semi_postal','official','revenue','special_delivery','parcel_post','other')),
  designer           TEXT,
  engraver           TEXT,
  printer            TEXT,

  -- Physical and technical
  perf_horizontal    REAL CHECK (perf_horizontal IS NULL OR perf_horizontal BETWEEN 5 AND 20),
  perf_vertical      REAL CHECK (perf_vertical   IS NULL OR perf_vertical   BETWEEN 5 AND 20),
  separation         TEXT CHECK (separation IN ('perforated','imperforate','rouletted','die_cut','part_perforate')),
  watermark          TEXT,
  paper_type         TEXT CHECK (paper_type IN ('wove','laid','chalky','granite','quadrille','batonne','pelure','india','fluorescent','other')),
  printing_method    TEXT CHECK (printing_method IN ('engraved','lithography','photogravure','typography','offset','embossed','other')),
  gum                TEXT CHECK (gum IN ('original','regummed','no_gum','self_adhesive','ungummed')),
  tagging            TEXT CHECK (tagging IN ('untagged','tagged','phosphor_bands','fluorescent','other')),
  format             TEXT CHECK (format IN ('single','pair','strip','block','sheet','booklet_pane','coil','souvenir_sheet','cover','fdc','other')),
  width_mm           REAL,
  height_mm          REAL,

  -- Condition
  mint_status        TEXT CHECK (mint_status IN ('mnh','mh','mlh','mint_no_gum','used','cto')),
  centering          TEXT CHECK (centering IN ('superb','xf','vf','f','vg','g')),
  grade              INTEGER CHECK (grade IS NULL OR grade BETWEEN 1 AND 100),
  cancellation       TEXT,
  faults             TEXT,
  has_certificate    INTEGER CHECK (has_certificate IN (0,1)),

  -- Varieties
  error_variety      TEXT,
  plate_number       TEXT,
  overprint          TEXT,
  shade              TEXT,

  -- Collection management
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  purchase_price     REAL CHECK (purchase_price IS NULL OR purchase_price >= 0),
  purchase_currency  TEXT,
  purchase_date      TEXT,
  source             TEXT,
  estimated_value    REAL CHECK (estimated_value IS NULL OR estimated_value >= 0),
  storage_location   TEXT,
  for_trade          INTEGER NOT NULL DEFAULT 0 CHECK (for_trade IN (0,1)),
  notes              TEXT,

  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_stamps_collection ON stamps (collection_id);
CREATE INDEX idx_stamps_country_year ON stamps (country, year);
CREATE INDEX idx_stamps_set_item ON stamps (set_item_id);

-- ---------------------------------------------------------------------
-- Catalog numbers (a stamp can carry Scott, SG, Michel… at once)
-- ---------------------------------------------------------------------
CREATE TABLE catalog_numbers (
  id              TEXT PRIMARY KEY,
  stamp_id        TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  catalog         TEXT NOT NULL CHECK (catalog IN ('scott','stanley_gibbons','michel','yvert_tellier','sakura','facit','other')),
  catalog_label   TEXT,                     -- name when catalog = 'other'
  number          TEXT NOT NULL,            -- text: numbers like "C3a" or "J12"
  catalog_value   REAL CHECK (catalog_value IS NULL OR catalog_value >= 0),
  value_currency  TEXT,
  edition         TEXT,                     -- e.g. "2027"
  UNIQUE (stamp_id, catalog, number)
);
CREATE INDEX idx_catalog_lookup ON catalog_numbers (catalog, number);

-- ---------------------------------------------------------------------
-- Photos (front, back, close-ups, watermark, UV, certificate)
-- ---------------------------------------------------------------------
CREATE TABLE photos (
  id          TEXT PRIMARY KEY,
  stamp_id    TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('front','back','detail','watermark','uv','certificate')),
  uri         TEXT NOT NULL,                -- local file path / URL
  width       INTEGER,
  height      INTEGER,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Only one main front photo and one back photo per stamp
CREATE UNIQUE INDEX idx_photos_one_front_back ON photos (stamp_id, role) WHERE role IN ('front','back');
CREATE INDEX idx_photos_stamp ON photos (stamp_id, sort_order);

-- ---------------------------------------------------------------------
-- Topical / thematic tags (birds, ships, space…)
-- ---------------------------------------------------------------------
CREATE TABLE tags (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE stamp_tags (
  stamp_id  TEXT NOT NULL REFERENCES stamps(id) ON DELETE CASCADE,
  tag_id    TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (stamp_id, tag_id)
);
CREATE INDEX idx_stamp_tags_tag ON stamp_tags (tag_id);

-- ---------------------------------------------------------------------
-- Want list
-- ---------------------------------------------------------------------
CREATE TABLE want_list (
  id                 TEXT PRIMARY KEY,
  set_item_id        TEXT REFERENCES set_items(id) ON DELETE SET NULL,
  description        TEXT NOT NULL,
  country            TEXT,
  year               INTEGER,
  catalog            TEXT CHECK (catalog IN ('scott','stanley_gibbons','michel','yvert_tellier','sakura','facit','other')),
  catalog_number     TEXT,
  wanted_condition   TEXT CHECK (wanted_condition IN ('mnh','mh','mlh','mint_no_gum','used','cto','any')),
  max_price          REAL CHECK (max_price IS NULL OR max_price >= 0),
  priority           TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  notes              TEXT,
  acquired_stamp_id  TEXT REFERENCES stamps(id) ON DELETE SET NULL,
  acquired_at        TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_want_open ON want_list (acquired_stamp_id, priority);
CREATE INDEX idx_want_catalog ON want_list (catalog, catalog_number);
