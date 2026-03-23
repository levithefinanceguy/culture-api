export interface NutritionInfo {
  calories: number;
  totalFat: number;
  saturatedFat: number;
  transFat: number;
  cholesterol: number;
  sodium: number;
  totalCarbohydrates: number;
  dietaryFiber: number;
  totalSugars: number;
  protein: number;
  vitaminD?: number;
  calcium?: number;
  iron?: number;
  potassium?: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  category: string;
  servingSize: number;
  servingUnit: string;
  nutrition: NutritionInfo;
  ingredients?: string[];
  barcode?: string;
  source: "usda" | "vendor" | "community";
  vendorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: "restaurant" | "food_truck" | "farmers_market" | "independent";
  location?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  createdAt: string;
}
