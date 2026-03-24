import { calculatePersonalHealthScore } from "../src/services/health-score";

describe("Health Score (Culture Score)", () => {
  it("broccoli should score >= 85", () => {
    const broccoli = {
      name: "Broccoli",
      category: "Vegetables",
      calories: 34,
      protein: 2.8,
      total_fat: 0.4,
      saturated_fat: 0.04,
      trans_fat: 0,
      total_carbohydrates: 6.6,
      total_sugars: 1.7,
      dietary_fiber: 2.6,
      sodium: 33,
      cholesterol: 0,
      vitamin_d: 0,
      calcium: 47,
      iron: 0.7,
      potassium: 316,
    };
    const result = calculatePersonalHealthScore(broccoli, null);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("chicken breast should score >= 85", () => {
    const chicken = {
      name: "Chicken breast",
      category: "Poultry",
      calories: 165,
      protein: 31,
      total_fat: 3.6,
      saturated_fat: 1.0,
      trans_fat: 0,
      total_carbohydrates: 0,
      total_sugars: 0,
      dietary_fiber: 0,
      sodium: 74,
      cholesterol: 85,
      vitamin_d: 0,
      calcium: 15,
      iron: 1.0,
      potassium: 256,
    };
    const result = calculatePersonalHealthScore(chicken, null);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("food with zero nutrition should score 0", () => {
    const empty = {
      name: "Sugar Water",
      category: "Beverages",
      calories: 50,
      protein: 0,
      total_fat: 0,
      saturated_fat: 0,
      trans_fat: 0,
      total_carbohydrates: 12,
      total_sugars: 12,
      dietary_fiber: 0,
      sodium: 5,
      cholesterol: 0,
      vitamin_d: 0,
      calcium: 0,
      iron: 0,
      potassium: 0,
    };
    const result = calculatePersonalHealthScore(empty, null);
    expect(result.score).toBe(0);
  });

  it("NOVA 1 foods should score >= 85", () => {
    // A simple whole food: salmon
    const salmon = {
      name: "Salmon",
      category: "Fish",
      calories: 208,
      protein: 20,
      total_fat: 13,
      saturated_fat: 3.1,
      trans_fat: 0,
      total_carbohydrates: 0,
      total_sugars: 0,
      dietary_fiber: 0,
      sodium: 59,
      cholesterol: 55,
      vitamin_d: 11,
      calcium: 12,
      iron: 0.3,
      potassium: 363,
    };
    const result = calculatePersonalHealthScore(salmon, null);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.breakdown.nova_class).toBe(1);
  });

  it("NOVA 4 fast food should score < 30", () => {
    const bigMac = {
      name: "Big Mac",
      brand: "McDonald's",
      category: "Fast Food",
      calories: 550,
      protein: 25,
      total_fat: 30,
      saturated_fat: 11,
      trans_fat: 1,
      total_carbohydrates: 45,
      total_sugars: 9,
      dietary_fiber: 3,
      sodium: 1010,
      cholesterol: 80,
      vitamin_d: 0,
      calcium: 200,
      iron: 4.5,
      potassium: 400,
      ingredients_text:
        "beef, enriched flour, high fructose corn syrup, soybean oil, " +
        "modified food starch, natural flavor, sodium benzoate, " +
        "calcium peroxide, xanthan gum, artificial flavor",
    };
    const result = calculatePersonalHealthScore(bigMac, null);
    expect(result.score).toBeLessThan(30);
    expect(result.breakdown.nova_class).toBe(4);
  });
});
