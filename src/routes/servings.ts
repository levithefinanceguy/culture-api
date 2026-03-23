import { Router } from "express";
import db from "../data/database";
import { cache } from "../middleware/cache";

export const servingRoutes = Router();

const NUTRITION_FIELDS = [
  "calories",
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "total_carbohydrates",
  "dietary_fiber",
  "total_sugars",
  "protein",
  "vitamin_d",
  "calcium",
  "iron",
  "potassium",
] as const;

function scaleNutrition(row: any, factor: number) {
  const result: Record<string, number | null> = {};
  for (const field of NUTRITION_FIELDS) {
    const val = row[field];
    result[field] = val != null ? Math.round(val * factor * 100) / 100 : null;
  }
  return {
    calories: result.calories,
    totalFat: result.total_fat,
    saturatedFat: result.saturated_fat,
    transFat: result.trans_fat,
    cholesterol: result.cholesterol,
    sodium: result.sodium,
    totalCarbohydrates: result.total_carbohydrates,
    dietaryFiber: result.dietary_fiber,
    totalSugars: result.total_sugars,
    protein: result.protein,
    vitaminD: result.vitamin_d,
    calcium: result.calcium,
    iron: result.iron,
    potassium: result.potassium,
  };
}

// GET /api/v1/foods/:id/servings — Calculate nutrition for a custom serving
servingRoutes.get("/:id/servings", (req, res) => {
  const { id } = req.params;
  const servings = req.query.servings ? parseFloat(req.query.servings as string) : undefined;
  const slices = req.query.slices ? parseFloat(req.query.slices as string) : undefined;
  const amount = req.query.amount ? parseFloat(req.query.amount as string) : undefined;
  const unit = (req.query.unit as string) || "g";

  const cacheKey = `servings:${id}:${servings}:${slices}:${amount}:${unit}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const food = db.prepare("SELECT * FROM foods WHERE id = ?").get(id) as any;
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  let factor = 1;
  let description = "";

  if (slices != null) {
    // Calculate based on slices
    const totalSlices = food.servings_per_container;
    if (!totalSlices || totalSlices <= 0) {
      res.status(400).json({
        error: "This food does not have slice/serving container data. Use ?servings or ?amount instead.",
      });
      return;
    }
    // The stored nutrition is per serving (1 slice for pizza-type items)
    // servings_per_container = total slices in the whole item
    // So each slice = 1 serving worth of nutrition
    factor = slices;
    description = `${slices} slice${slices !== 1 ? "s" : ""}`;
  } else if (servings != null) {
    factor = servings;
    description = `${servings} serving${servings !== 1 ? "s" : ""}`;
  } else if (amount != null) {
    // Convert amount to a factor relative to the stored serving_size
    let amountInGrams = amount;
    if (unit === "oz") {
      amountInGrams = amount * 28.3495;
    } else if (unit === "ml") {
      amountInGrams = amount; // approximate 1ml = 1g for most foods
    } else if (unit === "kg") {
      amountInGrams = amount * 1000;
    } else if (unit === "lb") {
      amountInGrams = amount * 453.592;
    }

    if (food.serving_size > 0) {
      factor = amountInGrams / food.serving_size;
    }
    description = `${amount}${unit}`;
  } else {
    res.status(400).json({
      error: "Provide at least one of: ?servings=N, ?slices=N, or ?amount=N&unit=g",
    });
    return;
  }

  const nutrition = scaleNutrition(food, factor);

  const result = {
    id: food.id,
    name: food.name,
    brand: food.brand,
    sizeVariant: food.size_variant || null,
    requestedServing: description,
    scaleFactor: Math.round(factor * 1000) / 1000,
    baseServing: {
      size: food.serving_size,
      unit: food.serving_unit,
    },
    servingsPerContainer: food.servings_per_container || null,
    nutrition,
  };

  cache.set(cacheKey, result, 300);
  res.json(result);
});

// GET /api/v1/foods/sizes?q=pepperoni+pizza&brand=Papa+Johns — Get all size variants
servingRoutes.get("/sizes", (req, res) => {
  const query = req.query.q as string;
  const brand = req.query.brand as string;

  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const cacheKey = `sizes:${query}:${brand || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Search for foods matching the query that have size variants
  // Use FTS for the name match, then filter by brand and size_variant presence
  const ftsQuery = query.split(/\s+/).map((w) => `"${w}"*`).join(" ");

  const params: any = { q: ftsQuery };
  let brandClause = "";

  if (brand) {
    brandClause = " AND f.brand LIKE @brand";
    params.brand = `%${brand}%`;
  }

  // First, find foods with size_variant that match the query
  const sql = `
    SELECT f.* FROM foods f
    JOIN foods_fts fts ON f.rowid = fts.rowid
    WHERE foods_fts MATCH @q
      AND f.size_variant IS NOT NULL
      ${brandClause}
    ORDER BY f.name, f.size_variant
    LIMIT 50
  `;

  const foods = db.prepare(sql).all(params) as any[];

  if (foods.length === 0) {
    res.json({ item: query, brand: brand || null, sizes: [] });
    return;
  }

  // Group by parent_food_id or by name+brand combo
  const groups = new Map<string, any[]>();
  for (const food of foods) {
    const key = food.parent_food_id || `${food.name}::${food.brand || ""}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(food);
  }

  // Use the largest group (most likely the intended result)
  let bestGroup: any[] = [];
  groups.forEach((group) => {
    if (group.length > bestGroup.length) {
      bestGroup = group;
    }
  });

  const sizes = bestGroup.map((food) => {
    const totalSlices = food.servings_per_container;
    const perSlice = totalSlices
      ? scaleNutrition(food, 1)
      : null;
    const whole = totalSlices
      ? scaleNutrition(food, totalSlices)
      : scaleNutrition(food, food.servings_per_container || 1);

    return {
      id: food.id,
      size: food.size_variant,
      servingSize: food.serving_size,
      servingUnit: food.serving_unit,
      slices: totalSlices || null,
      per_slice: perSlice,
      whole,
    };
  });

  const representative = bestGroup[0];
  // Strip the size variant from the name for the item label
  let itemName = representative.name;
  if (representative.size_variant) {
    itemName = itemName.replace(new RegExp(`\\s*[-–]?\\s*${representative.size_variant}\\s*`, "i"), "").trim();
    // If stripping didn't change anything, just use the name as-is
    if (!itemName) itemName = representative.name;
  }

  const result = {
    item: itemName,
    brand: representative.brand || null,
    sizes,
  };

  cache.set(cacheKey, result, 300);
  res.json(result);
});
