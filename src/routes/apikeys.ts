import { Router } from "express";
import db from "../data/database";
import { generateApiKey } from "../middleware/auth";

export const apiKeyRoutes = Router();

// Request an API key
apiKeyRoutes.post("/register", (req, res) => {
  const { name, email } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const key = generateApiKey();

  db.prepare("INSERT INTO api_keys (key, owner, tier) VALUES (?, ?, 'free')").run(key, name);

  res.status(201).json({
    apiKey: key,
    owner: name,
    tier: "free",
    rateLimit: "100 requests/day",
    message: "Store this key securely. It won't be shown again.",
  });
});

// Check key status
apiKeyRoutes.get("/status", (req, res) => {
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  if (!apiKey) {
    res.status(400).json({ error: "Provide your API key via x-api-key header" });
    return;
  }

  const record = db.prepare("SELECT owner, tier, requests_today, last_request_date, created_at FROM api_keys WHERE key = ?").get(apiKey) as any;

  if (!record) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  const limits: Record<string, number> = { free: 100, pro: 10000, enterprise: 100000, admin: 100000 };

  res.json({
    owner: record.owner,
    tier: record.tier,
    requestsToday: record.requests_today,
    dailyLimit: limits[record.tier],
    createdAt: record.created_at,
  });
});
