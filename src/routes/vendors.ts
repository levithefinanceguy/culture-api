import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { generateApiKey } from "../middleware/auth";

export const vendorRoutes = Router();

// List vendors
vendorRoutes.get("/", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const city = req.query.city as string;
  const state = req.query.state as string;

  let sql = "SELECT id, name, type, address, city, state, zip, lat, lng, created_at FROM vendors WHERE 1=1";
  const params: any = { limit, offset };

  if (city) {
    sql += " AND city LIKE @city";
    params.city = `%${city}%`;
  }
  if (state) {
    sql += " AND state = @state";
    params.state = state;
  }

  const countSql = sql.replace(/SELECT .+ FROM/, "SELECT COUNT(*) as total FROM");
  const total = (db.prepare(countSql).get(params) as any).total;

  sql += " ORDER BY name LIMIT @limit OFFSET @offset";
  const vendors = db.prepare(sql).all(params);

  res.json({ vendors, total, limit, offset });
});

// Register a vendor
vendorRoutes.post("/register", (req, res) => {
  const { name, type, address, city, state, zip, lat, lng } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: "name and type are required" });
    return;
  }

  const validTypes = ["restaurant", "food_truck", "farmers_market", "independent"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }

  const id = uuid();
  const apiKey = generateApiKey();

  db.prepare(`
    INSERT INTO vendors (id, name, type, address, city, state, zip, lat, lng, api_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, address || null, city || null, state || null, zip || null, lat || null, lng || null, apiKey);

  // Also create an API key record for this vendor
  db.prepare(`
    INSERT INTO api_keys (key, owner, tier) VALUES (?, ?, 'free')
  `).run(apiKey, name);

  res.status(201).json({
    id,
    name,
    type,
    apiKey,
    message: "Vendor registered. Use your API key to submit menu items.",
  });
});

// Get vendor by ID
vendorRoutes.get("/:id", (req, res) => {
  const vendor = db.prepare(
    "SELECT id, name, type, address, city, state, zip, lat, lng, created_at FROM vendors WHERE id = ?"
  ).get(req.params.id);

  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json(vendor);
});

// Get vendor's foods
vendorRoutes.get("/:id/foods", (req, res) => {
  const vendor = db.prepare("SELECT id, name FROM vendors WHERE id = ?").get(req.params.id) as any;
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const foods = db.prepare("SELECT * FROM foods WHERE vendor_id = ?").all(req.params.id);
  res.json({ vendor: vendor.name, foods });
});

// Submit a menu item via recipe (ingredients + quantities)
vendorRoutes.post("/:id/foods", (req, res) => {
  const vendorId = req.params.id;
  const vendor = db.prepare("SELECT * FROM vendors WHERE id = ?").get(vendorId) as any;

  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  // Verify vendor API key
  const apiKey = req.headers["x-api-key"] as string;
  if (apiKey !== vendor.api_key) {
    res.status(403).json({ error: "Invalid API key for this vendor" });
    return;
  }

  const { name, category, servingSize, servingUnit, ingredients } = req.body;

  if (!name || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    res.status(400).json({
      error: "name and ingredients are required",
      example: {
        name: "Grilled Chicken Bowl",
        category: "Entrees",
        servingSize: 350,
        servingUnit: "g",
        ingredients: [
          { foodId: "usda-171077", grams: 200 },
          { foodId: "usda-168875", grams: 100 },
        ],
      },
    });
    return;
  }

  // Look up each ingredient and calculate nutrition
  const totals = {
    calories: 0, total_fat: 0, saturated_fat: 0, trans_fat: 0,
    cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0,
    total_sugars: 0, protein: 0, vitamin_d: 0, calcium: 0, iron: 0, potassium: 0,
  };

  const validIngredients: { foodId: string; grams: number }[] = [];

  for (const ing of ingredients) {
    const ingredientFood = db.prepare("SELECT * FROM foods WHERE id = ?").get(ing.foodId) as any;
    if (!ingredientFood) {
      res.status(400).json({ error: `Ingredient not found: ${ing.foodId}` });
      return;
    }

    const scale = ing.grams / 100; // USDA data is per 100g
    totals.calories += ingredientFood.calories * scale;
    totals.total_fat += ingredientFood.total_fat * scale;
    totals.saturated_fat += ingredientFood.saturated_fat * scale;
    totals.trans_fat += ingredientFood.trans_fat * scale;
    totals.cholesterol += ingredientFood.cholesterol * scale;
    totals.sodium += ingredientFood.sodium * scale;
    totals.total_carbohydrates += ingredientFood.total_carbohydrates * scale;
    totals.dietary_fiber += ingredientFood.dietary_fiber * scale;
    totals.total_sugars += ingredientFood.total_sugars * scale;
    totals.protein += ingredientFood.protein * scale;
    totals.vitamin_d += (ingredientFood.vitamin_d || 0) * scale;
    totals.calcium += (ingredientFood.calcium || 0) * scale;
    totals.iron += (ingredientFood.iron || 0) * scale;
    totals.potassium += (ingredientFood.potassium || 0) * scale;

    validIngredients.push({ foodId: ing.foodId, grams: ing.grams });
  }

  // Round all values
  for (const key of Object.keys(totals)) {
    (totals as any)[key] = Math.round((totals as any)[key] * 10) / 10;
  }

  const foodId = uuid();

  // Insert the food
  db.prepare(`
    INSERT INTO foods (
      id, name, category, serving_size, serving_unit, source, vendor_id,
      calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
      total_carbohydrates, dietary_fiber, total_sugars, protein,
      vitamin_d, calcium, iron, potassium
    ) VALUES (
      ?, ?, ?, ?, ?, 'vendor', ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    foodId, name, category || "Uncategorized", servingSize || 100, servingUnit || "g", vendorId,
    totals.calories, totals.total_fat, totals.saturated_fat, totals.trans_fat,
    totals.cholesterol, totals.sodium, totals.total_carbohydrates, totals.dietary_fiber,
    totals.total_sugars, totals.protein, totals.vitamin_d, totals.calcium,
    totals.iron, totals.potassium
  );

  // Insert recipe ingredients
  const insertIngredient = db.prepare(
    "INSERT INTO recipe_ingredients (id, food_id, ingredient_food_id, grams) VALUES (?, ?, ?, ?)"
  );
  for (const ing of validIngredients) {
    insertIngredient.run(uuid(), foodId, ing.foodId, ing.grams);
  }

  res.status(201).json({
    id: foodId,
    name,
    source: "vendor",
    vendorId,
    nutrition: totals,
    ingredientCount: validIngredients.length,
    message: "Food created. Nutrition calculated from USDA-verified ingredient data.",
  });
});
