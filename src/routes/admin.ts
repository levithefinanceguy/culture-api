import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";

export const adminRoutes = Router();

// Admin authorization middleware
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const tier = (req as any).apiKeyTier;
  if (tier !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

adminRoutes.use(requireAdmin);

// List contributions (with optional status filter)
adminRoutes.get("/contributions", (req: Request, res: Response) => {
  const status = req.query.status as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let sql = "SELECT * FROM contributions WHERE 1=1";
  const params: any = { limit, offset };

  if (status) {
    sql += " AND status = @status";
    params.status = status;
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
  const total = (db.prepare(countSql).get(params) as any).total;

  sql += " ORDER BY created_at DESC LIMIT @limit OFFSET @offset";
  const contributions = db.prepare(sql).all(params);

  res.json({
    contributions: contributions.map(formatContribution),
    total,
    limit,
    offset,
  });
});

// Approve a contribution
adminRoutes.post("/contributions/:id/approve", (req: Request, res: Response) => {
  const contribution = db.prepare(
    "SELECT * FROM contributions WHERE id = ?"
  ).get(req.params.id) as any;

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (contribution.status !== "pending") {
    res.status(400).json({ error: `Contribution already ${contribution.status}` });
    return;
  }

  const data = JSON.parse(contribution.data);
  const now = new Date().toISOString();

  try {
    if (contribution.type === "new_food") {
      applyNewFood(data);
    } else if (contribution.type === "correction") {
      applyCorrection(contribution.food_id, data);
    } else if (contribution.type === "barcode_add") {
      applyBarcodeAdd(contribution.food_id, data);
    }

    db.prepare(`
      UPDATE contributions SET status = 'approved', reviewed_at = ? WHERE id = ?
    `).run(now, req.params.id);

    res.json({
      id: contribution.id,
      status: "approved",
      message: `Contribution approved and applied.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to apply contribution: ${err.message}` });
  }
});

// Reject a contribution
adminRoutes.post("/contributions/:id/reject", (req: Request, res: Response) => {
  const contribution = db.prepare(
    "SELECT * FROM contributions WHERE id = ?"
  ).get(req.params.id) as any;

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (contribution.status !== "pending") {
    res.status(400).json({ error: `Contribution already ${contribution.status}` });
    return;
  }

  const { reason } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE contributions SET status = 'rejected', reviewed_at = ?, reviewer_note = ? WHERE id = ?
  `).run(now, reason || null, req.params.id);

  res.json({
    id: contribution.id,
    status: "rejected",
    reason: reason || null,
    message: "Contribution rejected.",
  });
});

function applyNewFood(data: any) {
  const id = uuid();
  db.prepare(`
    INSERT INTO foods (
      id, name, brand, category, serving_size, serving_unit, barcode, source,
      calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium,
      total_carbohydrates, dietary_fiber, total_sugars, protein,
      vitamin_d, calcium, iron, potassium, ingredients_text
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'community',
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    id,
    data.name,
    data.brand || null,
    data.category || "Uncategorized",
    data.serving_size || 100,
    data.serving_unit || "g",
    data.barcode || null,
    data.calories || 0,
    data.total_fat || 0,
    data.saturated_fat || 0,
    data.trans_fat || 0,
    data.cholesterol || 0,
    data.sodium || 0,
    data.total_carbohydrates || 0,
    data.dietary_fiber || 0,
    data.total_sugars || 0,
    data.protein || 0,
    data.vitamin_d || null,
    data.calcium || null,
    data.iron || null,
    data.potassium || null,
    data.ingredients_text || null,
  );
  return id;
}

function applyCorrection(foodId: string, data: any) {
  // Only allow updating known food columns
  const allowedFields: Record<string, string> = {
    name: "name",
    brand: "brand",
    category: "category",
    serving_size: "serving_size",
    serving_unit: "serving_unit",
    barcode: "barcode",
    calories: "calories",
    total_fat: "total_fat",
    saturated_fat: "saturated_fat",
    trans_fat: "trans_fat",
    cholesterol: "cholesterol",
    sodium: "sodium",
    total_carbohydrates: "total_carbohydrates",
    dietary_fiber: "dietary_fiber",
    total_sugars: "total_sugars",
    protein: "protein",
    vitamin_d: "vitamin_d",
    calcium: "calcium",
    iron: "iron",
    potassium: "potassium",
    ingredients_text: "ingredients_text",
  };

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields[key]) {
      setClauses.push(`${allowedFields[key]} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    throw new Error("No valid fields to update");
  }

  setClauses.push("updated_at = datetime('now')");
  values.push(foodId);

  db.prepare(`UPDATE foods SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
}

function applyBarcodeAdd(foodId: string, data: any) {
  if (!data.barcode) {
    throw new Error("No barcode provided");
  }
  db.prepare("UPDATE foods SET barcode = ?, updated_at = datetime('now') WHERE id = ?").run(
    data.barcode,
    foodId,
  );
}

function formatContribution(row: any) {
  return {
    id: row.id,
    apiKey: row.api_key,
    type: row.type,
    status: row.status,
    foodId: row.food_id,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewerNote: row.reviewer_note,
  };
}
