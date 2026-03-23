import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { calculateNutriScore } from "../services/nutrition-score";
import { detectAllergens, detectDietaryTags } from "../services/food-analysis";

export const mealRoutes = Router();

// GET /chains — List chains with component data
mealRoutes.get("/chains", (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT chain_name, COUNT(DISTINCT component_name) as component_count,
              COUNT(DISTINCT component_category) as category_count
       FROM meal_components
       GROUP BY chain_name
       ORDER BY chain_name`
    )
    .all() as any[];

  res.json({
    chains: rows.map((r) => ({
      name: r.chain_name,
      componentCount: r.component_count,
      categoryCount: r.category_count,
    })),
  });
});

// GET /components?chain=Chipotle — Get all components for a chain, grouped by category
mealRoutes.get("/components", (req: Request, res: Response) => {
  const chain = req.query.chain as string;

  if (!chain) {
    res.status(400).json({ error: "Query parameter 'chain' is required" });
    return;
  }

  const rows = db
    .prepare(
      `SELECT * FROM meal_components WHERE chain_name = ? ORDER BY component_category, component_name`
    )
    .all(chain) as any[];

  if (rows.length === 0) {
    res.status(404).json({ error: `No components found for chain '${chain}'` });
    return;
  }

  // Group by category, then by component name with portion variants
  const categories: Record<string, Record<string, any>> = {};

  for (const row of rows) {
    const cat = row.component_category;
    if (!categories[cat]) categories[cat] = {};

    const name = row.component_name;
    if (!categories[cat][name]) {
      categories[cat][name] = {
        name,
        portions: {},
      };
    }

    categories[cat][name].portions[row.portion_type] = {
      portionGrams: row.portion_grams,
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
      allergens: row.allergens
        ? row.allergens.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [],
      dietaryTags: row.dietary_tags
        ? row.dietary_tags.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [],
    };
  }

  // Convert inner objects to arrays
  const formatted: Record<string, any[]> = {};
  for (const [cat, components] of Object.entries(categories)) {
    formatted[cat] = Object.values(components);
  }

  res.json({ chain, categories: formatted });
});

// POST /build — Build a custom meal and get combined nutrition
mealRoutes.post("/build", (req: Request, res: Response) => {
  const { chain, name, components } = req.body;

  if (!chain) {
    res.status(400).json({ error: "'chain' is required" });
    return;
  }
  if (!components || !Array.isArray(components) || components.length === 0) {
    res.status(400).json({ error: "'components' array is required and must not be empty" });
    return;
  }

  const breakdown: any[] = [];
  const totals = {
    calories: 0,
    totalFat: 0,
    saturatedFat: 0,
    transFat: 0,
    cholesterol: 0,
    sodium: 0,
    totalCarbohydrates: 0,
    dietaryFiber: 0,
    totalSugars: 0,
    protein: 0,
    portionGrams: 0,
  };
  const allAllergens = new Set<string>();
  const errors: string[] = [];

  for (const comp of components) {
    const portion = comp.portion || "standard";

    const row = db
      .prepare(
        `SELECT * FROM meal_components WHERE chain_name = ? AND component_name = ? AND portion_type = ?`
      )
      .get(chain, comp.name, portion) as any;

    if (!row) {
      errors.push(`Component '${comp.name}' with portion '${portion}' not found for '${chain}'`);
      continue;
    }

    breakdown.push({
      name: row.component_name,
      category: row.component_category,
      portion: row.portion_type,
      portionGrams: row.portion_grams,
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
    });

    totals.calories += row.calories;
    totals.totalFat += row.total_fat;
    totals.saturatedFat += row.saturated_fat;
    totals.transFat += row.trans_fat;
    totals.cholesterol += row.cholesterol;
    totals.sodium += row.sodium;
    totals.totalCarbohydrates += row.total_carbohydrates;
    totals.dietaryFiber += row.dietary_fiber;
    totals.totalSugars += row.total_sugars;
    totals.protein += row.protein;
    totals.portionGrams += row.portion_grams;

    if (row.allergens) {
      row.allergens.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((a: string) => allAllergens.add(a));
    }
  }

  if (errors.length > 0 && breakdown.length === 0) {
    res.status(400).json({ errors });
    return;
  }

  // Round totals
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[key] = Math.round(totals[key] * 10) / 10;
  }

  // Calculate nutri-score for the combined meal (per 100g)
  const scale = totals.portionGrams > 0 ? 100 / totals.portionGrams : 1;
  const nutriScore = calculateNutriScore({
    calories: totals.calories * scale,
    totalSugars: totals.totalSugars * scale,
    saturatedFat: totals.saturatedFat * scale,
    sodium: totals.sodium * scale,
    dietaryFiber: totals.dietaryFiber * scale,
    protein: totals.protein * scale,
  });

  res.json({
    meal: {
      name: name || `Custom ${chain} Meal`,
      chain,
      componentCount: breakdown.length,
    },
    totals,
    nutriScore: nutriScore.score,
    nutriGrade: nutriScore.grade,
    allergens: Array.from(allAllergens),
    breakdown,
    ...(errors.length > 0 ? { warnings: errors } : {}),
  });
});

// POST /save — Build and save a custom meal to the foods table
mealRoutes.post("/save", (req: Request, res: Response) => {
  const { chain, name, components } = req.body;

  if (!chain) {
    res.status(400).json({ error: "'chain' is required" });
    return;
  }
  if (!name) {
    res.status(400).json({ error: "'name' is required when saving a meal" });
    return;
  }
  if (!components || !Array.isArray(components) || components.length === 0) {
    res.status(400).json({ error: "'components' array is required and must not be empty" });
    return;
  }

  // Gather nutrition totals
  const totals = {
    calories: 0,
    total_fat: 0,
    saturated_fat: 0,
    trans_fat: 0,
    cholesterol: 0,
    sodium: 0,
    total_carbohydrates: 0,
    dietary_fiber: 0,
    total_sugars: 0,
    protein: 0,
    portion_grams: 0,
  };
  const allAllergens = new Set<string>();
  const allIngredients: string[] = [];
  const componentNames: string[] = [];

  for (const comp of components) {
    const portion = comp.portion || "standard";

    const row = db
      .prepare(
        `SELECT * FROM meal_components WHERE chain_name = ? AND component_name = ? AND portion_type = ?`
      )
      .get(chain, comp.name, portion) as any;

    if (!row) {
      res.status(400).json({ error: `Component '${comp.name}' with portion '${portion}' not found for '${chain}'` });
      return;
    }

    componentNames.push(`${row.component_name} (${portion})`);
    totals.calories += row.calories;
    totals.total_fat += row.total_fat;
    totals.saturated_fat += row.saturated_fat;
    totals.trans_fat += row.trans_fat;
    totals.cholesterol += row.cholesterol;
    totals.sodium += row.sodium;
    totals.total_carbohydrates += row.total_carbohydrates;
    totals.dietary_fiber += row.dietary_fiber;
    totals.total_sugars += row.total_sugars;
    totals.protein += row.protein;
    totals.portion_grams += row.portion_grams;

    if (row.allergens) {
      row.allergens.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((a: string) => allAllergens.add(a));
    }
    if (row.ingredients_text) {
      allIngredients.push(row.ingredients_text);
    }
  }

  // Round
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[key] = Math.round(totals[key] * 10) / 10;
  }

  const ingredientsText = allIngredients.join("; ");
  const allergens = Array.from(allAllergens).join(",");
  const dietaryTags = detectDietaryTags(ingredientsText, {
    total_carbohydrates: totals.total_carbohydrates,
    protein: totals.protein,
    total_fat: totals.total_fat,
    total_sugars: totals.total_sugars,
    dietary_fiber: totals.dietary_fiber,
  }).join(",");

  const scale = totals.portion_grams > 0 ? 100 / totals.portion_grams : 1;
  const nutriScore = calculateNutriScore({
    calories: totals.calories * scale,
    totalSugars: totals.total_sugars * scale,
    saturatedFat: totals.saturated_fat * scale,
    sodium: totals.sodium * scale,
    dietaryFiber: totals.dietary_fiber * scale,
    protein: totals.protein * scale,
  });

  const foodId = uuid();

  db.prepare(`
    INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source,
      calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
      total_carbohydrates, dietary_fiber, total_sugars, protein,
      ingredients_text, allergens, dietary_tags, nutri_score, nutri_grade)
    VALUES (?, ?, ?, ?, ?, ?, 'community',
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?)
  `).run(
    foodId,
    name,
    chain,
    "Custom Meal",
    totals.portion_grams,
    "g",
    totals.calories,
    totals.total_fat,
    totals.saturated_fat,
    totals.trans_fat,
    totals.cholesterol,
    totals.sodium,
    totals.total_carbohydrates,
    totals.dietary_fiber,
    totals.total_sugars,
    totals.protein,
    ingredientsText || null,
    allergens || null,
    dietaryTags || null,
    nutriScore.score,
    nutriScore.grade
  );

  res.status(201).json({
    id: foodId,
    name,
    chain,
    components: componentNames,
    servingSize: totals.portion_grams,
    servingUnit: "g",
    nutrition: {
      calories: totals.calories,
      totalFat: totals.total_fat,
      saturatedFat: totals.saturated_fat,
      transFat: totals.trans_fat,
      cholesterol: totals.cholesterol,
      sodium: totals.sodium,
      totalCarbohydrates: totals.total_carbohydrates,
      dietaryFiber: totals.dietary_fiber,
      totalSugars: totals.total_sugars,
      protein: totals.protein,
    },
    nutriScore: nutriScore.score,
    nutriGrade: nutriScore.grade,
    allergens: Array.from(allAllergens),
    dietaryTags: dietaryTags ? dietaryTags.split(",") : [],
    message: "Meal saved to foods database",
  });
});
