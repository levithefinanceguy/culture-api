import { Router } from "express";
import db from "../data/database";
import { cache } from "../middleware/cache";
import { calculateNutriScore } from "../services/nutrition-score";
import { normalizeQuery, fuzzyLikeSearch, fuzzyFTS5Search } from "../services/fuzzy-search";

export const foodRoutes = Router();

// Search foods (FTS5 with fuzzy fallback)
foodRoutes.get("/search", (req, res) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string;
  const grade = req.query.grade as string;
  const allergenFree = req.query.allergen_free as string;
  const dietary = req.query.dietary as string;
  const fuzzyEnabled = req.query.fuzzy !== "false";

  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const cacheKey = `search:${query}:${limit}:${offset}:${source || ""}:${grade || ""}:${allergenFree || ""}:${dietary || ""}:fuzzy=${fuzzyEnabled}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Use FTS5 for fast full-text search
  const ftsQuery = query.split(/\s+/).map((w) => `"${w}"*`).join(" ");

  const params: any = { limit, offset };
  const whereClauses: string[] = ["foods_fts MATCH @q"];

  // Custom ranking: combine FTS5 rank with preferences for
  // exact matches, shorter names, unbranded foods, and USDA source
  const rankExpr = `
      fts.rank
      + CASE WHEN lower(f.name) = lower(@rawQuery) THEN -1000 ELSE 0 END
      + CASE WHEN f.brand IS NULL OR f.brand = '' THEN -50 ELSE 0 END
      + CASE WHEN f.source = 'usda' THEN -30 ELSE 0 END
      + length(f.name) * 0.5`;

  params.q = ftsQuery;
  params.rawQuery = query;

  if (source) {
    whereClauses.push("f.source = @source");
    params.source = source;
  }

  // Build optional grade filter
  if (grade) {
    const grades = grade.split(",").map(g => g.trim().toUpperCase()).filter(g => /^[A-E]$/.test(g));
    if (grades.length > 0) {
      whereClauses.push(`f.nutri_grade IN (${grades.map((_, i) => `@grade${i}`).join(",")})`);
      grades.forEach((g, i) => { params[`grade${i}`] = g; });
    }
  }

  // Filter: exclude foods containing specific allergens
  if (allergenFree) {
    const allergens = allergenFree.split(",").map((a) => a.trim()).filter(Boolean);
    for (let i = 0; i < allergens.length; i++) {
      const paramName = `allergen_ex_${i}`;
      whereClauses.push(`(f.allergens IS NULL OR f.allergens NOT LIKE @${paramName})`);
      params[paramName] = `%${allergens[i]}%`;
    }
  }

  // Filter: require foods with specific dietary tags
  if (dietary) {
    const tags = dietary.split(",").map((t) => t.trim()).filter(Boolean);
    for (let i = 0; i < tags.length; i++) {
      const paramName = `diet_tag_${i}`;
      whereClauses.push(`f.dietary_tags LIKE @${paramName}`);
      params[paramName] = `%${tags[i]}%`;
    }
  }

  const whereStr = whereClauses.join(" AND ");

  const sql = `SELECT f.* FROM foods f
    JOIN foods_fts fts ON f.rowid = fts.rowid
    WHERE ${whereStr}
    ORDER BY (${rankExpr}) LIMIT @limit OFFSET @offset`;
  const countSql = `SELECT COUNT(*) as total FROM foods f
    JOIN foods_fts fts ON f.rowid = fts.rowid
    WHERE ${whereStr}`;

  let total: number;
  let foods: any[];

  try {
    total = (db.prepare(countSql).get(params) as any).total;
    foods = db.prepare(sql).all(params);
  } catch {
    total = 0;
    foods = [];
  }

  // Fast path: FTS5 found results
  if (foods.length > 0) {
    const result = { foods: foods.map(formatFood), total, limit, offset, did_you_mean: null as string | null };
    cache.set(cacheKey, result, 300);
    res.json(result);
    return;
  }

  // If fuzzy is disabled or there are extra filters, return empty
  if (!fuzzyEnabled || source || grade || allergenFree || dietary) {
    const result = { foods: [], total: 0, limit, offset, did_you_mean: null as string | null };
    res.json(result);
    return;
  }

  // Fuzzy fallback step 1: Try with expanded abbreviations via FTS5
  const normalized = normalizeQuery(query);
  if (normalized !== query.toLowerCase().trim()) {
    const expandedFtsQuery = normalized.split(/\s+/).map((w) => `"${w}"*`).join(" ");
    try {
      const expandedParams = { q: expandedFtsQuery, rawQuery: normalized, limit, offset };
      const expandedTotal = (db.prepare(
        `SELECT COUNT(*) as total FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q`
      ).get(expandedParams) as any).total;
      const expandedFoods = db.prepare(
        `SELECT f.* FROM foods f
         JOIN foods_fts fts ON f.rowid = fts.rowid
         WHERE foods_fts MATCH @q
         ORDER BY (${rankExpr}) LIMIT @limit OFFSET @offset`
      ).all(expandedParams);

      if (expandedFoods.length > 0) {
        const result = { foods: expandedFoods.map(formatFood), total: expandedTotal, limit, offset, did_you_mean: normalized };
        cache.set(cacheKey, result, 300);
        res.json(result);
        return;
      }
    } catch {}
  }

  // Fuzzy fallback step 2: LIKE search with abbreviation-expanded query
  const likeResult = fuzzyLikeSearch(query, limit, offset);
  if (likeResult.foods.length > 0) {
    const result = { foods: likeResult.foods.map(formatFood), total: likeResult.total, limit, offset, did_you_mean: likeResult.did_you_mean };
    cache.set(cacheKey, result, 300);
    res.json(result);
    return;
  }

  // Fuzzy fallback step 3: Generate typo variants and try FTS5 + LIKE
  const fuzzyResult = fuzzyFTS5Search(query, limit, offset);
  if (fuzzyResult.foods.length > 0) {
    const result = { foods: fuzzyResult.foods.map(formatFood), total: fuzzyResult.total, limit, offset, did_you_mean: fuzzyResult.did_you_mean };
    cache.set(cacheKey, result, 300);
    res.json(result);
    return;
  }

  // Nothing found
  const result = { foods: [], total: 0, limit, offset, did_you_mean: null as string | null };
  cache.set(cacheKey, result, 300);
  res.json(result);
});

// Get food by barcode
foodRoutes.get("/barcode/:code", (req, res) => {
  const cacheKey = `barcode:${req.params.code}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const food = db.prepare("SELECT * FROM foods WHERE barcode = ?").get(req.params.code);
  if (!food) {
    res.status(404).json({ error: "Food not found for this barcode" });
    return;
  }

  const result = formatFood(food);
  cache.set(cacheKey, result, 600); // cache 10 min
  res.json(result);
});

