/**
 * Shared food search function — the 5-strategy FTS5 search that was duplicated
 * across parse.ts, photo.ts, swaps.ts, recipe.ts, order.ts, and customize.ts.
 */
import db from "../data/database";
import { fuzzySearchSingle } from "./fuzzy-search";

export interface SearchFoodOptions {
  /** Brand/restaurant name — when provided, tries brand-filtered FTS first */
  brandFilter?: string;
  /** Penalize community-sourced entries in ranking (adds +20 to rank) */
  penalizeCommunity?: boolean;
}

/**
 * Search the foods table for the best match for a given query string.
 * Implements 5 strategies: FTS5 exact phrase, prefix match, OR logic,
 * LIKE fallback, and fuzzy fallback.
 */
export function searchFood(
  query: string,
  options?: SearchFoodOptions
): any | null {
  const cleanQuery = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  if (!cleanQuery) return null;

  const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);
  const penalizeCommunity = options?.penalizeCommunity ?? false;
  const brandFilter = options?.brandFilter;

  const rankExpr = `
      fts.rank
      + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
      + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
      + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
      ${penalizeCommunity ? "+ CASE WHEN f.source = 'community' THEN 20 ELSE 0 END" : ""}
      + length(f.name) * 0.5`;

  // If we have a brand/restaurant, try brand-filtered search first
  if (brandFilter) {
    const brandClean = brandFilter
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    // Brand-filtered FTS: exact phrase
    try {
      const phraseQuery = `"${words.join(" ")}"`;
      const result = db
        .prepare(
          `SELECT f.* FROM foods f
           JOIN foods_fts fts ON f.rowid = fts.rowid
           WHERE foods_fts MATCH @q AND lower(f.brand) LIKE @brand
           ORDER BY (${rankExpr})
           LIMIT 1`
        )
        .get({
          q: phraseQuery,
          rawQuery: cleanQuery,
          brand: `%${brandClean}%`,
        });
      if (result) return result;
    } catch {}

    // Brand-filtered FTS: prefix match
    try {
      const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
      const result = db
        .prepare(
          `SELECT f.* FROM foods f
           JOIN foods_fts fts ON f.rowid = fts.rowid
           WHERE foods_fts MATCH @q AND lower(f.brand) LIKE @brand
           ORDER BY (${rankExpr})
           LIMIT 1`
        )
        .get({
          q: ftsQuery,
          rawQuery: cleanQuery,
          brand: `%${brandClean}%`,
        });
      if (result) return result;
    } catch {}
  }

  // Strategy 1: exact phrase match
  try {
    const phraseQuery = `"${words.join(" ")}"`;
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: phraseQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 2: all words with prefix matching
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" ");
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 3: OR logic
  try {
    const ftsQuery = words.map((w) => `"${w}"*`).join(" OR ");
    const result = db
      .prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr})
         LIMIT 1`
      )
      .get({ q: ftsQuery, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 4: LIKE fallback
  try {
    const result = db
      .prepare(
        `SELECT * FROM foods
         WHERE lower(name) LIKE @pattern
         ORDER BY
           CASE WHEN lower(name) = lower(@rawQuery) THEN 0 ELSE 1 END,
           CASE WHEN brand IS NULL OR brand = '' THEN 0 ELSE 1 END,
           CASE WHEN source = 'usda' THEN 0 ELSE 1 END,
           length(name) ASC
         LIMIT 1`
      )
      .get({ pattern: `%${cleanQuery}%`, rawQuery: cleanQuery });
    if (result) return result;
  } catch {}

  // Strategy 5: Fuzzy search fallback
  try {
    const fuzzyResult = fuzzySearchSingle(cleanQuery);
    if (fuzzyResult.food) return fuzzyResult.food;
  } catch {}

  return null;
}
