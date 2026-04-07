import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import db from "../data/database";
import { cache } from "../middleware/cache";
import { normalizeQuery, fuzzyLikeSearch, fuzzyFTS5Search } from "../services/fuzzy-search";
import { formatFood } from "../services/food-format";
import { lookupBarcode as offLookupBarcode, searchFoods as offSearchFoods, OFFFood, OFF_ATTRIBUTION } from "../services/openfoodfacts";
import { calculateNutriScore } from "../services/nutrition-score";
import { calculatePersonalHealthScore } from "../services/health-score";
import { detectAllergens, detectDietaryTags } from "../services/food-analysis";
import { createFood } from "../services/food-create";
import { validateFoodData } from "../services/food-validation";
import { parseGeminiJson } from "../services/gemini-utils";

export const foodRoutes = Router();

/**
 * Format an Open Food Facts result for API response, auto-calculating
 * Culture Score, nutri-score, allergens, and dietary tags.
 */
function formatOFFFood(off: OFFFood) {
  // Calculate nutri-score (values are already per 100g from OFF)
  const nutriScore = calculateNutriScore(
    {
      calories: off.calories,
      totalSugars: off.total_sugars,
      saturatedFat: off.saturated_fat,
      sodium: off.sodium,
      dietaryFiber: off.dietary_fiber,
      protein: off.protein,
    },
    off.category || undefined
  );

  // Calculate Culture Score
  const cultureScore = calculatePersonalHealthScore(
    {
      calories: off.calories,
      protein: off.protein,
      dietary_fiber: off.dietary_fiber,
      saturated_fat: off.saturated_fat,
      total_sugars: off.total_sugars,
      sodium: off.sodium,
      trans_fat: off.trans_fat,
      total_fat: off.total_fat,
      total_carbohydrates: off.total_carbohydrates,
      cholesterol: off.cholesterol,
      ingredients_text: off.ingredients_text,
      category: off.category,
      name: off.name,
      brand: off.brand,
      vitamin_d: null,
      calcium: null,
      iron: null,
      potassium: null,
    },
    null
  );

  // Detect allergens and dietary tags from ingredients
  const allergens = off.ingredients_text ? detectAllergens(off.ingredients_text) : [];
  const dietaryTags = off.ingredients_text
    ? detectDietaryTags(off.ingredients_text, {
        total_carbohydrates: off.total_carbohydrates,
        protein: off.protein,
        total_fat: off.total_fat,
        total_sugars: off.total_sugars,
        dietary_fiber: off.dietary_fiber,
      })
    : [];

  return {
    name: off.name,
    brand: off.brand,
    category: off.category,
    barcode: off.barcode,
    servingSize: off.serving_size,
    servingUnit: off.serving_unit,
    source: "openfoodfacts" as const,
    provisional: true,
    ingredientsText: off.ingredients_text,
    allergens,
    dietaryTags,
    nutriScore: nutriScore.score,
    nutriGrade: nutriScore.grade,
    cultureScore: cultureScore.score,
    cultureScoreLabel: cultureScore.label,
    cultureScoreFlags: cultureScore.flags,
    nutrition: {
      calories: off.calories,
      totalFat: off.total_fat,
      saturatedFat: off.saturated_fat,
      transFat: off.trans_fat,
      cholesterol: off.cholesterol,
      sodium: off.sodium,
      totalCarbohydrates: off.total_carbohydrates,
      dietaryFiber: off.dietary_fiber,
      totalSugars: off.total_sugars,
      protein: off.protein,
    },
    nutriscoreGrade: off.nutriscore_grade,
    novaGroup: off.nova_group,
    imageUrl: off.image_url,
    attribution: OFF_ATTRIBUTION,
    message: "This result is from Open Food Facts. Verify and save to add it to Culture.",
  };
}

// --- AI web search fallback ---

const aiUpsertVendor = db.prepare(`
  INSERT INTO vendors (id, name, type, api_key)
  VALUES (?, ?, 'restaurant', ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name
`);

