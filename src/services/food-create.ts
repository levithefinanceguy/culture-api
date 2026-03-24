/**
 * Shared food creation logic — auto-calculates nutri-score, culture score,
 * allergens, and dietary tags.
 */
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { calculateNutriScore } from "./nutrition-score";
import { calculatePersonalHealthScore } from "./health-score";
import { detectAllergens, detectDietaryTags } from "./food-analysis";

export interface CreateFoodParams {
  name: string;
  category: string;
  servingSize: number;
  servingUnit: string;
  source: string;
  vendorId?: string;
  nutrition: {
    calories: number;
    total_fat: number;
    saturated_fat: number;
    trans_fat: number;
    cholesterol: number;
    sodium: number;
    total_carbohydrates: number;
    dietary_fiber: number;
    total_sugars: number;
    protein: number;
    vitamin_d?: number | null;
    calcium?: number | null;
    iron?: number | null;
    potassium?: number | null;
  };
  ingredientsText?: string | null;
  barcode?: string | null;
  brand?: string | null;
  parentFoodId?: string | null;
  cultureScoreOverride?: number | null;
}

/**
 * Create a food entry in the database with auto-calculated scores and tags.
 * Returns the new food ID.
 */
export function createFood(params: CreateFoodParams): string {
  const foodId = uuid();
  const n = params.nutrition;

  // Calculate nutri-score (normalize to per-100g for scoring)
  const portionGrams = params.servingSize || 100;
  const scale = portionGrams > 0 ? 100 / portionGrams : 1;
  const nutriScore = calculateNutriScore(
    {
      calories: n.calories * scale,
      totalSugars: n.total_sugars * scale,
      saturatedFat: n.saturated_fat * scale,
      sodium: n.sodium * scale,
      dietaryFiber: n.dietary_fiber * scale,
      protein: n.protein * scale,
    },
    params.category
  );

  // Auto-detect allergens and dietary tags from ingredients text
  const ingredientsStr = params.ingredientsText || "";
  const allergens = ingredientsStr ? detectAllergens(ingredientsStr) : [];
  const dietaryTags = ingredientsStr
    ? detectDietaryTags(ingredientsStr, {
        total_carbohydrates: n.total_carbohydrates,
        protein: n.protein,
        total_fat: n.total_fat,
        total_sugars: n.total_sugars,
        dietary_fiber: n.dietary_fiber,
      })
    : [];

  // Calculate culture score if not overridden
  const cultureScore =
    params.cultureScoreOverride !== undefined
      ? params.cultureScoreOverride
      : calculatePersonalHealthScore(n, null).score;

  db.prepare(
    `
    INSERT INTO foods (
      id, name, brand, category, serving_size, serving_unit, barcode, source, vendor_id,
      calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
      total_carbohydrates, dietary_fiber, total_sugars, protein,
      vitamin_d, calcium, iron, potassium,
      ingredients_text, allergens, dietary_tags,
      nutri_score, nutri_grade, culture_score, parent_food_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `
  ).run(
    foodId,
    params.name,
    params.brand || null,
    params.category,
    params.servingSize,
    params.servingUnit,
    params.barcode || null,
    params.source,
    params.vendorId || null,
    n.calories,
    n.total_fat,
    n.saturated_fat,
    n.trans_fat,
    n.cholesterol,
    n.sodium,
    n.total_carbohydrates,
    n.dietary_fiber,
    n.total_sugars,
    n.protein,
    n.vitamin_d ?? null,
    n.calcium ?? null,
    n.iron ?? null,
    n.potassium ?? null,
    ingredientsStr || null,
    allergens.length > 0 ? JSON.stringify(allergens) : null,
    dietaryTags.length > 0 ? dietaryTags.join(",") : null,
    nutriScore.score,
    nutriScore.grade,
    cultureScore,
    params.parentFoodId || null
  );

  return foodId;
}
