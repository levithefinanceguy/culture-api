import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../culture.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT NOT NULL DEFAULT 'Uncategorized',
    serving_size REAL NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    barcode TEXT,
    source TEXT NOT NULL CHECK(source IN ('usda', 'vendor', 'community')),
    vendor_id TEXT,
    calories REAL NOT NULL DEFAULT 0,
    total_fat REAL NOT NULL DEFAULT 0,
    saturated_fat REAL NOT NULL DEFAULT 0,
    trans_fat REAL NOT NULL DEFAULT 0,
    cholesterol REAL NOT NULL DEFAULT 0,
    sodium REAL NOT NULL DEFAULT 0,
    total_carbohydrates REAL NOT NULL DEFAULT 0,
    dietary_fiber REAL NOT NULL DEFAULT 0,
    total_sugars REAL NOT NULL DEFAULT 0,
    protein REAL NOT NULL DEFAULT 0,
    vitamin_d REAL,
    calcium REAL,
    iron REAL,
    potassium REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('restaurant', 'food_truck', 'farmers_market', 'independent')),
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    lat REAL,
    lng REAL,
    api_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'enterprise')),
    requests_today INTEGER NOT NULL DEFAULT 0,
    last_request_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    food_id TEXT NOT NULL,
    ingredient_food_id TEXT NOT NULL,
    grams REAL NOT NULL,
    FOREIGN KEY (food_id) REFERENCES foods(id),
    FOREIGN KEY (ingredient_food_id) REFERENCES foods(id)
  );

  CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
  CREATE INDEX IF NOT EXISTS idx_foods_vendor ON foods(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source);
  CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);

  CREATE VIRTUAL TABLE IF NOT EXISTS foods_fts USING fts5(
    name, brand, category,
    content='foods',
    content_rowid='rowid'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS foods_ai AFTER INSERT ON foods BEGIN
    INSERT INTO foods_fts(rowid, name, brand, category)
    VALUES (new.rowid, new.name, new.brand, new.category);
  END;

  CREATE TRIGGER IF NOT EXISTS foods_ad AFTER DELETE ON foods BEGIN
    INSERT INTO foods_fts(foods_fts, rowid, name, brand, category)
    VALUES ('delete', old.rowid, old.name, old.brand, old.category);
  END;

  CREATE TRIGGER IF NOT EXISTS foods_au AFTER UPDATE ON foods BEGIN
    INSERT INTO foods_fts(foods_fts, rowid, name, brand, category)
    VALUES ('delete', old.rowid, old.name, old.brand, old.category);
    INSERT INTO foods_fts(rowid, name, brand, category)
    VALUES (new.rowid, new.name, new.brand, new.category);
  END;
`);

// Rebuild FTS index on startup to ensure it's in sync
db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

export default db;
