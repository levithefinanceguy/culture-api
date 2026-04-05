/**
 * Daily Cron Runner for Restaurant Chain Nutrition Scraping
 *
 * Checks for pending/stale chains and processes up to 400 per run.
 * Designed to be called from Railway cron, GitHub Actions, or any scheduler.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx npx ts-node scripts/cron-daily-scrape.ts
 */

import "dotenv/config";
import db from "../src/data/database";
import { scrapeQueue } from "./scrape-queue";

const DAILY_LIMIT = 400;

async function main(): Promise<void> {
  console.log(`[cron] Daily scrape started at ${new Date().toISOString()}`);

  // Check how many chains need processing
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'error') as errored,
        COUNT(*) FILTER (WHERE status = 'done' AND last_scraped < datetime('now', '-30 days')) as stale,
        COUNT(*) as total
      FROM restaurant_chains`
    )
    .get() as any;

  // SQLite may not support FILTER — use a fallback
  let pending: number, errored: number, stale: number, total: number;

  if (stats && typeof stats.pending === "number") {
    pending = stats.pending;
    errored = stats.errored;
    stale = stats.stale;
    total = stats.total;
  } else {
    // Fallback: individual queries
    pending = (
      db.prepare("SELECT COUNT(*) as c FROM restaurant_chains WHERE status = 'pending'").get() as any
    ).c;
    errored = (
      db.prepare("SELECT COUNT(*) as c FROM restaurant_chains WHERE status = 'error'").get() as any
    ).c;
    stale = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM restaurant_chains WHERE status = 'done' AND last_scraped < datetime('now', '-30 days')"
        )
        .get() as any
    ).c;
    total = (
      db.prepare("SELECT COUNT(*) as c FROM restaurant_chains").get() as any
    ).c;
  }

  console.log(`[cron] Chain stats: ${total} total, ${pending} pending, ${errored} errored, ${stale} stale`);

  const actionable = pending + errored + stale;
  if (actionable === 0) {
    console.log("[cron] No chains need processing. Exiting.");
    return;
  }

  console.log(`[cron] Processing up to ${DAILY_LIMIT} of ${actionable} actionable chains`);

  const result = await scrapeQueue(DAILY_LIMIT);

  console.log(`[cron] Daily scrape complete at ${new Date().toISOString()}`);
  console.log(`[cron] Results: ${result.succeeded} succeeded, ${result.failed} failed, ${result.totalItems} items`);

  // Log remaining work
  const remaining = (
    db
      .prepare(
        "SELECT COUNT(*) as c FROM restaurant_chains WHERE status = 'pending' OR status = 'error' OR (status = 'done' AND last_scraped < datetime('now', '-30 days'))"
      )
      .get() as any
  ).c;

  if (remaining > 0) {
    console.log(`[cron] ${remaining} chains still need processing in future runs`);
  } else {
    console.log("[cron] All chains are up to date");
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[cron] Fatal error:", err);
    process.exit(1);
  });
