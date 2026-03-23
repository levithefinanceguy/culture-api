import { Router } from "express";
import db from "../data/database";
import { cache } from "../middleware/cache";

export const alternativeRoutes = Router();

type Goal = "low_calorie" | "high_protein" | "low_fat" | "low_carb" | "low_sodium";

const VALID_GOALS: Goal[] = ["low_calorie", "high_protein", "low_fat", "low_carb", "low_sodium"];

const NUTRI_GRADE_ORDER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

// ─── GET /foods/:id/alternatives ─────────────────────────────────────────────
alternativeRoutes.get("/foods/:id/alternatives", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 25);
  const goal = req.query.goal as string | undefined;

  if (goal && !VALID_GOALS.includes(goal as Goal)) {
    res.status(400).json({
      error: `Invalid goal. Must be one of: ${VALID_GOALS.join(", ")}`,
    });
    return;
  }

  const cacheKey = `alternatives:${req.params.id}:${limit}:${goal || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const original = db
    .prepare("SELECT * FROM foods WHERE id = ?")
    .get(req.params.id) as any;

  if (!original) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const candidates = findAlternatives(original, limit, goal as Goal | undefined);

  const result = {
    original: formatFood(original),
    alternatives: candidates,
    goal: goal || null,
  };

  cache.set(cacheKey, result, 300);
  res.json(result);
});

// ─── GET /alternatives/category/:category ────────────────────────────────────
alternativeRoutes.get("/alternatives/category/:category", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const goal = req.query.goal as string | undefined;

  if (goal && !VALID_GOALS.includes(goal as Goal)) {
    res.status(400).json({
      error: `Invalid goal. Must be one of: ${VALID_GOALS.join(", ")}`,
    });
    return;
  }

  const category = decodeURIComponent(req.params.category);

  const cacheKey = `alt-category:${category}:${limit}:${goal || ""}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  let orderClause: string;
  switch (goal as Goal | undefined) {
    case "low_calorie":
      orderClause = "calories ASC, protein DESC";
      break;
    case "high_protein":
      orderClause =
        "CASE WHEN calories > 0 THEN protein / calories ELSE 0 END DESC, calories ASC";
      break;
    case "low_fat":
      orderClause = "total_fat ASC, calories ASC";
      break;
    case "low_carb":
      orderClause = "total_carbohydrates ASC, calories ASC";
      break;
    case "low_sodium":
      orderClause = "sodium ASC, calories ASC";
      break;
    default:
      orderClause = "nutri_score ASC, calories ASC";
  }

  const foods = db
    .prepare(
      `SELECT * FROM foods
       WHERE category = @category
         AND calories > 0
       ORDER BY ${orderClause}
       LIMIT @limit`
    )
    .all({ category, limit }) as any[];

  const result = {
    category,
    goal: goal || null,
    foods: foods.map(formatFood),
    total: foods.length,
  };

  cache.set(cacheKey, result, 300);
  res.json(result);
});

// ─── Core logic ──────────────────────────────────────────────────────────────

