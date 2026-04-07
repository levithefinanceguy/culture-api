import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || (
  // Use /tmp on Railway (volume mounts don't support SQLite file locking), local path for dev
  require("fs").existsSync("/app") ? "/tmp/culture.db" : path.join(__dirname, "../../culture.db")
);

const db = new Database(DB_PATH);

// Use DELETE journal mode — WAL requires shared memory which Railway volumes don't support
db.pragma("journal_mode = DELETE");

// PRAGMA optimizations for production performance
// cache_size: negative value = KiB. -64000 = ~64MB of page cache in memory
db.pragma("cache_size = -64000");
// temp_store: keep temporary tables and indices in memory instead of disk
db.pragma("temp_store = MEMORY");

// Note on prepared statement caching:
// better-sqlite3 automatically caches prepared statements internally.
// Calling db.prepare() with the same SQL string returns a cached statement,
// so there is no need to implement manual statement caching.

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
    ingredients_text TEXT,
    allergens TEXT,
    dietary_tags TEXT,
    nutri_score INTEGER,
    nutri_grade TEXT,
    culture_score INTEGER,
    glycemic_index INTEGER,
    glycemic_load REAL,
    size_variant TEXT,
    slices_per_serving INTEGER,
    servings_per_container REAL,
    parent_food_id TEXT,
    household_serving TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    FOREIGN KEY (parent_food_id) REFERENCES foods(id)
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
    tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free', 'pro', 'enterprise', 'admin')),
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

  CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('new_food', 'correction', 'barcode_add')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    food_id TEXT,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    reviewer_note TEXT,
    FOREIGN KEY (api_key) REFERENCES api_keys(key),
    FOREIGN KEY (food_id) REFERENCES foods(id)
  );

  CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
  CREATE INDEX IF NOT EXISTS idx_contributions_api_key ON contributions(api_key);

  CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode);
  CREATE INDEX IF NOT EXISTS idx_foods_vendor ON foods(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source);
  CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category);
  CREATE INDEX IF NOT EXISTS idx_foods_parent ON foods(parent_food_id);
  CREATE INDEX IF NOT EXISTS idx_foods_size_variant ON foods(size_variant);

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

  CREATE TABLE IF NOT EXISTS meal_components (
    id TEXT PRIMARY KEY,
    chain_name TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_category TEXT NOT NULL,
    portion_type TEXT NOT NULL DEFAULT 'standard',
    portion_grams REAL NOT NULL,
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
    ingredients_text TEXT,
    allergens TEXT,
    dietary_tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_meal_components_chain ON meal_components(chain_name);
  CREATE INDEX IF NOT EXISTS idx_meal_components_category ON meal_components(component_category);

  CREATE TABLE IF NOT EXISTS user_preferences (
    api_key TEXT PRIMARY KEY,
    avoid_ingredients TEXT,
    dietary_goals TEXT,
    health_conditions TEXT,
    calorie_target INTEGER,
    protein_target INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (api_key) REFERENCES api_keys(key)
  );

  CREATE TABLE IF NOT EXISTS restaurant_chains (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    nutrition_url TEXT,
    category TEXT DEFAULT 'Other',
    location_count INTEGER DEFAULT 0,
    last_scraped TEXT,
    item_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_restaurant_chains_status ON restaurant_chains(status);
`);

// Add household_serving column if missing (migration)
try {
  const cols = db.prepare("PRAGMA table_info(foods)").all() as any[];
  if (!cols.some((c: any) => c.name === "household_serving")) {
    db.exec("ALTER TABLE foods ADD COLUMN household_serving TEXT");
  }
} catch {}

// Add popularity column if missing (migration)
try {
  const cols2 = db.prepare("PRAGMA table_info(foods)").all() as any[];
  if (!cols2.some((c: any) => c.name === "popularity")) {
    db.exec("ALTER TABLE foods ADD COLUMN popularity INTEGER NOT NULL DEFAULT 0");
    db.exec("CREATE INDEX IF NOT EXISTS idx_foods_popularity ON foods(popularity DESC)");
  }
} catch {}

// Rebuild FTS index on startup to ensure it's in sync
db.exec("INSERT INTO foods_fts(foods_fts) VALUES('rebuild')");

export default db;
