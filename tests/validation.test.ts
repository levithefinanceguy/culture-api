import { validateFoodData } from "../src/services/food-validation";

describe("Food Validation", () => {
  it("valid food data passes", () => {
    const result = validateFoodData({
      name: "Chicken Breast",
      calories: 165,
      total_fat: 3.6,
      saturated_fat: 1.0,
      protein: 31,
      total_carbohydrates: 0,
      total_sugars: 0,
      sodium: 74,
      dietary_fiber: 0,
      serving_size: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("negative calories fails", () => {
    const result = validateFoodData({
      name: "Bad Food",
      calories: -10,
      protein: 5,
      total_fat: 2,
      total_carbohydrates: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Calories out of range"))).toBe(true);
  });

  it("calories > 900 fails", () => {
    const result = validateFoodData({
      name: "Impossible Food",
      calories: 950,
      protein: 10,
      total_fat: 90,
      total_carbohydrates: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Calories out of range"))).toBe(true);
  });

  it("sugar > carbs fails", () => {
    const result = validateFoodData({
      name: "Bad Sugar",
      calories: 100,
      protein: 5,
      total_fat: 2,
      total_carbohydrates: 10,
      total_sugars: 15,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Sugar") && e.includes("exceeds total carbs"))).toBe(true);
  });

  it("calorie mismatch fails", () => {
    // 10g fat (90cal) + 10g protein (40cal) + 10g carbs (40cal) = 170 estimated
    // Stated: 400 -> way off
    const result = validateFoodData({
      name: "Mismatched Food",
      calories: 400,
      protein: 10,
      total_fat: 10,
      total_carbohydrates: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Calorie mismatch"))).toBe(true);
  });
});
