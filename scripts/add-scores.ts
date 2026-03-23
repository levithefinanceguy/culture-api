/**
 * Migration script: Add nutri_score and nutri_grade columns to the foods table,
 * then calculate and store scores for all existing foods.
 *
 * Usage: npx ts-node scripts/add-scores.ts
 */

import Database from "better-sqlite3";
import path from "path";

// Import the scoring function directly (avoid importing db which runs init logic)
import { calculateNutriScore } from "../src/services/nutrition-score";

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../culture.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const BATCH_SIZE = 5000;

function addColumnsIfNeeded() {
  // Check if columns already exist
  const columns = db.prepare("PRAGMA table_info(foods)").all() as any[];
  const columnNames = columns.map((c: any) => c.name);

  if (!columnNames.includes("nutri_score")) {
    console.log("Adding nutri_score column...");
    db.exec("ALTER TABLE foods ADD COLUMN nutri_score INTEGER");
  } else {
    console.log("nutri_score column already exists.");
  }

  if (!columnNames.includes("nutri_grade")) {
    console.log("Adding nutri_grade column...");
    db.exec("ALTER TABLE foods ADD COLUMN nutri_grade TEXT");
  } else {
    console.log("nutri_grade column already exists.");
  }
}

function calculateScores() {
  const total = (db.prepare("SELECT COUNT(*) as count FROM foods").get() as any).count;
  console.log(`Processing ${total} foods in batches of ${BATCH_SIZE}...`);

  const updateStmt = db.prepare(
    "UPDATE foods SET nutri_score = ?, nutri_grade = ? WHERE id = ?"
  );

  const updateBatch = db.transaction((foods: any[]) => {
    for (const food of foods) {
      const result = calculateNutriScore({
        calories: food.calories,
        totalSugars: food.total_sugars,
        saturatedFat: food.saturated_fat,
        sodium: food.sodium,
        dietaryFiber: food.dietary_fiber,
        protein: food.protein,
      }, food.category);

      updateStmt.run(result.score, result.grade, food.id);
    }
  });

  let processed = 0;
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  while (processed < total) {
    const foods = db.prepare(
      "SELECT id, calories, total_sugars, saturated_fat, sodium, dietary_fiber, protein, category FROM foods LIMIT ? OFFSET ?"
    ).all(BATCH_SIZE, processed) as any[];

    if (foods.length === 0) break;

    // Count grades for reporting
    for (const food of foods) {
      const result = calculateNutriScore({
        calories: food.calories,
        totalSugars: food.total_sugars,
        saturatedFat: food.saturated_fat,
        sodium: food.sodium,
        dietaryFiber: food.dietary_fiber,
        protein: food.protein,
      }, food.category);
      gradeCounts[result.grade] = (gradeCounts[result.grade] || 0) + 1;
    }

    updateBatch(foods);
    processed += foods.length;
    console.log(`  Processed ${processed}/${total} (${Math.round(processed / total * 100)}%)`);
  }

  console.log("\nGrade distribution:");
  for (const [grade, count] of Object.entries(gradeCounts)) {
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
    console.log(`  ${grade}: ${count} (${pct}%)`);
  }
}

// Run
console.log("=== Nutri-Score Migration ===\n");
addColumnsIfNeeded();
calculateScores();
console.log("\nDone.");

db.close();