const aiUpsertFood = db.prepare(`
  INSERT INTO foods (id, name, brand, category, serving_size, serving_unit, source, vendor_id,
    calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
    total_carbohydrates, dietary_fiber, total_sugars, protein,
    nutri_score, nutri_grade, culture_score, dietary_tags)
  VALUES (@id, @name, @brand, @category, @serving_size, @serving_unit, 'vendor', @vendor_id,
    @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
    @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
    @nutri_score, @nutri_grade, @culture_score, @dietary_tags)
  ON CONFLICT(id) DO UPDATE SET
    calories=excluded.calories, total_fat=excluded.total_fat, saturated_fat=excluded.saturated_fat,
    trans_fat=excluded.trans_fat, cholesterol=excluded.cholesterol, sodium=excluded.sodium,
    total_carbohydrates=excluded.total_carbohydrates, dietary_fiber=excluded.dietary_fiber,
    total_sugars=excluded.total_sugars, protein=excluded.protein,
    serving_size=excluded.serving_size, serving_unit=excluded.serving_unit,
    updated_at=datetime('now')
`);

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Use Gemini with Google Search grounding to find nutrition for a food query.
 * Auto-inserts found items into the DB. Returns formatted food objects.
 */
async function aiSearchAndInsert(query: string): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const genAI = new GoogleGenerativeAI(apiKey);

  // Step 1: Web-grounded search for the food
  const searchModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
    tools: [{ googleSearch: {} }],
  } as any);

  const searchResult = await Promise.race([
    searchModel.generateContent(
      `Search for the exact published nutrition facts for "${query}". If this is a restaurant menu item, find the official nutrition data from the restaurant's website. If it's a generic food, find USDA or authoritative nutrition data. Include: calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrates, dietary fiber, total sugars, protein, and serving size. List all size variants if applicable (Small, Medium, Large).`
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI search timeout")), 15000)
    ),
  ]);
  const searchText = searchResult.response.text();
  if (searchText.length < 30) return [];

  // Step 2: Structure the data
  const formatModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0 },
  });

  const formatResult = await Promise.race([
    formatModel.generateContent(
      `Convert this nutrition data into a JSON array. Each item must have:
- name (string)
- brand (string or null — the restaurant/brand name if applicable)
- category (string, e.g. "Burgers", "Sides", "Drinks", "Snacks", "Grains")
- calories (integer, per serving as published)
- totalFat (number, grams)
- saturatedFat (number, grams)
- transFat (number, grams)
- cholesterol (number, mg)
- sodium (number, mg)
- totalCarbohydrates (number, grams)
- dietaryFiber (number, grams)
- totalSugars (number, grams)
- protein (number, grams)
- servingSize (number, grams — estimate if not given)

Return ONLY the JSON array.

Data:\n${searchText}`
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Format timeout")), 10000)
    ),
  ]);

  const items = parseGeminiJson(formatResult.response.text());
  if (!Array.isArray(items) || items.length === 0) return [];

  const results: any[] = [];

  for (const item of items) {
    if (!item.name || !item.calories) continue;

    const brand = item.brand || null;
    const sv = item.servingSize || 100;
    const factor = sv > 0 ? 100 / sv : 1;

    // Create vendor if brand exists
    let vendorId: string | null = null;
    if (brand) {
      const brandSlug = slugify(brand);
      vendorId = `vendor-${brandSlug}`;
      try { aiUpsertVendor.run(vendorId, brand, `key-${brandSlug}`); } catch {}
    }

    const itemSlug = slugify(item.name);
    const id = brand
      ? `chain-${slugify(brand)}-${itemSlug}`
      : `ai-${itemSlug}`;

    const nutriResult = calculateNutriScore(
      {
        calories: item.calories * factor,
        totalSugars: (item.totalSugars || 0) * factor,
        saturatedFat: (item.saturatedFat || 0) * factor,
        sodium: (item.sodium || 0) * factor,
        dietaryFiber: (item.dietaryFiber || 0) * factor,
        protein: (item.protein || 0) * factor,
      },
      item.category
    );

    const dietaryTags = detectDietaryTags("", {
      total_carbohydrates: item.totalCarbohydrates || 0,
      protein: item.protein || 0,
      total_fat: item.totalFat || 0,
      total_sugars: item.totalSugars || 0,
      dietary_fiber: item.dietaryFiber || 0,
    });

    // Insert into DB (per-100g)
    try {
      aiUpsertFood.run({
        id,
        name: item.name,
        brand,
        category: item.category || "Other",
        serving_size: sv,
        serving_unit: "g",
        vendor_id: vendorId,
        calories: item.calories * factor,
        total_fat: (item.totalFat || 0) * factor,
        saturated_fat: (item.saturatedFat || 0) * factor,
        trans_fat: (item.transFat || 0) * factor,
        cholesterol: (item.cholesterol || 0) * factor,
        sodium: (item.sodium || 0) * factor,
        total_carbohydrates: (item.totalCarbohydrates || 0) * factor,
        dietary_fiber: (item.dietaryFiber || 0) * factor,
        total_sugars: (item.totalSugars || 0) * factor,
        protein: (item.protein || 0) * factor,
        nutri_score: nutriResult.score,
        nutri_grade: nutriResult.grade,
        culture_score: 0,
        dietary_tags: dietaryTags.join(","),
      });
    } catch {}

    // Re-read from DB to get properly formatted result
    try {
      const dbFood = db.prepare("SELECT * FROM foods WHERE id = ?").get(id) as any;
      if (dbFood) {
        results.push(formatFood(dbFood));
        continue;
      }
    } catch {}

    // Fallback: return inline format
    results.push({
      id,
      name: item.name,
      brand,
      category: item.category || "Other",
      servingSize: sv,
      servingUnit: "g",
      source: "vendor",
      nutrition: {
        calories: item.calories * factor,
        totalFat: (item.totalFat || 0) * factor,
        saturatedFat: (item.saturatedFat || 0) * factor,
        transFat: (item.transFat || 0) * factor,
        cholesterol: (item.cholesterol || 0) * factor,
        sodium: (item.sodium || 0) * factor,
        totalCarbohydrates: (item.totalCarbohydrates || 0) * factor,
        dietaryFiber: (item.dietaryFiber || 0) * factor,
        totalSugars: (item.totalSugars || 0) * factor,
        protein: (item.protein || 0) * factor,
      },
      nutriGrade: nutriResult.grade,
    });
  }

  console.log(`[ai-search] "${query}" → ${results.length} items found and inserted`);
  return results;
}