function findAlternatives(
  original: any,
  limit: number,
  goal?: Goal
): any[] {
  // Step 1: Find same-category candidates with a better (or equal) nutri grade
  const sameCategoryCandidates = db
    .prepare(
      `SELECT * FROM foods
       WHERE category = @category
         AND id != @id
         AND calories > 0
         AND (
           nutri_grade IS NOT NULL
           AND nutri_grade <= COALESCE(@nutri_grade, 'E')
         )
       ORDER BY nutri_score ASC, calories ASC
       LIMIT 200`
    )
    .all({
      category: original.category,
      id: original.id,
      nutri_grade: original.nutri_grade || "E",
    }) as any[];

  // Step 2: Score and rank each candidate
  let scored = sameCategoryCandidates
    .filter((c) => !isSameItem(original.name, c.name))
    .map((c) => scoreCandidate(original, c, goal, true));

  // Step 3: If we don't have enough, look in similar categories (broader search)
  if (scored.length < limit) {
    const needed = limit - scored.length;
    const existingIds = new Set([original.id, ...scored.map((s) => s._id)]);

    // Use first word of category for a broader match
    const categoryWords = original.category.split(/[\s,\/]+/).filter(Boolean);
    const broadCategory = categoryWords[0] || original.category;

    const broaderCandidates = db
      .prepare(
        `SELECT * FROM foods
         WHERE category LIKE @catPattern
           AND category != @exactCategory
           AND calories > 0
           AND (
             nutri_grade IS NOT NULL
             AND nutri_grade <= COALESCE(@nutri_grade, 'E')
           )
         ORDER BY nutri_score ASC, calories ASC
         LIMIT 200`
      )
      .all({
        catPattern: `%${broadCategory}%`,
        exactCategory: original.category,
        nutri_grade: original.nutri_grade || "E",
      }) as any[];

    const additional = broaderCandidates
      .filter((c) => !existingIds.has(c.id) && !isSameItem(original.name, c.name))
      .map((c) => scoreCandidate(original, c, goal, false))
      .sort((a, b) => b.score - a.score)
      .slice(0, needed);

    scored = scored.concat(additional);
  }

  // Final sort and limit
  scored.sort((a, b) => b.score - a.score);
  scored = scored.slice(0, limit);

  // Build response objects
  return scored.map(({ _id, ...entry }) => entry);
}

