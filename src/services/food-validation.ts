/**
 * Rule-based food data validation.
 * Catches obviously bad entries without needing an AI call.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFoodData(food: {
  name?: string;
  calories?: number;
  total_fat?: number;
  saturated_fat?: number;
  protein?: number;
  total_carbohydrates?: number;
  total_sugars?: number;
  sodium?: number;
  dietary_fiber?: number;
  serving_size?: number;
}): ValidationResult {
  const errors: string[] = [];

  // Must have a name
  if (!food.name || food.name.trim().length < 2) {
    errors.push("Missing or invalid food name");
  }

  const cal = food.calories ?? -1;
  const fat = food.total_fat ?? 0;
  const protein = food.protein ?? 0;
  const carbs = food.total_carbohydrates ?? 0;
  const sugar = food.total_sugars ?? 0;
  const sodium = food.sodium ?? 0;
  const fiber = food.dietary_fiber ?? 0;
  const satFat = food.saturated_fat ?? 0;
  const serving = food.serving_size ?? 100;

  // Calories must be between 0 and 900 per 100g (pure fat is ~900)
  if (cal < 0 || cal > 900) {
    errors.push(`Calories out of range: ${cal} (expected 0-900 per 100g)`);
  }

  // Macros can't be negative
  if (fat < 0) errors.push(`Negative fat: ${fat}`);
  if (protein < 0) errors.push(`Negative protein: ${protein}`);
  if (carbs < 0) errors.push(`Negative carbs: ${carbs}`);
  if (sugar < 0) errors.push(`Negative sugar: ${sugar}`);
  if (sodium < 0) errors.push(`Negative sodium: ${sodium}`);

  // Macros can't exceed 100g per 100g
  if (fat > 100) errors.push(`Fat exceeds 100g per 100g: ${fat}`);
  if (protein > 100) errors.push(`Protein exceeds 100g per 100g: ${protein}`);
  if (carbs > 100) errors.push(`Carbs exceed 100g per 100g: ${carbs}`);

  // Fat + protein + carbs can't exceed ~100g per 100g (plus water/ash)
  if (fat + protein + carbs > 105) {
    errors.push(`Macros exceed 100g total: fat(${fat}) + protein(${protein}) + carbs(${carbs}) = ${fat + protein + carbs}`);
  }

  // Saturated fat can't exceed total fat
  if (satFat > fat + 0.5) {
    errors.push(`Saturated fat (${satFat}) exceeds total fat (${fat})`);
  }

  // Sugar can't exceed total carbs
  if (sugar > carbs + 0.5) {
    errors.push(`Sugar (${sugar}) exceeds total carbs (${carbs})`);
  }

  // Fiber can't exceed total carbs
  if (fiber > carbs + 0.5) {
    errors.push(`Fiber (${fiber}) exceeds total carbs (${carbs})`);
  }

  // Calorie sanity check: calculated calories should be roughly close to stated
  // 1g fat = 9 cal, 1g protein = 4 cal, 1g carbs = 4 cal
  if (cal > 0) {
    const estimatedCal = fat * 9 + protein * 4 + carbs * 4;
    const diff = Math.abs(cal - estimatedCal);
    // Allow 30% tolerance (alcohol, rounding, fiber adjustment)
    if (diff > cal * 0.3 && diff > 50) {
      errors.push(`Calorie mismatch: stated ${cal}, estimated ${Math.round(estimatedCal)} from macros`);
    }
  }

  // Sodium sanity: max ~7,000mg per 100g (soy sauce is ~5,500)
  if (sodium > 7000) {
    errors.push(`Sodium unrealistically high: ${sodium}mg`);
  }

  // Serving size sanity
  if (serving <= 0 || serving > 5000) {
    errors.push(`Serving size out of range: ${serving}g`);
  }

  return { valid: errors.length === 0, errors };
}
