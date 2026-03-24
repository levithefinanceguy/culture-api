/**
 * Shared formatFood() function — the full version from foods.ts.
 * Used by foods.ts, alternatives.ts, swaps.ts, and anywhere else
 * that formats a food row for API response.
 */

export function formatFood(row: any) {
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
    glycemicIndex: row.glycemic_index ?? null,
    glycemicLoad: row.glycemic_load ?? null,
    cultureScore: row.culture_score,
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
