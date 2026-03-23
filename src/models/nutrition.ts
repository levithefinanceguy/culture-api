import { NutritionInfo } from "./food";

// USDA nutrient IDs mapped to our fields
const NUTRIENT_MAP: Record<number, keyof NutritionInfo> = {
  1008: "calories",
  1004: "totalFat",
  1258: "saturatedFat",
  1257: "transFat",
  1253: "cholesterol",
  1093: "sodium",
  1005: "totalCarbohydrates",
  1079: "dietaryFiber",
  2000: "totalSugars",
  1003: "protein",
  1114: "vitaminD",
  1087: "calcium",
  1089: "iron",
  1092: "potassium",
};

export function calculateNutrition(
  ingredients: { usdaId: string; grams: number; nutrition: NutritionInfo }[]
): NutritionInfo {
  const totals: NutritionInfo = {
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
  };

  for (const ingredient of ingredients) {
    const scale = ingredient.grams / 100; // USDA data is per 100g
    for (const key of Object.keys(totals) as (keyof NutritionInfo)[]) {
      const value = ingredient.nutrition[key];
      if (value !== undefined) {
        (totals[key] as number) += value * scale;
      }
    }
  }

  // Round all values to 1 decimal
  for (const key of Object.keys(totals) as (keyof NutritionInfo)[]) {
    (totals[key] as number) = Math.round((totals[key] as number) * 10) / 10;
  }

  return totals;
}

export { NUTRIENT_MAP };
