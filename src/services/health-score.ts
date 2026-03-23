/**
 * Personalized Health Score Calculator
 *
 * Combines nutri-score with user preferences to produce a 0-100 health score.
 */

// --- Ingredient category expansion ---

const INGREDIENT_CATEGORIES: Record<string, string[]> = {
  "seed oils": [
    "canola oil", "soybean oil", "sunflower oil", "corn oil",
    "safflower oil", "grapeseed oil", "cottonseed oil", "rice bran oil",
    "vegetable oil",
  ],
  "artificial sweeteners": [
    "aspartame", "sucralose", "saccharin", "acesulfame potassium",
    "acesulfame k", "neotame",
  ],
  "high fructose corn syrup": ["high fructose corn syrup", "hfcs"],
  "msg": ["monosodium glutamate", "msg"],
  "artificial colors": [
    "red 40", "blue 1", "yellow 5", "yellow 6", "red 3", "blue 2",
    "fd&c red", "fd&c blue", "fd&c yellow",
  ],
};

export function expandIngredientCategory(category: string): string[] {
  const lower = category.toLowerCase().trim();
  return INGREDIENT_CATEGORIES[lower] || [lower];
}

// --- Types ---

export interface HealthScoreFlag {
  type: "warning" | "positive" | "critical";
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export interface HealthScoreBreakdown {
  base_score: number;
  preference_penalties: number;
  preference_bonuses: number;
  final_score: number;
}

export interface HealthScoreResult {
  score: number;
  grade: string;
  flags: HealthScoreFlag[];
  breakdown: HealthScoreBreakdown;
}

export interface UserPreferences {
  avoid_ingredients: string | null;
  dietary_goals: string | null;
  health_conditions: string | null;
  calorie_target: number | null;
  protein_target: number | null;
}

// --- Nutri-grade to base score ---

function nutriGradeToBaseScore(grade: string | null): number {
  switch (grade?.toUpperCase()) {
    case "A": return 90;
    case "B": return 75;
    case "C": return 55;
    case "D": return 35;
    case "E": return 15;
    default: return 50; // unknown
  }
}

function scoreToGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

// --- Main scoring function ---

export function calculatePersonalHealthScore(
  food: any,
  preferences: UserPreferences | null
): HealthScoreResult {
  const flags: HealthScoreFlag[] = [];
  const baseScore = nutriGradeToBaseScore(food.nutri_grade);
  let penalties = 0;
  let bonuses = 0;

  // Add generic positive/negative flags based on nutrition
  if (food.protein >= 20) {
    flags.push({ type: "positive", message: `High protein (${food.protein}g)`, severity: "info" });
  }
  if (food.total_sugars <= 3 && food.total_sugars !== null) {
    flags.push({ type: "positive", message: `Low sugar (${food.total_sugars}g)`, severity: "info" });
  }
  if (food.dietary_fiber >= 5) {
    flags.push({ type: "positive", message: `High fiber (${food.dietary_fiber}g)`, severity: "info" });
  }
  if (food.sodium > 600) {
    flags.push({ type: "warning", message: `High sodium (${food.sodium}mg)`, severity: "medium" });
  }
  if (food.saturated_fat > 5) {
    flags.push({ type: "warning", message: `High saturated fat (${food.saturated_fat}g)`, severity: "medium" });
  }

  if (!preferences) {
    const finalScore = clamp(baseScore, 0, 100);
    return {
      score: finalScore,
      grade: scoreToGrade(finalScore),
      flags,
      breakdown: {
        base_score: baseScore,
        preference_penalties: 0,
        preference_bonuses: 0,
        final_score: finalScore,
      },
    };
  }

  const ingredientsText = (food.ingredients_text || "").toLowerCase();

  // --- Check avoid_ingredients ---
  if (preferences.avoid_ingredients) {
    const avoidList = preferences.avoid_ingredients.split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const avoidItem of avoidList) {
      const expanded = expandIngredientCategory(avoidItem);
      for (const term of expanded) {
        if (ingredientsText.includes(term.toLowerCase())) {
          penalties += 15;
          const categoryLabel = expanded.length > 1 ? ` (${avoidItem})` : "";
          flags.push({
            type: "warning",
            message: `Contains ${term}${categoryLabel}`,
            severity: "high",
          });
          // Only flag once per category
          break;
        }
      }
    }
  }

  // --- Check dietary_goals ---
  if (preferences.dietary_goals) {
    const goals = preferences.dietary_goals.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);

