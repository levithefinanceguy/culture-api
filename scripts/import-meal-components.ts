/**
 * Import meal component data for chain restaurant meal builders.
 *
 * Populates the meal_components table with realistic nutrition data
 * for Chipotle, Subway, and Sweetgreen components with portion variants.
 *
 * Usage:
 *   npx ts-node scripts/import-meal-components.ts
 */

import { v4 as uuid } from "uuid";
import db from "../src/data/database";
import { detectAllergens, detectDietaryTags } from "../src/services/food-analysis";

interface ComponentData {
  name: string;
  category: string;
  ingredients?: string;
  portions: {
    [portionType: string]: {
      grams: number;
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
    };
  };
}

// ─── CHIPOTLE ────────────────────────────────────────────────────────

const chipotleComponents: ComponentData[] = [
  // Base
  {
    name: "White Rice",
    category: "Base",
    ingredients: "rice, water, rice bran oil, lime juice, salt, cilantro",
    portions: {
      light: { grams: 65, calories: 105, total_fat: 1.5, saturated_fat: 0.3, trans_fat: 0, cholesterol: 0, sodium: 185, total_carbohydrates: 21, dietary_fiber: 0.5, total_sugars: 0, protein: 2 },
      standard: { grams: 130, calories: 210, total_fat: 3, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 370, total_carbohydrates: 42, dietary_fiber: 1, total_sugars: 0, protein: 4 },
      double: { grams: 260, calories: 420, total_fat: 6, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 740, total_carbohydrates: 84, dietary_fiber: 2, total_sugars: 0, protein: 8 },
    },
  },
  {
    name: "Brown Rice",
    category: "Base",
    ingredients: "brown rice, water, rice bran oil, lime juice, salt, cilantro",
    portions: {
      light: { grams: 65, calories: 100, total_fat: 1.5, saturated_fat: 0.3, trans_fat: 0, cholesterol: 0, sodium: 165, total_carbohydrates: 20, dietary_fiber: 1, total_sugars: 0, protein: 2 },
      standard: { grams: 130, calories: 200, total_fat: 3, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 330, total_carbohydrates: 40, dietary_fiber: 2, total_sugars: 0, protein: 4 },
      double: { grams: 260, calories: 400, total_fat: 6, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 660, total_carbohydrates: 80, dietary_fiber: 4, total_sugars: 0, protein: 8 },
    },
  },
  {
    name: "Cilantro-Lime Rice",
    category: "Base",
    ingredients: "rice, water, rice bran oil, lime juice, salt, cilantro",
    portions: {
      light: { grams: 65, calories: 105, total_fat: 1.5, saturated_fat: 0.3, trans_fat: 0, cholesterol: 0, sodium: 190, total_carbohydrates: 21, dietary_fiber: 0.5, total_sugars: 0, protein: 2 },
      standard: { grams: 130, calories: 210, total_fat: 3, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 375, total_carbohydrates: 42, dietary_fiber: 1, total_sugars: 0, protein: 4 },
      double: { grams: 260, calories: 420, total_fat: 6, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 750, total_carbohydrates: 84, dietary_fiber: 2, total_sugars: 0, protein: 8 },
    },
  },

  // Protein
  {
    name: "Chicken",
    category: "Protein",
    ingredients: "chicken, chipotle pepper, cumin, garlic, oregano, salt, black pepper, rice bran oil",
    portions: {
      light: { grams: 56, calories: 90, total_fat: 3.5, saturated_fat: 1, trans_fat: 0, cholesterol: 65, sodium: 260, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 15 },
      standard: { grams: 113, calories: 180, total_fat: 7, saturated_fat: 2, trans_fat: 0, cholesterol: 130, sodium: 520, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 30 },
      double: { grams: 226, calories: 360, total_fat: 14, saturated_fat: 4, trans_fat: 0, cholesterol: 260, sodium: 1040, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 60 },
    },
  },
  {
    name: "Steak",
    category: "Protein",
    ingredients: "beef, chipotle pepper, cumin, garlic, oregano, salt, black pepper, rice bran oil",
    portions: {
      light: { grams: 56, calories: 75, total_fat: 3, saturated_fat: 1, trans_fat: 0, cholesterol: 35, sodium: 175, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 12 },
      standard: { grams: 113, calories: 150, total_fat: 6, saturated_fat: 2, trans_fat: 0, cholesterol: 70, sodium: 350, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 0, protein: 24 },
      double: { grams: 226, calories: 300, total_fat: 12, saturated_fat: 4, trans_fat: 0, cholesterol: 140, sodium: 700, total_carbohydrates: 4, dietary_fiber: 0, total_sugars: 0, protein: 48 },
    },
  },
  {
    name: "Barbacoa",
    category: "Protein",
    ingredients: "beef, chipotle peppers, adobo sauce, cumin, cloves, garlic, oregano, salt, black pepper",
    portions: {
      light: { grams: 56, calories: 85, total_fat: 4, saturated_fat: 1.5, trans_fat: 0, cholesterol: 35, sodium: 260, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 12 },
      standard: { grams: 113, calories: 170, total_fat: 8, saturated_fat: 3, trans_fat: 0, cholesterol: 70, sodium: 520, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 0, protein: 24 },
      double: { grams: 226, calories: 340, total_fat: 16, saturated_fat: 6, trans_fat: 0, cholesterol: 140, sodium: 1040, total_carbohydrates: 4, dietary_fiber: 0, total_sugars: 0, protein: 48 },
    },
  },
  {
    name: "Carnitas",
    category: "Protein",
    ingredients: "pork, juniper berries, thyme, salt, black pepper, bay leaves, rice bran oil",
    portions: {
      light: { grams: 56, calories: 100, total_fat: 5.5, saturated_fat: 2, trans_fat: 0, cholesterol: 40, sodium: 270, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 12 },
      standard: { grams: 113, calories: 200, total_fat: 11, saturated_fat: 4, trans_fat: 0, cholesterol: 80, sodium: 540, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 24 },
      double: { grams: 226, calories: 400, total_fat: 22, saturated_fat: 8, trans_fat: 0, cholesterol: 160, sodium: 1080, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 48 },
    },
  },
  {
    name: "Sofritas",
    category: "Protein",
    ingredients: "tofu, chipotle peppers, roasted poblanos, tomatoes, cumin, garlic, oregano, rice bran oil",
    portions: {
      light: { grams: 56, calories: 75, total_fat: 5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 280, total_carbohydrates: 5, dietary_fiber: 1, total_sugars: 2, protein: 4 },
      standard: { grams: 113, calories: 150, total_fat: 10, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 555, total_carbohydrates: 9, dietary_fiber: 2, total_sugars: 4, protein: 8 },
      double: { grams: 226, calories: 300, total_fat: 20, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 1110, total_carbohydrates: 18, dietary_fiber: 4, total_sugars: 8, protein: 16 },
    },
  },

  // Beans
  {
    name: "Black Beans",
    category: "Beans",
    ingredients: "black beans, water, salt, cumin, garlic, oregano",
    portions: {
      light: { grams: 60, calories: 65, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 130, total_carbohydrates: 11, dietary_fiber: 3.5, total_sugars: 0, protein: 4 },
      standard: { grams: 120, calories: 130, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 260, total_carbohydrates: 22, dietary_fiber: 7, total_sugars: 0, protein: 8 },
      double: { grams: 240, calories: 260, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 520, total_carbohydrates: 44, dietary_fiber: 14, total_sugars: 0, protein: 16 },
    },
  },
  {
    name: "Pinto Beans",
    category: "Beans",
    ingredients: "pinto beans, water, salt, cumin, garlic, oregano",
    portions: {
      light: { grams: 60, calories: 60, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 210, total_carbohydrates: 11, dietary_fiber: 3, total_sugars: 0, protein: 4 },
      standard: { grams: 120, calories: 120, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 420, total_carbohydrates: 22, dietary_fiber: 6, total_sugars: 0, protein: 8 },
      double: { grams: 240, calories: 240, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 840, total_carbohydrates: 44, dietary_fiber: 12, total_sugars: 0, protein: 16 },
    },
  },

  // Toppings
  {
    name: "Fajita Veggies",
    category: "Toppings",
    ingredients: "bell peppers, onions, rice bran oil, salt, oregano",
    portions: {
      light: { grams: 35, calories: 10, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 85, total_carbohydrates: 2, dietary_fiber: 0.5, total_sugars: 1, protein: 0 },
      standard: { grams: 70, calories: 20, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 170, total_carbohydrates: 4, dietary_fiber: 1, total_sugars: 2, protein: 1 },
      double: { grams: 140, calories: 40, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 340, total_carbohydrates: 8, dietary_fiber: 2, total_sugars: 4, protein: 2 },
    },
  },
  {
    name: "Fresh Tomato Salsa",
    category: "Toppings",
    ingredients: "tomatoes, onion, cilantro, jalapeno, lime juice, salt",
    portions: {
      light: { grams: 30, calories: 13, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 145, total_carbohydrates: 3, dietary_fiber: 0.5, total_sugars: 1.5, protein: 0 },
      standard: { grams: 60, calories: 25, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 290, total_carbohydrates: 6, dietary_fiber: 1, total_sugars: 3, protein: 1 },
      double: { grams: 120, calories: 50, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 580, total_carbohydrates: 12, dietary_fiber: 2, total_sugars: 6, protein: 2 },
    },
  },
  {
    name: "Roasted Chili-Corn Salsa",
    category: "Toppings",
    ingredients: "corn, jalapeno, onion, cilantro, lime juice, salt",
    portions: {
      light: { grams: 30, calories: 40, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 125, total_carbohydrates: 8, dietary_fiber: 1, total_sugars: 2, protein: 1 },
      standard: { grams: 60, calories: 80, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 250, total_carbohydrates: 15, dietary_fiber: 2, total_sugars: 4, protein: 2 },
      double: { grams: 120, calories: 160, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 500, total_carbohydrates: 30, dietary_fiber: 4, total_sugars: 8, protein: 4 },
    },
  },
  {
    name: "Tomatillo Green Chili Salsa",
    category: "Toppings",
    ingredients: "tomatillos, green chili peppers, onion, cilantro, garlic, cumin, salt",
    portions: {
      light: { grams: 30, calories: 8, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 135, total_carbohydrates: 2, dietary_fiber: 0.5, total_sugars: 1, protein: 0 },
      standard: { grams: 60, calories: 15, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 270, total_carbohydrates: 4, dietary_fiber: 1, total_sugars: 2, protein: 0 },
      double: { grams: 120, calories: 30, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 540, total_carbohydrates: 8, dietary_fiber: 2, total_sugars: 4, protein: 0 },
    },
  },
  {
    name: "Tomatillo Red Chili Salsa",
    category: "Toppings",
    ingredients: "tomatillos, red chili peppers, tomatoes, onion, garlic, cumin, oregano, salt",
    portions: {
      light: { grams: 30, calories: 15, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 210, total_carbohydrates: 2, dietary_fiber: 0.5, total_sugars: 1, protein: 0 },
      standard: { grams: 60, calories: 30, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 420, total_carbohydrates: 4, dietary_fiber: 1, total_sugars: 2, protein: 1 },
      double: { grams: 120, calories: 60, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 840, total_carbohydrates: 8, dietary_fiber: 2, total_sugars: 4, protein: 2 },
    },
  },
  {
    name: "Sour Cream",
    category: "Toppings",
    ingredients: "cream, milk, enzymes",
    portions: {
      light: { grams: 15, calories: 55, total_fat: 5, saturated_fat: 3, trans_fat: 0, cholesterol: 15, sodium: 15, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 1, protein: 1 },
      standard: { grams: 30, calories: 110, total_fat: 9, saturated_fat: 5.5, trans_fat: 0, cholesterol: 30, sodium: 30, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 2, protein: 2 },
      double: { grams: 60, calories: 220, total_fat: 18, saturated_fat: 11, trans_fat: 0, cholesterol: 60, sodium: 60, total_carbohydrates: 4, dietary_fiber: 0, total_sugars: 4, protein: 4 },
    },
  },
  {
    name: "Cheese",
    category: "Toppings",
    ingredients: "monterey jack cheese, milk, cheese cultures, salt, enzymes",
    portions: {
      light: { grams: 14, calories: 55, total_fat: 4.5, saturated_fat: 2.5, trans_fat: 0, cholesterol: 15, sodium: 95, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 4 },
      standard: { grams: 28, calories: 110, total_fat: 9, saturated_fat: 5, trans_fat: 0, cholesterol: 30, sodium: 190, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 7 },
      double: { grams: 56, calories: 220, total_fat: 18, saturated_fat: 10, trans_fat: 0, cholesterol: 60, sodium: 380, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 14 },
    },
  },
  {
    name: "Lettuce",
    category: "Toppings",
    ingredients: "romaine lettuce",
    portions: {
      light: { grams: 14, calories: 3, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 1, total_carbohydrates: 0.5, dietary_fiber: 0.5, total_sugars: 0, protein: 0 },
      standard: { grams: 28, calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 3, total_carbohydrates: 1, dietary_fiber: 1, total_sugars: 0, protein: 1 },
      double: { grams: 56, calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 5, total_carbohydrates: 2, dietary_fiber: 2, total_sugars: 0, protein: 1 },
    },
  },

  // Extras
  {
    name: "Guacamole",
    category: "Extras",
    ingredients: "avocado, lime juice, cilantro, jalapeno, onion, salt",
    portions: {
      light: { grams: 40, calories: 115, total_fat: 10, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 185, total_carbohydrates: 6, dietary_fiber: 4, total_sugars: 0.5, protein: 1.5 },
      standard: { grams: 80, calories: 230, total_fat: 20, saturated_fat: 3, trans_fat: 0, cholesterol: 0, sodium: 370, total_carbohydrates: 12, dietary_fiber: 8, total_sugars: 1, protein: 3 },
      double: { grams: 160, calories: 460, total_fat: 40, saturated_fat: 6, trans_fat: 0, cholesterol: 0, sodium: 740, total_carbohydrates: 24, dietary_fiber: 16, total_sugars: 2, protein: 6 },
    },
  },
  {
    name: "Queso Blanco",
    category: "Extras",
    ingredients: "milk, water, monterey jack cheese, serrano peppers, poblano peppers, salt, garlic, cumin",
    portions: {
      light: { grams: 40, calories: 60, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 280, total_carbohydrates: 3, dietary_fiber: 0, total_sugars: 1, protein: 3 },
      standard: { grams: 80, calories: 120, total_fat: 8, saturated_fat: 4, trans_fat: 0, cholesterol: 30, sodium: 560, total_carbohydrates: 5, dietary_fiber: 0, total_sugars: 2, protein: 5 },
      double: { grams: 160, calories: 240, total_fat: 16, saturated_fat: 8, trans_fat: 0, cholesterol: 60, sodium: 1120, total_carbohydrates: 10, dietary_fiber: 0, total_sugars: 4, protein: 10 },
    },
  },
];

