import { Food, Vendor } from "../models/food";

// In-memory store for now — will move to a database later
class DataStore {
  private foods: Map<string, Food> = new Map();
  private vendors: Map<string, Vendor> = new Map();

  // Foods
  addFood(food: Food): void {
    this.foods.set(food.id, food);
  }

  getFood(id: string): Food | undefined {
    return this.foods.get(id);
  }

  searchFoods(query: string, limit = 25, offset = 0): { foods: Food[]; total: number } {
    const q = query.toLowerCase();
    const results = Array.from(this.foods.values()).filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.brand?.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
    return {
      foods: results.slice(offset, offset + limit),
      total: results.length,
    };
  }

  getFoodsByBarcode(barcode: string): Food | undefined {
    return Array.from(this.foods.values()).find((f) => f.barcode === barcode);
  }

  getFoodsByVendor(vendorId: string): Food[] {
    return Array.from(this.foods.values()).filter((f) => f.vendorId === vendorId);
  }

  getFoodCount(): number {
    return this.foods.size;
  }

  // Vendors
  addVendor(vendor: Vendor): void {
    this.vendors.set(vendor.id, vendor);
  }

  getVendor(id: string): Vendor | undefined {
    return this.vendors.get(id);
  }

  getAllVendors(limit = 25, offset = 0): { vendors: Vendor[]; total: number } {
    const all = Array.from(this.vendors.values());
    return {
      vendors: all.slice(offset, offset + limit),
      total: all.length,
    };
  }
}

export const store = new DataStore();
