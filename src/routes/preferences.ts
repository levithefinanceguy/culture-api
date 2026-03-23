import { Router, Request, Response } from "express";
import db from "../data/database";

export const preferenceRoutes = Router();

// --- PUT / — Set or update user preferences ---
preferenceRoutes.put("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  const {
    avoid_ingredients,
    dietary_goals,
    health_conditions,
    calorie_target,
    protein_target,
  } = req.body;

  // Validate types
  if (avoid_ingredients !== undefined && typeof avoid_ingredients !== "string") {
    res.status(400).json({ error: "avoid_ingredients must be a comma-separated string" });
    return;
  }
  if (dietary_goals !== undefined && typeof dietary_goals !== "string") {
    res.status(400).json({ error: "dietary_goals must be a comma-separated string" });
    return;
  }
  if (health_conditions !== undefined && typeof health_conditions !== "string") {
    res.status(400).json({ error: "health_conditions must be a comma-separated string" });
    return;
  }
  if (calorie_target !== undefined && calorie_target !== null && typeof calorie_target !== "number") {
    res.status(400).json({ error: "calorie_target must be a number" });
    return;
  }
  if (protein_target !== undefined && protein_target !== null && typeof protein_target !== "number") {
    res.status(400).json({ error: "protein_target must be a number" });
    return;
  }

  const existing = db.prepare("SELECT * FROM user_preferences WHERE api_key = ?").get(apiKey) as any;

  if (existing) {
    db.prepare(`
      UPDATE user_preferences
      SET avoid_ingredients = ?,
          dietary_goals = ?,
          health_conditions = ?,
          calorie_target = ?,
          protein_target = ?,
          updated_at = datetime('now')
      WHERE api_key = ?
    `).run(
      avoid_ingredients ?? existing.avoid_ingredients,
      dietary_goals ?? existing.dietary_goals,
      health_conditions ?? existing.health_conditions,
      calorie_target !== undefined ? calorie_target : existing.calorie_target,
      protein_target !== undefined ? protein_target : existing.protein_target,
      apiKey,
    );
  } else {
    db.prepare(`
      INSERT INTO user_preferences (api_key, avoid_ingredients, dietary_goals, health_conditions, calorie_target, protein_target)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      apiKey,
      avoid_ingredients || null,
      dietary_goals || null,
      health_conditions || null,
      calorie_target ?? null,
      protein_target ?? null,
    );
  }

  const updated = db.prepare("SELECT * FROM user_preferences WHERE api_key = ?").get(apiKey) as any;

  res.json({
    message: existing ? "Preferences updated" : "Preferences created",
    preferences: formatPreferences(updated),
  });
});

// --- GET / — Get current preferences ---
preferenceRoutes.get("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  const prefs = db.prepare("SELECT * FROM user_preferences WHERE api_key = ?").get(apiKey) as any;

  if (!prefs) {
    res.json({
      preferences: null,
      message: "No preferences set. Use PUT /api/v1/preferences to configure.",
    });
    return;
  }

  res.json({ preferences: formatPreferences(prefs) });
});

function formatPreferences(row: any) {
  return {
    avoid_ingredients: row.avoid_ingredients
      ? row.avoid_ingredients.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
    dietary_goals: row.dietary_goals
      ? row.dietary_goals.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
    health_conditions: row.health_conditions
      ? row.health_conditions.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
    calorie_target: row.calorie_target,
    protein_target: row.protein_target,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
