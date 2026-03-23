import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../culture.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Import scoring function
import { calculatePersonalHealthScore } from "../src/services/health-score";

// Add column if not exists
const cols = (db.prepare("PRAGMA table_info(foods)").all() as any[]).map((c: any) => c.name);
if (!cols.includes("culture_score")) {
  console.log("Adding culture_score column...");
  db.exec("ALTER TABLE foods ADD COLUMN culture_score INTEGER");
  db.exec("CREATE INDEX IF NOT EXISTS idx_foods_culture_score ON foods(culture_score)");
}

// Score all foods in batches
const BATCH_SIZE = 5000;
const total = (db.prepare("SELECT COUNT(*) as c FROM foods").get() as any).c;
console.log(`Scoring ${total} foods...\n`);

const update = db.prepare("UPDATE foods SET culture_score = ? WHERE id = ?");
const updateBatch = db.transaction((items: { id: string; score: number }[]) => {
  for (const item of items) update.run(item.score, item.id);
});

let processed = 0;
let offset = 0;

while (offset < total) {
  const foods = db.prepare("SELECT * FROM foods LIMIT ? OFFSET ?").all(BATCH_SIZE, offset) as any[];
  const batch: { id: string; score: number }[] = [];

  for (const food of foods) {
    const result = calculatePersonalHealthScore(food, null);
    batch.push({ id: food.id, score: result.score });
  }

  updateBatch(batch);
  processed += batch.length;

  if (processed % 50000 === 0 || processed === total) {
    console.log(`  ${processed}/${total} scored`);
  }

  offset += BATCH_SIZE;
}

// Stats
const distribution = db.prepare(`
  SELECT
    CASE
      WHEN culture_score >= 75 THEN 'Excellent (75-100)'
      WHEN culture_score >= 50 THEN 'Good (50-74)'
      WHEN culture_score >= 25 THEN 'Poor (25-49)'
      ELSE 'Bad (0-24)'
    END as band,
    COUNT(*) as count
  FROM foods
  GROUP BY band
  ORDER BY band
`).all();

console.log("\nScore distribution:");
for (const row of distribution as any[]) {
  console.log(`  ${row.band}: ${row.count}`);
}

const avg = (db.prepare("SELECT ROUND(AVG(culture_score), 1) as avg FROM foods").get() as any).avg;
console.log(`\nAverage Culture Score: ${avg}`);
console.log("Done!");