// Search foods (FTS5 with fuzzy fallback, Open Food Facts as final fallback)
foodRoutes.get("/search", async (req, res) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const source = req.query.source as string;
  const grade = req.query.grade as string;
  const minScore = parseInt(req.query.min_score as string) || 0;
  const allergenFree = req.query.allergen_free as string;
  const dietary = req.query.dietary as string;
  const gi = req.query.gi as string;
  const fuzzyEnabled = req.query.fuzzy !== "false";

  if (!query) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  const cacheKey = `search:${query}:${limit}:${offset}:${source || ""}:${grade || ""}:${allergenFree || ""}:${dietary || ""}:${gi || ""}:fuzzy=${fuzzyEnabled}`;
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

  // Filter: glycemic index level (low, medium, high)
  if (gi) {
    const giLevels = gi.split(",").map((g: string) => g.trim().toLowerCase()).filter(Boolean);
    const giClauses: string[] = [];
    for (const level of giLevels) {
      if (level === "low") giClauses.push("(f.glycemic_index IS NOT NULL AND f.glycemic_index <= 55)");
      else if (level === "medium") giClauses.push("(f.glycemic_index IS NOT NULL AND f.glycemic_index >= 56 AND f.glycemic_index <= 69)");
      else if (level === "high") giClauses.push("(f.glycemic_index IS NOT NULL AND f.glycemic_index >= 70)");
    }
    if (giClauses.length > 0) {
      whereClauses.push(`(${giClauses.join(" OR ")})`);
    }
  }

  // Filter: minimum Culture Score
  if (minScore > 0) {
    whereClauses.push("f.culture_score >= @minScore");
    params.minScore = minScore;
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
    // When AI is enabled, check if results actually match the query well.
    // For multi-word queries like "cheese coney gold star", if the top results
    // only match "cheese" and miss "coney" or "gold star", fall through to AI.
    const aiEnabled = req.query.ai === "true";
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    if (aiEnabled && queryWords.length >= 2) {
      const topResults = foods.slice(0, 3);
      const hasGoodMatch = topResults.some(f => {
        const name = ((f as any).name || "").toLowerCase();
        const brand = ((f as any).brand || "").toLowerCase();
        const combined = `${name} ${brand}`;
        const matchedWords = queryWords.filter(w => combined.includes(w));
        // Need at least 60% of query words to match
        return matchedWords.length / queryWords.length >= 0.6;
      });

      if (!hasGoodMatch) {
        // Results don't match the query well — try AI search instead
        try {
          const aiResults = await aiSearchAndInsert(query);
          if (aiResults.length > 0) {
            const aiResult = {
              foods: aiResults,
              total: aiResults.length,
              limit,
              offset: 0,
              did_you_mean: null as string | null,
              source: "ai_search" as const,
              message: "Found via AI search and added to Culture.",
            };
            cache.set(cacheKey, aiResult, 300);
            res.json(aiResult);
            return;
          }
        } catch {
          // AI search failed — fall through to regular FTS results
        }
      }
    }

    const result = { foods: foods.map(formatFood), total, limit, offset, did_you_mean: null as string | null };
    cache.set(cacheKey, result, 300);
    res.json(result);
    return;
  }

  // If fuzzy is disabled or there are extra filters, return empty
  if (!fuzzyEnabled || source || grade || allergenFree || dietary || gi) {
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

  // Nothing found in Culture DB — try Open Food Facts as final fallback
  // Only use OFF fallback when there are no extra filters and fuzzy is enabled
  if (fuzzyEnabled && !source && !grade && !allergenFree && !dietary && !gi) {
    try {
      const offResults = await offSearchFoods(query, 10);
      if (offResults.length > 0) {
        const formattedOff = offResults.map(formatOFFFood);
        const offResult = {
          foods: formattedOff,
          total: formattedOff.length,
          limit,
          offset: 0,
          did_you_mean: null as string | null,
          source: "openfoodfacts" as const,
          attribution: OFF_ATTRIBUTION,
          message: "No results in Culture. Showing results from Open Food Facts — verify before saving.",
        };
        cache.set(cacheKey, offResult, 180);
        res.json(offResult);
        return;
      }
    } catch {
      // OFF search failed — fall through to empty result
    }
  }

  // AI web search fallback — find food via Gemini + Google Search grounding and auto-insert
  if (req.query.ai === "true" && fuzzyEnabled && !source) {
    try {
      const aiResults = await aiSearchAndInsert(query);
      if (aiResults.length > 0) {
        const aiResult = {
          foods: aiResults,
          total: aiResults.length,
          limit,
          offset: 0,
          did_you_mean: null as string | null,
          source: "ai_search" as const,
          message: "Found via AI search and added to Culture.",
        };
        cache.set(cacheKey, aiResult, 300);
        res.json(aiResult);
        return;
      }
    } catch {
      // AI search failed — fall through to empty result
    }
  }

  const result = { foods: [], total: 0, limit, offset, did_you_mean: null as string | null };
  cache.set(cacheKey, result, 300);
  res.json(result);
});

