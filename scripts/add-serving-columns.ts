/**
 * Migration: Add serving size/variant columns to the foods table.
 *
 * Adds: size_variant, slices_per_serving, servings_per_container, parent_food_id
 *
 * Usage:
 *   npx ts-node scripts/add-serving-columns.ts
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../culture.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

function addColumnsIfNeeded() {
  const columns = db.prepare("PRAGMA table_info(foods)").all() as any[];
  const colNames = new Set(columns.map((c: any) => c.name));

  const columnsToAdd: Array<{ name: string; type: string }> = [
    { name: "size_variant", type: "TEXT" },
    { name: "slices_per_serving", type: "INTEGER" },
    { name: "servings_per_container", type: "REAL" },
    { name: "parent_food_id", type: "TEXT REFERENCES foods(id)" },
  ];

  let added = 0;
  for (const col of columnsToAdd) {
    if (!colNames.has(col.name)) {
      console.log(`Adding column: ${col.name} (${col.type})`);
      db.exec(`ALTER TABLE foods ADD COLUMN ${col.name} ${col.type}`);
      added++;
    } else {
      console.log(`Column already exists: ${col.name}`);
    }
  }

  // Add indexes for the new columns
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_foods_parent ON foods(parent_food_id);
    CREATE INDEX IF NOT EXISTS idx_foods_size_variant ON foods(size_variant);
  `);

  return added;
}

console.log("=== Serving Size/Variant Migration ===\n");
const added = addColumnsIfNeeded();
console.log(`\nDone. ${added} column(s) added.`);

db.close();