// Get stats
foodRoutes.get("/stats", (_req, res) => {
  const cached = cache.get("stats");
  if (cached) {
    res.json(cached);
    return;
  }

  const total = (db.prepare("SELECT COUNT(*) as count FROM foods").get() as any).count;
  const bySource = db.prepare("SELECT source, COUNT(*) as count FROM foods GROUP BY source").all();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count FROM foods GROUP BY category ORDER BY count DESC LIMIT 20").all();

  const result = { total, bySource, topCategories: byCategory };
  cache.set("stats", result, 60); // cache 1 min
  res.json(result);
});

// Get top-scored foods (best nutrition)
foodRoutes.get("/top", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const category = req.query.category as string;

  const cacheKey = `top:${limit}:${offset}:${category || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  let where = "WHERE nutri_grade IS NOT NULL";
  const params: any = { limit, offset };

  if (category) {
    where += " AND category LIKE @category";
    params.category = `%${category}%`;
  }

  const total = (db.prepare(
    `SELECT COUNT(*) as total FROM foods ${where}`
  ).get(params) as any).total;

  const foods = db.prepare(
    `SELECT * FROM foods ${where} ORDER BY nutri_score ASC, calories ASC LIMIT @limit OFFSET @offset`
  ).all(params);

  const result = { foods: foods.map(formatFood), total, limit, offset };
  cache.set(cacheKey, result, 300);
  res.json(result);
});

// Get food by ID
foodRoutes.get("/:id", (req, res) => {
  const cacheKey = `food:${req.params.id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const food = db.prepare("SELECT * FROM foods WHERE id = ?").get(req.params.id);
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const ingredients = db.prepare(`
    SELECT ri.grams, f.name, f.id as ingredient_id,
           f.calories, f.protein, f.total_fat, f.total_carbohydrates
    FROM recipe_ingredients ri
    JOIN foods f ON f.id = ri.ingredient_food_id
    WHERE ri.food_id = ?
  `).all(req.params.id);

  const result = formatFood(food);
  if (ingredients.length > 0) {
    (result as any).recipe = ingredients;
  }

  cache.set(cacheKey, result, 600);
  res.json(result);
});

function formatFood(row: any) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    servingSize: row.serving_size,
    servingUnit: row.serving_unit,
    barcode: row.barcode,
    source: row.source,
    vendorId: row.vendor_id,
    ingredientsText: row.ingredients_text || null,
    allergens: row.allergens ? row.allergens.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    dietaryTags: row.dietary_tags ? row.dietary_tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    sizeVariant: row.size_variant || null,
    slicesPerServing: row.slices_per_serving || null,
    servingsPerContainer: row.servings_per_container || null,
    parentFoodId: row.parent_food_id || null,
    nutriScore: row.nutri_score,
    nutriGrade: row.nutri_grade,
    nutrition: {
      calories: row.calories,
      totalFat: row.total_fat,
      saturatedFat: row.saturated_fat,
      transFat: row.trans_fat,
      cholesterol: row.cholesterol,
      sodium: row.sodium,
      totalCarbohydrates: row.total_carbohydrates,
      dietaryFiber: row.dietary_fiber,
      totalSugars: row.total_sugars,
      protein: row.protein,
      vitaminD: row.vitamin_d,
      calcium: row.calcium,
      iron: row.iron,
      potassium: row.potassium,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
