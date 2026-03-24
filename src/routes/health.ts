import { Router, Request, Response } from "express";
import db from "../data/database";
import {
  calculatePersonalHealthScore,
  UserPreferences,
} from "../services/health-score";

export const healthRoutes = Router();

function getUserPreferences(apiKey: string): UserPreferences | null {
  const row = db
    .prepare("SELECT * FROM user_preferences WHERE api_key = ?")
    .get(apiKey) as any;
  if (!row) return null;
  return {
    avoid_ingredients: row.avoid_ingredients,
    dietary_goals: row.dietary_goals,
    health_conditions: row.health_conditions,
    calorie_target: row.calorie_target,
    protein_target: row.protein_target,
  };
}

// --- GET /foods/:id/health-score ---
healthRoutes.get("/foods/:id/health-score", (req: Request, res: Response) => {
  const apiKey =
    (req.headers["x-api-key"] as string) ||
    (req.query.api_key as string);

  const food = db
    .prepare("SELECT * FROM foods WHERE id = ?")
    .get(req.params.id) as any;
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const preferences = getUserPreferences(apiKey);
  const baseResult = calculatePersonalHealthScore(food, null);
  const personalResult = preferences
    ? calculatePersonalHealthScore(food, preferences)
    : null;

  // Build pros and cons from flags
  const pros: string[] = [];
  const cons: string[] = [];
  for (const flag of baseResult.flags) {
    if (flag.type === "positive") pros.push(flag.message);
    else cons.push(flag.message);
  }

  // Build your_score with explanation
  let yourScore = null;
  if (personalResult && preferences) {
    const diff = personalResult.score - baseResult.score;
    const adjustmentReasons: { reason: string; impact: string }[] = [];

    for (const flag of personalResult.flags) {
      const isNew = !baseResult.flags.some((f) => f.message === flag.message);
      if (isNew) {
        const impact = flag.type === "positive" ? "+" : "-";
        adjustmentReasons.push({ reason: flag.message, impact });
      }
    }

    let summary = "";
    if (diff > 0) {
      summary = `Your score is higher because ${
        adjustmentReasons
          .filter((r) => r.impact === "+")
          .map((r) => r.reason.toLowerCase())
          .join(" and ") || "it matches your dietary goals"
      }`;
    } else if (diff < 0) {
      summary = `Your score is lower because ${
        adjustmentReasons
          .filter((r) => r.impact === "-")
          .map((r) => r.reason.toLowerCase())
          .join(" and ") || "it conflicts with your preferences"
      }`;
    } else {
      summary = "Your preferences don't affect this food's score";
    }

    yourScore = {
      score: personalResult.score,
      label: personalResult.label,
      color: personalResult.color,
      summary,
      adjustments: adjustmentReasons,
    };
  }

  // Color-coded nutrition facts
  const DV = {
    total_fat: 78,
    saturated_fat: 20,
    trans_fat: 0,
    cholesterol: 300,
    sodium: 2300,
    total_carbohydrates: 275,
    dietary_fiber: 28,
    total_sugars: 50,
    protein: 50,
    vitamin_d: 20,
    calcium: 1300,
    iron: 18,
    potassium: 4700,
  };

  type NutrientColor =
    | "#2ECC71"
    | "#F1C40F"
    | "#E67E22"
    | "#E74C3C"
    | "#95A5A6";
  type NutrientRating =
    | "good"
    | "moderate"
    | "high"
    | "very_high"
    | "neutral";

  function rateNutrient(
    key: string,
    value: number,
    dv: number
  ): { rating: NutrientRating; color: NutrientColor; percentDv: number } {
    const pct = dv > 0 ? Math.round((value / dv) * 100) : 0;
    const isGoodNutrient = [
      "protein",
      "dietary_fiber",
      "vitamin_d",
      "calcium",
      "iron",
      "potassium",
    ].includes(key);
    const isBadNutrient = [
      "saturated_fat",
      "trans_fat",
      "sodium",
      "total_sugars",
    ].includes(key);

    if (isGoodNutrient) {
      if (pct >= 20)
        return { rating: "good", color: "#2ECC71", percentDv: pct };
      if (pct >= 10)
        return { rating: "moderate", color: "#F1C40F", percentDv: pct };
      return { rating: "neutral", color: "#95A5A6", percentDv: pct };
    }

    if (isBadNutrient) {
      if (key === "trans_fat" && value > 0)
        return { rating: "very_high", color: "#E74C3C", percentDv: pct };
      if (pct >= 30)
        return { rating: "very_high", color: "#E74C3C", percentDv: pct };
      if (pct >= 15)
        return { rating: "high", color: "#E67E22", percentDv: pct };
      if (pct >= 5)
        return { rating: "moderate", color: "#F1C40F", percentDv: pct };
      return { rating: "good", color: "#2ECC71", percentDv: pct };
    }

    return { rating: "neutral", color: "#95A5A6", percentDv: pct };
  }

  const nutrientEntries = [
    {
      key: "calories",
      label: "Calories",
      value: food.calories || 0,
      unit: "kcal",
    },
    {
      key: "total_fat",
      label: "Total Fat",
      value: food.total_fat || 0,
      unit: "g",
    },
    {
      key: "saturated_fat",
      label: "Saturated Fat",
      value: food.saturated_fat || 0,
      unit: "g",
    },
    {
      key: "trans_fat",
      label: "Trans Fat",
      value: food.trans_fat || 0,
      unit: "g",
    },
    {
      key: "cholesterol",
      label: "Cholesterol",
      value: food.cholesterol || 0,
      unit: "mg",
    },
    {
      key: "sodium",
      label: "Sodium",
      value: food.sodium || 0,
      unit: "mg",
    },
    {
      key: "total_carbohydrates",
      label: "Total Carbs",
      value: food.total_carbohydrates || 0,
      unit: "g",
    },
    {
      key: "dietary_fiber",
      label: "Fiber",
      value: food.dietary_fiber || 0,
      unit: "g",
    },
    {
      key: "total_sugars",
      label: "Sugars",
      value: food.total_sugars || 0,
      unit: "g",
    },
    {
      key: "protein",
      label: "Protein",
      value: food.protein || 0,
      unit: "g",
    },
    {
      key: "vitamin_d",
      label: "Vitamin D",
      value: food.vitamin_d || 0,
      unit: "mcg",
    },
    {
      key: "calcium",
      label: "Calcium",
      value: food.calcium || 0,
      unit: "mg",
    },
    { key: "iron", label: "Iron", value: food.iron || 0, unit: "mg" },
    {
      key: "potassium",
      label: "Potassium",
      value: food.potassium || 0,
      unit: "mg",
    },
  ];

  const nutritionFacts: Record<string, any> = {};
  for (const n of nutrientEntries) {
    const dvValue = (DV as any)[n.key] || 0;
    if (n.key === "calories") {
      nutritionFacts[n.key] = {
        label: n.label,
        value: n.value,
        unit: n.unit,
        color: "#95A5A6",
      };
    } else {
      const rated = rateNutrient(n.key, n.value, dvValue);
      nutritionFacts[n.key] = {
        label: n.label,
        value: n.value,
        unit: n.unit,
        ...rated,
      };
    }
  }

  // Add glycemic index to nutrition facts if available
  if (food.glycemic_index != null) {
    const gi = food.glycemic_index;
    let giRating: NutrientRating;
    let giColor: NutrientColor;
    let giLabel: string;
    if (gi <= 55) {
      giRating = "good";
      giColor = "#2ECC71";
      giLabel = "Low";
    } else if (gi <= 69) {
      giRating = "moderate";
      giColor = "#F1C40F";
      giLabel = "Medium";
    } else {
      giRating = "high";
      giColor = "#E74C3C";
      giLabel = "High";
    }
    nutritionFacts["glycemic_index"] = {
      label: "Glycemic Index",
      value: gi,
      unit: "",
      rating: giRating,
      color: giColor,
      giCategory: giLabel,
    };
  }

  // Add glycemic load to nutrition facts if available
  if (food.glycemic_load != null) {
    const gl = food.glycemic_load;
    let glRating: NutrientRating;
    let glColor: NutrientColor;
    let glLabel: string;
    if (gl <= 10) {
      glRating = "good";
      glColor = "#2ECC71";
      glLabel = "Low";
    } else if (gl <= 19) {
      glRating = "moderate";
      glColor = "#F1C40F";
      glLabel = "Medium";
    } else {
      glRating = "high";
      glColor = "#E74C3C";
      glLabel = "High";
    }
    nutritionFacts["glycemic_load"] = {
      label: "Glycemic Load",
      value: gl,
      unit: "",
      rating: glRating,
      color: glColor,
      glCategory: glLabel,
    };
  }

  res.json({
    food: {
      id: food.id,
      name: food.name,
      brand: food.brand,
      category: food.category,
      servingSize: food.serving_size,
      servingUnit: food.serving_unit,
    },
    culture_score: {
      score: baseResult.score,
      label: baseResult.label,
      color: baseResult.color,
    },
    your_score: yourScore,
    nutrition_facts: nutritionFacts,
  });
});