// ─── SUBWAY ──────────────────────────────────────────────────────────

const subwayComponents: ComponentData[] = [
  // Bread (6-inch standard portion)
  {
    name: "Italian Bread",
    category: "Bread",
    ingredients: "enriched wheat flour, water, yeast, sugar, soybean oil, salt, wheat gluten",
    portions: {
      standard: { grams: 71, calories: 200, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 340, total_carbohydrates: 38, dietary_fiber: 1, total_sugars: 5, protein: 7 },
    },
  },
  {
    name: "Wheat Bread",
    category: "Bread",
    ingredients: "enriched wheat flour, water, whole wheat flour, yeast, sugar, soybean oil, salt, wheat gluten, caramel color",
    portions: {
      standard: { grams: 71, calories: 200, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 330, total_carbohydrates: 37, dietary_fiber: 3, total_sugars: 5, protein: 8 },
    },
  },
  {
    name: "Herb & Cheese Bread",
    category: "Bread",
    ingredients: "enriched wheat flour, water, yeast, sugar, soybean oil, salt, wheat gluten, parmesan cheese, herbs, garlic",
    portions: {
      standard: { grams: 78, calories: 250, total_fat: 5, saturated_fat: 1.5, trans_fat: 0, cholesterol: 5, sodium: 490, total_carbohydrates: 41, dietary_fiber: 1, total_sugars: 5, protein: 9 },
    },
  },
  {
    name: "Flatbread",
    category: "Bread",
    ingredients: "enriched wheat flour, water, yeast, sugar, soybean oil, salt, wheat gluten",
    portions: {
      standard: { grams: 57, calories: 150, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 270, total_carbohydrates: 27, dietary_fiber: 1, total_sugars: 2, protein: 5 },
    },
  },

  // Protein (6-inch portions)
  {
    name: "Turkey",
    category: "Protein",
    ingredients: "turkey breast, water, salt, dextrose, potassium lactate, modified corn starch",
    portions: {
      standard: { grams: 56, calories: 50, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 25, sodium: 500, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 1, protein: 9 },
    },
  },
  {
    name: "Ham",
    category: "Protein",
    ingredients: "ham, water, salt, dextrose, potassium lactate, sodium diacetate, sodium erythorbate",
    portions: {
      standard: { grams: 56, calories: 60, total_fat: 2, saturated_fat: 0.5, trans_fat: 0, cholesterol: 25, sodium: 520, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 1, protein: 9 },
    },
  },
  {
    name: "Roast Beef",
    category: "Protein",
    ingredients: "beef, water, salt, dextrose, potassium lactate, sodium phosphate",
    portions: {
      standard: { grams: 56, calories: 70, total_fat: 2.5, saturated_fat: 1, trans_fat: 0, cholesterol: 30, sodium: 390, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 12 },
    },
  },
  {
    name: "Chicken Breast",
    category: "Protein",
    ingredients: "chicken breast, water, soy protein, salt, sodium phosphates, modified potato starch",
    portions: {
      standard: { grams: 71, calories: 80, total_fat: 1.5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 45, sodium: 350, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 16 },
    },
  },
  {
    name: "Tuna",
    category: "Protein",
    ingredients: "tuna, mayonnaise (soybean oil, eggs, vinegar, salt), water",
    portions: {
      standard: { grams: 74, calories: 250, total_fat: 21, saturated_fat: 3.5, trans_fat: 0, cholesterol: 30, sodium: 310, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 16 },
    },
  },
  {
    name: "Italian BMT Meats",
    category: "Protein",
    ingredients: "genoa salami (pork, salt, dextrose, spices), pepperoni (pork, beef, salt, paprika), ham",
    portions: {
      standard: { grams: 56, calories: 140, total_fat: 10, saturated_fat: 4, trans_fat: 0, cholesterol: 40, sodium: 720, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 0, protein: 10 },
    },
  },
  {
    name: "Steak",
    category: "Protein",
    ingredients: "beef, water, seasoning (salt, garlic, onion, spices), soy sauce (wheat, soybean, salt, water)",
    portions: {
      standard: { grams: 71, calories: 110, total_fat: 4, saturated_fat: 1.5, trans_fat: 0, cholesterol: 40, sodium: 440, total_carbohydrates: 5, dietary_fiber: 0, total_sugars: 2, protein: 15 },
    },
  },

  // Cheese
  {
    name: "American Cheese",
    category: "Cheese",
    ingredients: "milk, water, milk fat, sodium citrate, salt, cheese cultures, sorbic acid, enzymes, artificial color",
    portions: {
      standard: { grams: 11, calories: 40, total_fat: 3.5, saturated_fat: 2, trans_fat: 0, cholesterol: 10, sodium: 200, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 2 },
    },
  },
  {
    name: "Provolone Cheese",
    category: "Cheese",
    ingredients: "milk, cheese cultures, salt, enzymes",
    portions: {
      standard: { grams: 14, calories: 50, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 10, sodium: 125, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 4 },
    },
  },
  {
    name: "Pepper Jack Cheese",
    category: "Cheese",
    ingredients: "milk, jalapeno peppers, cheese cultures, salt, enzymes",
    portions: {
      standard: { grams: 14, calories: 50, total_fat: 4, saturated_fat: 2.5, trans_fat: 0, cholesterol: 15, sodium: 100, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 3 },
    },
  },
  {
    name: "Swiss Cheese",
    category: "Cheese",
    ingredients: "milk, cheese cultures, salt, enzymes",
    portions: {
      standard: { grams: 14, calories: 50, total_fat: 4, saturated_fat: 2, trans_fat: 0, cholesterol: 15, sodium: 30, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 4 },
    },
  },

  // Veggies
  {
    name: "Lettuce",
    category: "Veggies",
    ingredients: "iceberg lettuce",
    portions: {
      standard: { grams: 21, calories: 3, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 2, total_carbohydrates: 1, dietary_fiber: 0.5, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Tomato",
    category: "Veggies",
    ingredients: "tomato",
    portions: {
      standard: { grams: 34, calories: 6, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 2, total_carbohydrates: 1, dietary_fiber: 0.5, total_sugars: 1, protein: 0 },
    },
  },
  {
    name: "Onion",
    category: "Veggies",
    ingredients: "yellow onion",
    portions: {
      standard: { grams: 14, calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 1, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 1, protein: 0 },
    },
  },
  {
    name: "Peppers",
    category: "Veggies",
    ingredients: "green bell pepper",
    portions: {
      standard: { grams: 11, calories: 2, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, total_carbohydrates: 0.5, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Cucumbers",
    category: "Veggies",
    ingredients: "cucumber",
    portions: {
      standard: { grams: 14, calories: 2, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 0, total_carbohydrates: 0.5, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Olives",
    category: "Veggies",
    ingredients: "black olives",
    portions: {
      standard: { grams: 4, calories: 5, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 25, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Pickles",
    category: "Veggies",
    ingredients: "cucumbers, water, vinegar, salt, calcium chloride, alum, natural flavors",
    portions: {
      standard: { grams: 11, calories: 1, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 115, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Jalapenos",
    category: "Veggies",
    ingredients: "jalapeno peppers",
    portions: {
      standard: { grams: 4, calories: 1, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 5, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Spinach",
    category: "Veggies",
    ingredients: "spinach",
    portions: {
      standard: { grams: 14, calories: 3, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 11, total_carbohydrates: 0.5, dietary_fiber: 0.5, total_sugars: 0, protein: 0.5 },
    },
  },

  // Sauce
  {
    name: "Mayo",
    category: "Sauce",
    ingredients: "soybean oil, water, egg yolks, vinegar, salt, sugar, lemon juice",
    portions: {
      standard: { grams: 14, calories: 100, total_fat: 11, saturated_fat: 1.5, trans_fat: 0, cholesterol: 5, sodium: 80, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Mustard",
    category: "Sauce",
    ingredients: "water, vinegar, mustard seed, salt, turmeric, paprika",
    portions: {
      standard: { grams: 7, calories: 5, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 65, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Oil & Vinegar",
    category: "Sauce",
    ingredients: "olive oil blend, red wine vinegar",
    portions: {
      standard: { grams: 7, calories: 45, total_fat: 5, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 0, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 0 },
    },
  },
  {
    name: "Ranch",
    category: "Sauce",
    ingredients: "soybean oil, water, buttermilk, egg yolk, vinegar, salt, garlic, onion, herbs",
    portions: {
      standard: { grams: 21, calories: 110, total_fat: 11, saturated_fat: 2, trans_fat: 0, cholesterol: 10, sodium: 200, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 1, protein: 0 },
    },
  },
  {
    name: "Sweet Onion Sauce",
    category: "Sauce",
    ingredients: "high fructose corn syrup, water, vinegar, onion, salt, poppy seeds",
    portions: {
      standard: { grams: 21, calories: 40, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 85, total_carbohydrates: 9, dietary_fiber: 0, total_sugars: 8, protein: 0 },
    },
  },
  {
    name: "Chipotle Southwest Sauce",
    category: "Sauce",
    ingredients: "soybean oil, water, chipotle peppers, egg yolks, vinegar, salt, sugar, garlic",
    portions: {
      standard: { grams: 21, calories: 100, total_fat: 10, saturated_fat: 1.5, trans_fat: 0, cholesterol: 10, sodium: 220, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 1, protein: 0 },
    },
  },
];

// ─── SWEETGREEN ──────────────────────────────────────────────────────

const sweetgreenComponents: ComponentData[] = [
  // Base
  {
    name: "Mixed Greens",
    category: "Base",
    ingredients: "baby spinach, mesclun, romaine lettuce",
    portions: {
      standard: { grams: 85, calories: 15, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 30, total_carbohydrates: 2, dietary_fiber: 2, total_sugars: 0, protein: 2 },
    },
  },
  {
    name: "Warm Wild Rice",
    category: "Base",
    ingredients: "wild rice, brown rice, quinoa, olive oil, salt",
    portions: {
      standard: { grams: 130, calories: 190, total_fat: 3, saturated_fat: 0.5, trans_fat: 0, cholesterol: 0, sodium: 180, total_carbohydrates: 37, dietary_fiber: 3, total_sugars: 0, protein: 5 },
    },
  },
  {
    name: "Arugula",
    category: "Base",
    ingredients: "arugula",
    portions: {
      standard: { grams: 85, calories: 20, total_fat: 0.5, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 22, total_carbohydrates: 3, dietary_fiber: 1.5, total_sugars: 1.5, protein: 2 },
    },
  },

  // Protein
  {
    name: "Chicken",
    category: "Protein",
    ingredients: "chicken breast, olive oil, salt, pepper, herbs",
    portions: {
      standard: { grams: 113, calories: 190, total_fat: 7, saturated_fat: 1.5, trans_fat: 0, cholesterol: 95, sodium: 310, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 32 },
    },
  },
  {
    name: "Salmon",
    category: "Protein",
    ingredients: "atlantic salmon, olive oil, salt, pepper",
    portions: {
      standard: { grams: 113, calories: 240, total_fat: 14, saturated_fat: 2.5, trans_fat: 0, cholesterol: 65, sodium: 270, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 28 },
    },
  },
  {
    name: "Tofu",
    category: "Protein",
    ingredients: "tofu (soybeans, water, calcium sulfate), sesame oil, tamari (soybean, wheat, salt, water), ginger",
    portions: {
      standard: { grams: 113, calories: 180, total_fat: 11, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 390, total_carbohydrates: 6, dietary_fiber: 2, total_sugars: 1, protein: 15 },
    },
  },

  // Toppings
  {
    name: "Avocado",
    category: "Toppings",
    ingredients: "avocado",
    portions: {
      standard: { grams: 50, calories: 80, total_fat: 7, saturated_fat: 1, trans_fat: 0, cholesterol: 0, sodium: 3, total_carbohydrates: 4, dietary_fiber: 3, total_sugars: 0, protein: 1 },
    },
  },
  {
    name: "Tomatoes",
    category: "Toppings",
    ingredients: "grape tomatoes",
    portions: {
      standard: { grams: 50, calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 3, total_carbohydrates: 2, dietary_fiber: 1, total_sugars: 1.5, protein: 0.5 },
    },
  },
  {
    name: "Cucumber",
    category: "Toppings",
    ingredients: "cucumber",
    portions: {
      standard: { grams: 40, calories: 6, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 1, total_carbohydrates: 1, dietary_fiber: 0.5, total_sugars: 0.5, protein: 0 },
    },
  },
  {
    name: "Goat Cheese",
    category: "Toppings",
    ingredients: "goat milk, salt, cheese cultures, enzymes",
    portions: {
      standard: { grams: 28, calories: 75, total_fat: 6, saturated_fat: 4, trans_fat: 0, cholesterol: 15, sodium: 130, total_carbohydrates: 0, dietary_fiber: 0, total_sugars: 0, protein: 5 },
    },
  },
  {
    name: "Pickled Onions",
    category: "Toppings",
    ingredients: "red onions, vinegar, sugar, salt, spices",
    portions: {
      standard: { grams: 20, calories: 10, total_fat: 0, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 50, total_carbohydrates: 2, dietary_fiber: 0, total_sugars: 2, protein: 0 },
    },
  },
  {
    name: "Roasted Sweet Potato",
    category: "Toppings",
    ingredients: "sweet potato, olive oil, salt",
    portions: {
      standard: { grams: 85, calories: 90, total_fat: 2, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 75, total_carbohydrates: 18, dietary_fiber: 3, total_sugars: 5, protein: 1 },
    },
  },
  {
    name: "Corn",
    category: "Toppings",
    ingredients: "corn, olive oil, salt",
    portions: {
      standard: { grams: 40, calories: 45, total_fat: 1, saturated_fat: 0, trans_fat: 0, cholesterol: 0, sodium: 40, total_carbohydrates: 9, dietary_fiber: 1, total_sugars: 2, protein: 1 },
    },
  },

  // Dressing
  {
    name: "Green Goddess Dressing",
    category: "Dressing",
    ingredients: "olive oil, tahini, basil, lemon juice, tarragon, chives, garlic, salt, pepper",
    portions: {
      standard: { grams: 35, calories: 140, total_fat: 14, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 230, total_carbohydrates: 3, dietary_fiber: 0.5, total_sugars: 0.5, protein: 1 },
    },
  },
  {
    name: "Balsamic Vinaigrette",
    category: "Dressing",
    ingredients: "olive oil, balsamic vinegar, dijon mustard, garlic, salt, pepper",
    portions: {
      standard: { grams: 35, calories: 130, total_fat: 13, saturated_fat: 2, trans_fat: 0, cholesterol: 0, sodium: 190, total_carbohydrates: 4, dietary_fiber: 0, total_sugars: 3, protein: 0 },
    },
  },
  {
    name: "Caesar Dressing",
    category: "Dressing",
    ingredients: "olive oil, parmesan cheese, lemon juice, anchovy paste, garlic, egg yolk, dijon mustard, salt, pepper",
    portions: {
      standard: { grams: 35, calories: 150, total_fat: 16, saturated_fat: 2.5, trans_fat: 0, cholesterol: 15, sodium: 250, total_carbohydrates: 1, dietary_fiber: 0, total_sugars: 0, protein: 1 },
    },
  },
  {
    name: "Lime Cilantro Jalapeno Dressing",
    category: "Dressing",
    ingredients: "olive oil, lime juice, cilantro, jalapeno, garlic, salt, agave",
    portions: {
      standard: { grams: 35, calories: 110, total_fat: 11, saturated_fat: 1.5, trans_fat: 0, cholesterol: 0, sodium: 170, total_carbohydrates: 3, dietary_fiber: 0, total_sugars: 2, protein: 0 },
    },
  },
];

// ─── INSERT LOGIC ────────────────────────────────────────────────────

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO meal_components
    (id, chain_name, component_name, component_category, portion_type, portion_grams,
     calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
     total_carbohydrates, dietary_fiber, total_sugars, protein,
     ingredients_text, allergens, dietary_tags)
  VALUES
    (@id, @chain_name, @component_name, @component_category, @portion_type, @portion_grams,
     @calories, @total_fat, @saturated_fat, @trans_fat, @cholesterol, @sodium,
     @total_carbohydrates, @dietary_fiber, @total_sugars, @protein,
     @ingredients_text, @allergens, @dietary_tags)
`);

function importChain(chainName: string, components: ComponentData[]) {
  let count = 0;

  for (const comp of components) {
    for (const [portionType, nutrition] of Object.entries(comp.portions)) {
      const ingredientsText = comp.ingredients || "";
      const allergens = detectAllergens(ingredientsText).join(",");
      const dietaryTags = detectDietaryTags(ingredientsText, {
        total_carbohydrates: nutrition.total_carbohydrates,
        protein: nutrition.protein,
        total_fat: nutrition.total_fat,
        total_sugars: nutrition.total_sugars,
        dietary_fiber: nutrition.dietary_fiber,
      }).join(",");

      insertStmt.run({
        id: uuid(),
        chain_name: chainName,
        component_name: comp.name,
        component_category: comp.category,
        portion_type: portionType,
        portion_grams: nutrition.grams,
        calories: nutrition.calories,
        total_fat: nutrition.total_fat,
        saturated_fat: nutrition.saturated_fat,
        trans_fat: nutrition.trans_fat,
        cholesterol: nutrition.cholesterol,
        sodium: nutrition.sodium,
        total_carbohydrates: nutrition.total_carbohydrates,
        dietary_fiber: nutrition.dietary_fiber,
        total_sugars: nutrition.total_sugars,
        protein: nutrition.protein,
        ingredients_text: ingredientsText || null,
        allergens: allergens || null,
        dietary_tags: dietaryTags || null,
      });
      count++;
    }
  }

  return count;
}

// Run inside a transaction for performance
const importAll = db.transaction(() => {
  console.log("Importing Chipotle meal components...");
  const chipotleCount = importChain("Chipotle", chipotleComponents);
  console.log(`  -> ${chipotleCount} Chipotle component rows inserted`);

  console.log("Importing Subway meal components...");
  const subwayCount = importChain("Subway", subwayComponents);
  console.log(`  -> ${subwayCount} Subway component rows inserted`);

  console.log("Importing Sweetgreen meal components...");
  const sweetgreenCount = importChain("Sweetgreen", sweetgreenComponents);
  console.log(`  -> ${sweetgreenCount} Sweetgreen component rows inserted`);

  return chipotleCount + subwayCount + sweetgreenCount;
});

const total = importAll();
console.log(`\nDone! ${total} total meal component rows imported.`);

// Verify
const chainCounts = db
  .prepare("SELECT chain_name, COUNT(*) as count FROM meal_components GROUP BY chain_name")
  .all();
console.log("\nVerification:");
for (const row of chainCounts as any[]) {
  console.log(`  ${row.chain_name}: ${row.count} rows`);
}
