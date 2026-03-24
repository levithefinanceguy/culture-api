/**
 * Shared nutrition utilities used across route files.
 */

export interface NutritionValues {
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
  vitamin_d: number | null;
  calcium: number | null;
  iron: number | null;
  potassium: number | null;
}

export const NUTRITION_KEYS: (keyof NutritionValues)[] = [
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
];

export function scaleNutrition(food: any, grams: number): NutritionValues {
  const servingGrams = food.serving_size || 100;
  const factor = grams / servingGrams;

  const round2 = (n: number | null) =>
    n != null ? Math.round(n * factor * 100) / 100 : null;

  return {
    calories: round2(food.calories) ?? 0,
    total_fat: round2(food.total_fat) ?? 0,
    saturated_fat: round2(food.saturated_fat) ?? 0,
    trans_fat: round2(food.trans_fat) ?? 0,
    cholesterol: round2(food.cholesterol) ?? 0,
    sodium: round2(food.sodium) ?? 0,
    total_carbohydrates: round2(food.total_carbohydrates) ?? 0,
    dietary_fiber: round2(food.dietary_fiber) ?? 0,
    total_sugars: round2(food.total_sugars) ?? 0,
    protein: round2(food.protein) ?? 0,
    vitamin_d: round2(food.vitamin_d),
    calcium: round2(food.calcium),
    iron: round2(food.iron),
    potassium: round2(food.potassium),
  };
}

export function sumNutrition(items: NutritionValues[]): NutritionValues {
  const totals: NutritionValues = {
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
    vitamin_d: null,
    calcium: null,
    iron: null,
    potassium: null,
  };

  for (const item of items) {
    for (const key of NUTRITION_KEYS) {
      const val = item[key];
      if (val != null) {
        (totals as any)[key] = ((totals as any)[key] ?? 0) + val;
      }
    }
  }

  for (const key of NUTRITION_KEYS) {
    const val = (totals as any)[key];
    if (val != null) {
      (totals as any)[key] = Math.round(val * 100) / 100;
    }
  }

  return totals;
}

export const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  cup: 240,
  cups: 240,
  tbsp: 14.787,
  tablespoon: 14.787,
  tablespoons: 14.787,
  tsp: 4.929,
  teaspoon: 4.929,
  teaspoons: 4.929,
};

export const COMMON_FOOD_WEIGHTS: Record<string, number> = {
  egg: 50,
  eggs: 50,
  banana: 118,
  bananas: 118,
  apple: 182,
  apples: 182,
  orange: 131,
  oranges: 131,
  avocado: 150,
  avocados: 150,
  potato: 150,
  potatoes: 150,
  tomato: 123,
  tomatoes: 123,
  "chicken breast": 174,
  "chicken breasts": 174,
  tortilla: 45,
  tortillas: 45,
  bagel: 105,
  bagels: 105,
  muffin: 57,
  muffins: 57,
  cookie: 30,
  cookies: 30,
  donut: 60,
  donuts: 60,
  pancake: 77,
  pancakes: 77,
  waffle: 75,
  waffles: 75,
  clove: 3,
  cloves: 3,
};

export const UNIT_FOOD_WEIGHTS: Record<string, Record<string, number>> = {
  slice: {
    bread: 30,
    toast: 30,
    pizza: 107,
    cheese: 21,
    bacon: 8,
    ham: 28,
    turkey: 28,
    cake: 80,
    pie: 125,
    default: 30,
  },
  piece: {
    chicken: 120,
    chocolate: 10,
    candy: 10,
    fruit: 100,
    sushi: 30,
    default: 100,
  },
  strip: {
    bacon: 8,
    chicken: 28,
    default: 20,
  },
  patty: {
    beef: 113,
    hamburger: 113,
    burger: 113,
    turkey: 113,
    chicken: 113,
    default: 113,
  },
};

/**
 * Estimate grams for a food item given quantity, unit, and food name.
 * Falls back to servingSize when no specific conversion is found.
 */
export function estimateGrams(
  quantity: number,
  unit: string,
  foodName: string,
  servingSize: number
): number {
  const unitLower = unit.toLowerCase();
  const foodLower = foodName.toLowerCase();

  if (unitLower === "g" || unitLower === "grams") return quantity;

  if (unitLower in UNIT_TO_GRAMS) {
    return quantity * UNIT_TO_GRAMS[unitLower];
  }

  if (unitLower in UNIT_FOOD_WEIGHTS) {
    const unitMap = UNIT_FOOD_WEIGHTS[unitLower];
    for (const [food, grams] of Object.entries(unitMap)) {
      if (food !== "default" && foodLower.includes(food)) {
        return quantity * grams;
      }
    }
    return quantity * (unitMap.default || 30);
  }

  // "whole" or "pieces" — check common food weights
  if (
    unitLower === "whole" ||
    unitLower === "pieces" ||
    unitLower === "piece"
  ) {
    for (const [food, grams] of Object.entries(COMMON_FOOD_WEIGHTS)) {
      if (foodLower.includes(food) || food.includes(foodLower)) {
        return quantity * grams;
      }
    }
    return quantity * servingSize;
  }

  return quantity * servingSize;
}
