import { Router } from "express";
import db from "../data/database";

export const foodRoutes = Router();

// Search foods
foodRoutes.get("/search", (req, res) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string; // filter by usda, vendor, community

  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  let sql = "SELECT * FROM foods WHERE name LIKE @q";
  const params: any = { q: `%${query}%`, limit, offset };

  if (source) {
    sql += " AND source = @source";
    params.source = source;
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
  const total = (db.prepare(countSql).get(params) as any).total;

  sql += " ORDER BY name LIMIT @limit OFFSET @offset";
  const foods = db.prepare(sql).all(params);

  res.json({
    foods: foods.map(formatFood),
    total,
    limit,
    offset,
  });
});

// Get food by barcode
foodRoutes.get("/barcode/:code", (req, res) => {
  const food = db.prepare("SELECT * FROM foods WHERE barcode = ?").get(req.params.code);
  if (!food) {
    res.status(404).json({ error: "Food not found for this barcode" });
    return;
  }
  res.json(formatFood(food));
});

// Get stats
foodRoutes.get("/stats", (_req, res) => {
  const total = (db.prepare("SELECT COUNT(*) as count FROM foods").get() as any).count;
  const bySource = db.prepare("SELECT source, COUNT(*) as count FROM foods GROUP BY source").all();
  const byCategory = db.prepare("SELECT category, COUNT(*) as count FROM foods GROUP BY category ORDER BY count DESC LIMIT 20").all();
  res.json({ total, bySource, topCategories: byCategory });
});

// Get food by ID
foodRoutes.get("/:id", (req, res) => {
  const food = db.prepare("SELECT * FROM foods WHERE id = ?").get(req.params.id);
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  // Include recipe ingredients if this is a vendor food
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