// Get food by barcode (with Open Food Facts fallback)
foodRoutes.get("/barcode/:code", async (req, res) => {
  const cacheKey = `barcode:${req.params.code}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Try Culture DB first
  const food = db.prepare("SELECT * FROM foods WHERE barcode = ?").get(req.params.code);
  if (food) {
    const result = formatFood(food);
    cache.set(cacheKey, result, 600);
    res.json(result);
    return;
  }

  // Fallback: Open Food Facts — auto-import if valid
  try {
    const offResult = await offLookupBarcode(req.params.code);
    if (offResult) {
      const nutrition = {
        name: offResult.name,
        calories: offResult.calories,
        total_fat: offResult.total_fat,
        saturated_fat: offResult.saturated_fat,
        protein: offResult.protein,
        total_carbohydrates: offResult.total_carbohydrates,
        total_sugars: offResult.total_sugars,
        sodium: offResult.sodium,
        dietary_fiber: offResult.dietary_fiber,
        serving_size: offResult.serving_size,
      };

      const validation = validateFoodData(nutrition);

      if (validation.valid) {
        // Auto-import: data is clean, save to Culture
        const foodId = createFood({
          name: offResult.name,
          category: offResult.category || "Uncategorized",
          servingSize: offResult.serving_size || 100,
          servingUnit: offResult.serving_unit || "g",
          source: "community",
          barcode: offResult.barcode,
          nutrition: {
            calories: offResult.calories, total_fat: offResult.total_fat,
            saturated_fat: offResult.saturated_fat, trans_fat: offResult.trans_fat || 0,
            cholesterol: offResult.cholesterol || 0, sodium: offResult.sodium,
            total_carbohydrates: offResult.total_carbohydrates,
            dietary_fiber: offResult.dietary_fiber, total_sugars: offResult.total_sugars,
            protein: offResult.protein, vitamin_d: 0, calcium: 0, iron: 0, potassium: 0,
          },
          ingredientsText: offResult.ingredients_text,
          brand: offResult.brand,
        });

        // Return the newly saved Culture food
        const saved = db.prepare("SELECT * FROM foods WHERE id = ?").get(foodId);
        if (saved) {
          const result = formatFood(saved);
          cache.set(cacheKey, result, 600);
          res.json(result);
          return;
        }
      } else {
        // Data failed validation — return as provisional, don't save
        const result = formatOFFFood(offResult);
        (result as any).validation_errors = validation.errors;
        cache.set(cacheKey, result, 180);
        res.json(result);
        return;
      }
    }
  } catch {
    // OFF lookup failed — fall through to 404
  }

  res.status(404).json({ error: "Food not found for this barcode" });
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

// Import a provisional Open Food Facts result into Culture's database
foodRoutes.post("/import", async (req, res) => {
  const { barcode, food: providedFood } = req.body as {
    barcode?: string;
    food?: OFFFood;
  };

  if (!barcode && !providedFood) {
    res.status(400).json({ error: "Provide either 'barcode' or 'food' in the request body" });
    return;
  }

  // Check if this barcode already exists in Culture DB
  const lookupCode = barcode || providedFood?.barcode;
  if (lookupCode) {
    const existing = db.prepare("SELECT id FROM foods WHERE barcode = ?").get(lookupCode);
    if (existing) {
      const full = db.prepare("SELECT * FROM foods WHERE barcode = ?").get(lookupCode);
      res.json({
        message: "Food already exists in Culture",
        food: formatFood(full),
        alreadyExisted: true,
      });
      return;
    }
  }

  // Get OFF data — either use provided food or look up by barcode
  let offFood: OFFFood | null = providedFood || null;
  if (!offFood && barcode) {
    try {
      offFood = await offLookupBarcode(barcode);
    } catch {
      res.status(502).json({ error: "Failed to fetch from Open Food Facts" });
      return;
    }
  }

  if (!offFood) {
    res.status(404).json({ error: "Food not found on Open Food Facts" });
    return;
  }

  // Save to Culture DB using the shared createFood function
  try {
    const foodId = createFood({
      name: offFood.name,
      category: offFood.category || "Uncategorized",
      servingSize: offFood.serving_size,
      servingUnit: offFood.serving_unit,
      source: "community",
      barcode: offFood.barcode,
      brand: offFood.brand,
      ingredientsText: offFood.ingredients_text,
      nutrition: {
        calories: offFood.calories,
        total_fat: offFood.total_fat,
        saturated_fat: offFood.saturated_fat,
        trans_fat: offFood.trans_fat,
        cholesterol: offFood.cholesterol,
        sodium: offFood.sodium,
        total_carbohydrates: offFood.total_carbohydrates,
        dietary_fiber: offFood.dietary_fiber,
        total_sugars: offFood.total_sugars,
        protein: offFood.protein,
      },
    });

    // Read back the saved food to return with all calculated fields
    const savedFood = db.prepare("SELECT * FROM foods WHERE id = ?").get(foodId);

    // Invalidate relevant caches
    if (offFood.barcode) cache.del(`barcode:${offFood.barcode}`);

    res.status(201).json({
      message: "Food imported from Open Food Facts and saved to Culture",
      food: formatFood(savedFood),
      attribution: OFF_ATTRIBUTION,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save food", details: err.message });
  }
});
