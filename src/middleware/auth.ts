import { Request, Response, NextFunction } from "express";
import db from "../data/database";
import { rateLimitMiddleware } from "./rate-limiter";
import * as admin from "firebase-admin";

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or default credentials)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "cheeseapphq" });
}

/**
 * Authenticates requests via either:
 * 1. Firebase Auth token (Bearer header) — no rate limit, for Cheese app
 * 2. API key (x-api-key header) — rate limited, for public API users
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Fast lane: Firebase Auth token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    admin.auth().verifyIdToken(token).then(() => {
      (req as any).apiKeyOwner = "firebase";
      (req as any).apiKeyTier = "unlimited";
      next();
    }).catch(() => {
      res.status(401).json({ error: "Invalid Firebase token." });
    });
    return;
  }

  // Standard: API key auth
  const apiKey = req.headers["x-api-key"] as string || req.query.api_key as string;

  if (!apiKey) {
    res.status(401).json({ error: "API key required. Pass via x-api-key header or api_key query param." });
    return;
  }

  const record = db.prepare("SELECT * FROM api_keys WHERE key = ?").get(apiKey) as any;

  if (!record) {
    res.status(401).json({ error: "Invalid API key." });
    return;
  }

  (req as any).apiKeyOwner = record.owner;
  (req as any).apiKeyTier = record.tier;

  // Delegate rate limiting to the sliding window rate limiter
  rateLimitMiddleware(req, res, next);
}

export function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "culture_";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