function scoreCandidate(
  original: any,
  candidate: any,
  goal: Goal | undefined,
  sameCategory: boolean
): any {
  const improvements: Record<string, any> = {};
  let score = 0;
  const reasons: string[] = [];

  const calDiff = original.calories > 0
    ? ((candidate.calories - original.calories) / original.calories) * 100
    : 0;
  const protDiff = original.protein > 0
    ? ((candidate.protein - original.protein) / original.protein) * 100
    : 0;
  const fatDiff = original.total_fat > 0
    ? ((candidate.total_fat - original.total_fat) / original.total_fat) * 100
    : 0;
  const carbDiff = original.total_carbohydrates > 0
    ? ((candidate.total_carbohydrates - original.total_carbohydrates) /
        original.total_carbohydrates) *
      100
    : 0;
  const sodiumDiff = original.sodium > 0
    ? ((candidate.sodium - original.sodium) / original.sodium) * 100
    : 0;

  // Track meaningful improvements
  if (calDiff < -10) {
    improvements.calories = {
      original: round(original.calories),
      alternative: round(candidate.calories),
      change: `${round(calDiff)}%`,
    };
    reasons.push(`${Math.abs(round(calDiff))}% fewer calories`);
  }

  if (protDiff > 10) {
    improvements.protein = {
      original: round(original.protein),
      alternative: round(candidate.protein),
      change: `+${round(protDiff)}%`,
    };
    reasons.push(`${round(protDiff)}% more protein`);
  } else if (Math.abs(protDiff) <= 10 && original.protein > 0) {
    reasons.push("similar protein");
  }

  if (fatDiff < -10) {
    improvements.totalFat = {
      original: round(original.total_fat),
      alternative: round(candidate.total_fat),
      change: `${round(fatDiff)}%`,
    };
    reasons.push(`${Math.abs(round(fatDiff))}% less fat`);
  }

  if (carbDiff < -10) {
    improvements.totalCarbohydrates = {
      original: round(original.total_carbohydrates),
      alternative: round(candidate.total_carbohydrates),
      change: `${round(carbDiff)}%`,
    };
    reasons.push(`${Math.abs(round(carbDiff))}% fewer carbs`);
  }

  if (sodiumDiff < -10) {
    improvements.sodium = {
      original: round(original.sodium),
      alternative: round(candidate.sodium),
      change: `${round(sodiumDiff)}%`,
    };
    reasons.push(`${Math.abs(round(sodiumDiff))}% less sodium`);
  }

  // Better nutri grade
  const origGrade = NUTRI_GRADE_ORDER[original.nutri_grade] || 5;
  const candGrade = NUTRI_GRADE_ORDER[candidate.nutri_grade] || 5;
  if (candGrade < origGrade) {
    improvements.nutriGrade = {
      original: original.nutri_grade,
      alternative: candidate.nutri_grade,
      change: `${original.nutri_grade} -> ${candidate.nutri_grade}`,
    };
    reasons.push(`better nutri-grade (${candidate.nutri_grade} vs ${original.nutri_grade})`);
  }

  // ── Calculate swap score (0-1) ──

  // Base: grade improvement
  const gradeBonus = Math.max(0, (origGrade - candGrade) * 0.15);
  score += gradeBonus;

  // Category match bonus
  if (sameCategory) score += 0.1;

  // Prefer unbranded/generic foods
  if (!candidate.brand || candidate.brand === "") score += 0.05;

  // Prefer USDA source
  if (candidate.source === "usda") score += 0.05;

  // Goal-specific scoring
  switch (goal) {
    case "low_calorie":
      if (calDiff < 0) score += Math.min(0.5, Math.abs(calDiff) / 100);
      // Bonus for maintaining protein
      if (protDiff >= -10) score += 0.1;
      break;
    case "high_protein":
      if (protDiff > 0) score += Math.min(0.5, protDiff / 100);
      // Protein per calorie ratio improvement
      const origProtPerCal = original.calories > 0 ? original.protein / original.calories : 0;
      const candProtPerCal = candidate.calories > 0 ? candidate.protein / candidate.calories : 0;
      if (candProtPerCal > origProtPerCal) score += 0.15;
      break;
    case "low_fat":
      if (fatDiff < 0) score += Math.min(0.5, Math.abs(fatDiff) / 100);
      break;
    case "low_carb":
      if (carbDiff < 0) score += Math.min(0.5, Math.abs(carbDiff) / 100);
      break;
    case "low_sodium":
      if (sodiumDiff < 0) score += Math.min(0.5, Math.abs(sodiumDiff) / 100);
      break;
    default:
      // General: reward overall improvement
      if (calDiff < 0) score += Math.min(0.2, Math.abs(calDiff) / 200);
      if (protDiff > 0) score += Math.min(0.15, protDiff / 200);
      if (fatDiff < 0) score += Math.min(0.1, Math.abs(fatDiff) / 200);
      if (carbDiff < 0) score += Math.min(0.1, Math.abs(carbDiff) / 200);
      if (sodiumDiff < 0) score += Math.min(0.05, Math.abs(sodiumDiff) / 200);
      break;
  }

  // Clamp score to 0-1
  score = Math.max(0, Math.min(1, score));

  // Build reason string
  const reason =
    reasons.length > 0 ? reasons.join(", ") : "similar nutritional profile with better nutri-grade";

  return {
    _id: candidate.id,
    food: formatFood(candidate),
    reason,
    improvements,
    score: round(score, 2),
  };
}

/**
 * Check if two food names are essentially the same item (to exclude trivial "swaps").
 * Uses normalized name overlap.
 */
function isSameItem(nameA: string, nameB: string): boolean {
  const normalize = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .sort()
      .join(" ");

  const a = normalize(nameA);
  const b = normalize(nameB);

  if (a === b) return true;

  // Check if one name fully contains the other (with some tolerance)
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  const overlap = wordsA.filter((w) => wordsB.includes(w)).length;
  const maxLen = Math.max(wordsA.length, wordsB.length);

  // If 80%+ words overlap, consider them the same item
  return maxLen > 0 && overlap / maxLen >= 0.8;
}

function round(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

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
    allergens: row.allergens
      ? row.allergens
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
    dietaryTags: row.dietary_tags
      ? row.dietary_tags
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
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
