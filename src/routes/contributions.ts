import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import db from "../data/database";
import { formatContribution } from "../services/contribution-format";

export const contributionRoutes = Router();

// Submit a new contribution
contributionRoutes.post("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;
  const { type, food_id, ...rest } = req.body;

  if (!type) {
    res.status(400).json({ error: "type is required (new_food, correction, barcode_add)" });
    return;
  }

  const validTypes = ["new_food", "correction", "barcode_add"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    return;
  }

  // Validate based on type
  if (type === "new_food") {
    const { name, category, calories } = rest;
    if (!name) {
      res.status(400).json({ error: "name is required for new_food contributions" });
      return;
    }
    if (!category) {
      res.status(400).json({ error: "category is required for new_food contributions" });
      return;
    }
    if (calories === undefined || calories === null) {
      res.status(400).json({ error: "calories is required for new_food contributions" });
      return;
    }
  }

  if (type === "correction") {
    if (!food_id) {
      res.status(400).json({ error: "food_id is required for correction contributions" });
      return;
    }
    // Verify the food exists
    const food = db.prepare("SELECT id FROM foods WHERE id = ?").get(food_id);
    if (!food) {
      res.status(404).json({ error: "Food not found for the given food_id" });
      return;
    }
    // Must have at least one field to correct
    const correctionFields = { ...rest };
    delete correctionFields.type;
    if (Object.keys(correctionFields).length === 0) {
      res.status(400).json({ error: "At least one field to correct is required" });
      return;
    }
  }

  if (type === "barcode_add") {
    if (!food_id) {
      res.status(400).json({ error: "food_id is required for barcode_add contributions" });
      return;
    }
    if (!rest.barcode) {
      res.status(400).json({ error: "barcode is required for barcode_add contributions" });
      return;
    }
    // Verify the food exists
    const food = db.prepare("SELECT id FROM foods WHERE id = ?").get(food_id);
    if (!food) {
      res.status(404).json({ error: "Food not found for the given food_id" });
      return;
    }
  }

  const id = uuid();
  const data = JSON.stringify(rest);

  db.prepare(`
    INSERT INTO contributions (id, api_key, type, food_id, data, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, apiKey, type, food_id || null, data);

  // Contributions stay pending for admin review — no auto-insert into foods table

  res.status(201).json({
    id,
    type,
    status: "pending",
    food_id: food_id || null,
    message: type === "new_food"
      ? "Food added to the database. It's now searchable!"
      : "Contribution submitted for review. Thank you!",
  });
});

// List your own contributions
contributionRoutes.get("/", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;
  const status = req.query.status as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  let sql = "SELECT * FROM contributions WHERE api_key = @apiKey";
  const params: any = { apiKey, limit, offset };

  if (status) {
    sql += " AND status = @status";
    params.status = status;
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
  const total = (db.prepare(countSql).get(params) as any).total;

  sql += " ORDER BY created_at DESC LIMIT @limit OFFSET @offset";
  const contributions = db.prepare(sql).all(params);

  res.json({
    contributions: contributions.map((c) => formatContribution(c)),
    total,
    limit,
    offset,
  });
});

// Get a specific contribution
contributionRoutes.get("/:id", (req: Request, res: Response) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  const contribution = db.prepare(
    "SELECT * FROM contributions WHERE id = ? AND api_key = ?"
  ).get(req.params.id, apiKey) as any;

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.json(formatContribution(contribution));
});

