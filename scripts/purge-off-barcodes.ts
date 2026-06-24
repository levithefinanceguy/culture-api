/**
 * Purge Open Food Facts-origin barcode rows from the Culture DB.
 *
 * Background: the /foods/barcode/:code route used to auto-import Open Food Facts
 * data into Culture. OFF data is crowd-sourced and frequently has wrong serving
 * sizes / calories. Those rows are keyed by a random UUID id with source="community"
 * (the app's accurate FatSecret contributions are keyed `barcode-{code}` instead),
 * so they are identifiable and safe to remove. Once deleted, the next scan of that
 * barcode returns 404 → the app falls through to FatSecret and re-seeds Culture with
 * a verified `barcode-{code}` row.
 *
 * Usage:
 *   npx ts-node scripts/purge-off-barcodes.ts            # dry run — lists candidates
 *   npx ts-node scripts/purge-off-barcodes.ts --apply    # backs up, then deletes
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../culture.db");
const APPLY = process.argv.includes("--apply");

// OFF auto-imports: have a barcode, source "community", and a UUID id
// (NOT the `barcode-{code}` id used by verified FatSecret contributions).
const WHERE = `
  barcode IS NOT NULL AND barcode != ''
  AND source = 'community'
  AND id NOT LIKE 'barcode-%'
`;

const db = new Database(DB_PATH);

const candidates = db
  .prepare(`SELECT id, name, brand, barcode, calories, serving_size FROM foods WHERE ${WHERE} ORDER BY name`)
  .all() as Array<{ id: string; name: string; brand: string; barcode: string; calories: number; serving_size: number }>;

console.log(`DB: ${DB_PATH}`);
console.log(`OFF-origin barcode rows found: ${candidates.length}\n`);
for (const c of candidates.slice(0, 50)) {
  console.log(`  ${c.barcode}  ${c.name}${c.brand ? ` (${c.brand})` : ""} — ${c.calories} cal / ${c.serving_size}g  [${c.id}]`);
}
if (candidates.length > 50) console.log(`  …and ${candidates.length - 50} more`);

if (!APPLY) {
  console.log(`\nDry run. Re-run with --apply to back up and delete these ${candidates.length} rows.`);
  process.exit(0);
}

if (candidates.length === 0) {
  console.log("\nNothing to delete.");
  process.exit(0);
}

// Back up before deleting
const backup = `${DB_PATH}.backup-purge-${new Date().toISOString().slice(0, 10)}`;
fs.copyFileSync(DB_PATH, backup);
console.log(`\nBacked up to: ${backup}`);

const result = db.prepare(`DELETE FROM foods WHERE ${WHERE}`).run();
console.log(`Deleted ${result.changes} OFF-origin barcode rows.`);
