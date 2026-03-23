import { Router } from "express";
import db from "../data/database";
import { cache } from "../middleware/cache";

export const foodRoutes = Router();

// Search foods (FTS5)
foodRoutes.get("/search", (req, res) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string;

  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const cacheKey = `search:${query}:${limit}:${offset}:${source || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Use FTS5 for fast full-text search
  const ftsQuery = query.split(/\s+/).map((w) => `"${w}"*`).join(" ");

  let sql: string;
  let countSql: string;
  const params: any = { limit, offset };

  if (source) {
    sql = `SELECT f.* FROM foods f
      JOIN foods_fts fts ON f.rowid = fts.rowid
      WHERE foods_fts MATCH @q AND f.source = @source
      ORDER BY fts.rank LIMIT @limit OFFSET @offset`;
    countSql = `SELECT COUNT(*) as total FROM foods f
      JOIN foods_fts fts ON f.rowid = fts.rowid
      WHERE foods_fts MATCH @q AND f.source = @source`;
    params.q = ftsQuery;
    params.source = source;
  } else {
    sql = `SELECT f.* FROM foods f
      JOIN foods_fts fts ON f.rowid = fts.rowid
      WHERE foods_fts MATCH @q
      ORDER BY fts.rank LIMIT @limit OFFSET @offset`;
    countSql = `SELECT COUNT(*) as total FROM foods f
      JOIN foods_fts fts ON f.rowid = fts.rowid
      WHERE foods_fts MATCH @q`;
    params.q = ftsQuery;
  }

  const total = (db.prepare(countSql).get(params) as any).total;
  const foods = db.prepare(sql).all(params);

  const result = { foods: foods.map(formatFood), total, limit, offset };
  cache.set(cacheKey, result, 300); // cache 5 min
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