    for (const goal of goals) {
      switch (goal) {
        case "keto":
        case "low_carb":
          if (food.total_carbohydrates > 20) {
            penalties += 10;
            flags.push({ type: "warning", message: `High carbs for ${goal} (${food.total_carbohydrates}g)`, severity: "medium" });
          } else if (food.total_carbohydrates <= 5) {
            bonuses += 5;
            flags.push({ type: "positive", message: `Very low carbs — great for ${goal}`, severity: "info" });
          }
          break;

        case "low_sodium":
          if (food.sodium > 400) {
            penalties += 10;
            flags.push({ type: "warning", message: `High sodium for low-sodium goal (${food.sodium}mg)`, severity: "medium" });
          } else if (food.sodium <= 140) {
            bonuses += 5;
            flags.push({ type: "positive", message: "Low sodium", severity: "info" });
          }
          break;

        case "high_protein":
          if (food.protein >= 20) {
            bonuses += 5;
            flags.push({ type: "positive", message: `High protein — matches your goal (${food.protein}g)`, severity: "info" });
          } else if (food.protein < 5) {
            penalties += 5;
            flags.push({ type: "warning", message: `Low protein for high-protein goal (${food.protein}g)`, severity: "low" });
          }
          break;

        case "low_fat":
          if (food.total_fat > 15) {
            penalties += 10;
            flags.push({ type: "warning", message: `High fat for low-fat goal (${food.total_fat}g)`, severity: "medium" });
          } else if (food.total_fat <= 3) {
            bonuses += 5;
            flags.push({ type: "positive", message: "Very low fat", severity: "info" });
          }
          break;

        case "low_sugar":
          if (food.total_sugars > 10) {
            penalties += 10;
            flags.push({ type: "warning", message: `High sugar for low-sugar goal (${food.total_sugars}g)`, severity: "medium" });
          } else if (food.total_sugars <= 2) {
            bonuses += 5;
            flags.push({ type: "positive", message: "Very low sugar", severity: "info" });
          }
          break;

        case "dairy_free":
          if (checkContainsDairy(ingredientsText)) {
            penalties += 15;
            flags.push({ type: "warning", message: "Contains dairy ingredients", severity: "high" });
          }
          break;

        case "gluten_free":
          if (checkContainsGluten(ingredientsText)) {
            penalties += 15;
            flags.push({ type: "warning", message: "Contains gluten ingredients", severity: "high" });
          }
          break;
      }
    }
  }

  // --- Check health_conditions ---
  if (preferences.health_conditions) {
    const conditions = preferences.health_conditions.split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);

    for (const condition of conditions) {
      switch (condition) {
        case "diabetic":
        case "diabetes":
          if (food.total_sugars > 10) {
            penalties += 15;
            flags.push({
              type: "critical",
              message: `High sugar content — not recommended for diabetics (${food.total_sugars}g)`,
              severity: "critical",
            });
          }
          break;

        case "celiac":
          if (checkContainsGluten(ingredientsText)) {
            penalties += 30;
            flags.push({
              type: "critical",
              message: "Contains wheat/gluten — unsafe for celiac disease",
              severity: "critical",
            });
          }
          break;

        case "lactose_intolerant":
          if (checkContainsDairy(ingredientsText)) {
            penalties += 20;
            flags.push({
              type: "critical",
              message: "Contains dairy — not suitable for lactose intolerance",
              severity: "critical",
            });
          }
          break;

        case "hypertension":
        case "high_blood_pressure":
          if (food.sodium > 400) {
            penalties += 15;
            flags.push({
              type: "critical",
              message: `High sodium — caution with hypertension (${food.sodium}mg)`,
              severity: "critical",
            });
          }
          break;
      }
    }
  }

  const finalScore = clamp(baseScore - penalties + bonuses, 0, 100);

  return {
    score: finalScore,
    grade: scoreToGrade(finalScore),
    flags,
    breakdown: {
      base_score: baseScore,
      preference_penalties: -penalties,
      preference_bonuses: bonuses,
      final_score: finalScore,
    },
  };
}

// --- Helpers ---

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const DAIRY_TERMS = [
  "milk", "cream", "cheese", "butter", "whey", "casein", "lactose",
  "yogurt", "yoghurt", "ghee", "curds",
];

const GLUTEN_TERMS = [
  "wheat", "gluten", "barley", "rye", "triticale", "spelt", "kamut",
  "semolina", "durum", "farina", "bulgur", "couscous",
];

function checkContainsDairy(ingredientsText: string): boolean {
  return DAIRY_TERMS.some((term) => ingredientsText.includes(term));
}

function checkContainsGluten(ingredientsText: string): boolean {
  return GLUTEN_TERMS.some((term) => ingredientsText.includes(term));
}
