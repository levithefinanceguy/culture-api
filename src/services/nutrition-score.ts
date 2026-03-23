/**
 * Nutri-Score calculator
 *
 * Calculates a nutrition score from A (best) to E (worst) based on
 * nutritional values per 100g, inspired by the Nutri-Score system.
 */

export interface NutriScoreInput {
  calories: number;       // kcal per 100g
  totalSugars: number;    // g per 100g
  saturatedFat: number;   // g per 100g
  sodium: number;         // mg per 100g
  dietaryFiber: number;   // g per 100g
  protein: number;        // g per 100g
}

export interface NutriScoreResult {
  score: number;
  grade: string;
  details: {
    negativePoints: {
      calories: number;
      sugars: number;
      saturatedFat: number;
      sodium: number;
      total: number;
    };
    positivePoints: {
      fiber: number;
      protein: number;
      fruitVeg: number;
      total: number;
    };
  };
}

// --- Negative point thresholds (per 100g) ---

const CALORIE_THRESHOLDS = [335, 300, 270, 240, 210, 180, 150, 120, 90, 60];
const SUGAR_THRESHOLDS    = [45, 40, 36, 31, 27, 22.5, 18, 13.5, 9, 4.5];
const SAT_FAT_THRESHOLDS  = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const SODIUM_THRESHOLDS   = [900, 810, 720, 630, 540, 450, 360, 270, 180, 90];

// --- Positive point thresholds (per 100g) ---

const FIBER_THRESHOLDS   = [4.7, 3.7, 2.8, 1.9, 0.9];
const PROTEIN_THRESHOLDS = [8, 6.4, 4.8, 3.2, 1.6];

// Categories considered fruit/vegetable/legume-heavy for the fruit-veg estimate
const FRUIT_VEG_CATEGORIES = new Set([
  "fruits", "fruit", "vegetables", "vegetable", "veggies",
  "legumes", "legume", "beans", "salads", "salad",
  "fruit juices", "fruit juice", "smoothies", "smoothie",
]);

function scoreFromThresholds(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (value > thresholds[i]) {
      return thresholds.length - i;
    }
  }
  return 0;
}

function estimateFruitVegPoints(category?: string): number {
  if (!category) return 0;
  const lower = category.toLowerCase().trim();
  if (FRUIT_VEG_CATEGORIES.has(lower)) return 5;
  // Partial credit for mixed categories
  for (const kw of ["fruit", "vegetable", "veggie", "legume", "bean", "salad"]) {
    if (lower.includes(kw)) return 3;
  }
  return 0;
}

export function calculateNutriScore(
  nutrition: NutriScoreInput,
  category?: string
): NutriScoreResult {
  // Negative points (0-10 each, max 40)
  const calPts = scoreFromThresholds(nutrition.calories, CALORIE_THRESHOLDS);
  const sugPts = scoreFromThresholds(nutrition.totalSugars, SUGAR_THRESHOLDS);
  const satPts = scoreFromThresholds(nutrition.saturatedFat, SAT_FAT_THRESHOLDS);
  const sodPts = scoreFromThresholds(nutrition.sodium, SODIUM_THRESHOLDS);
  const negativeTotal = calPts + sugPts + satPts + sodPts;

  // Positive points (0-5 each, max 15)
  const fiberPts   = scoreFromThresholds(nutrition.dietaryFiber, FIBER_THRESHOLDS);
  const proteinPts = scoreFromThresholds(nutrition.protein, PROTEIN_THRESHOLDS);
  const fruitPts   = estimateFruitVegPoints(category);
  const positiveTotal = fiberPts + proteinPts + fruitPts;

  const score = negativeTotal - positiveTotal;

  let grade: string;
  if (score <= -1)      grade = "A";
  else if (score <= 2)  grade = "B";
  else if (score <= 10) grade = "C";
  else if (score <= 18) grade = "D";
  else                  grade = "E";

  return {
    score,
    grade,
    details: {
      negativePoints: {
        calories: calPts,
        sugars: sugPts,
        saturatedFat: satPts,
        sodium: sodPts,
        total: negativeTotal,
      },
      positivePoints: {
        fiber: fiberPts,
        protein: proteinPts,
        fruitVeg: fruitPts,
        total: positiveTotal,
      },
    },
  };
}
