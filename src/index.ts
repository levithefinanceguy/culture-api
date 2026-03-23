import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { foodRoutes } from "./routes/foods";
import { vendorRoutes } from "./routes/vendors";
import { apiKeyRoutes } from "./routes/apikeys";
import { parseRoutes } from "./routes/parse";
import { contributionRoutes } from "./routes/contributions";
import { adminRoutes } from "./routes/admin";
import { scanRoutes } from "./routes/scan";
import { servingRoutes } from "./routes/servings";
import { mealRoutes } from "./routes/meals";
import { alternativeRoutes } from "./routes/alternatives";
import { authenticateApiKey } from "./middleware/auth";
import { docsRoutes } from "./routes/docs";
import { responseTimeLogger, compressionMiddleware, enableEtag } from "./middleware/performance";
import { globalErrorHandler, notFoundHandler } from "./middleware/error-handler";
import db from "./data/database";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Performance middleware
enableEtag(app);
app.use(compressionMiddleware);
app.use(responseTimeLogger);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
  const foodCount = (db.prepare("SELECT COUNT(*) as count FROM foods").get() as any).count;
  res.json({
    status: "ok",
    uptime: process.uptime(),
    foodCount,
    version: "1.0.0",
  });
});

// Public routes
app.get("/", (_req, res) => {
  res.json({
    name: "Culture API",
    version: "1.0.0",
    description: "The #1 Food Nutrition API — powered by USDA-verified ingredient data",
    docs: "GET /docs",
    endpoints: {
      keys: {
        register: "POST /api/v1/keys/register",
        status: "GET /api/v1/keys/status",
      },
      foods: {
        search: "GET /api/v1/foods/search?q=chicken",
        stats: "GET /api/v1/foods/stats",
        top: "GET /api/v1/foods/top",
        food: "GET /api/v1/foods/:id",
        barcode: "GET /api/v1/foods/barcode/:code",
        servings: "GET /api/v1/foods/:id/servings?slices=&servings=&amount=&unit=",
        sizes: "GET /api/v1/foods/sizes?q=&brand=",
      },
      parse: "POST /api/v1/parse",
      scan: {
        label: "POST /api/v1/scan/label",
        submit: "POST /api/v1/scan/submit",
      },
      vendors: {
        list: "GET /api/v1/vendors",
        register: "POST /api/v1/vendors/register",
        details: "GET /api/v1/vendors/:id",
        foods: "GET /api/v1/vendors/:id/foods",
        submitFood: "POST /api/v1/vendors/:id/foods",
      },
      meals: {
        chains: "GET /api/v1/meals/chains",
        components: "GET /api/v1/meals/components?chain=",
        build: "POST /api/v1/meals/build",
        save: "POST /api/v1/meals/save",
      },
      contributions: {
        submit: "POST /api/v1/contributions",
        list: "GET /api/v1/contributions",
        details: "GET /api/v1/contributions/:id",
      },
      alternatives: {
        forFood:
          "GET /api/v1/foods/:id/alternatives?limit=10&goal=low_calorie|high_protein|low_fat|low_carb|low_sodium",
        byCategory:
          "GET /api/v1/alternatives/category/:category?limit=10&goal=",
      },
      admin: {
        contributions: "GET /api/v1/admin/contributions?status=",
        approve: "POST /api/v1/admin/contributions/:id/approve",
        reject: "POST /api/v1/admin/contributions/:id/reject",
      },
    },
    auth: "Pass your API key via x-api-key header or api_key query param",
  });
});

// Documentation (public)
app.use("/docs", docsRoutes);

// API key management (public)
app.use("/api/v1/keys", apiKeyRoutes);

// Protected routes
app.use("/api/v1/foods", authenticateApiKey, servingRoutes);
app.use("/api/v1/foods", authenticateApiKey, foodRoutes);
app.use("/api/v1/vendors", authenticateApiKey, vendorRoutes);
app.use("/api/v1/parse", authenticateApiKey, parseRoutes);
app.use("/api/v1/contributions", authenticateApiKey, contributionRoutes);
app.use("/api/v1/admin", authenticateApiKey, adminRoutes);
app.use("/api/v1/scan", authenticateApiKey, scanRoutes);
app.use("/api/v1/meals", authenticateApiKey, mealRoutes);
app.use("/api/v1", authenticateApiKey, alternativeRoutes);

// Error handling (must be after all routes)
app.use(notFoundHandler);
app.use(globalErrorHandler);

const server = app.listen(PORT, () => {
  console.log(`Culture API running on port ${PORT}`);
});

// Graceful shutdown: close the database and server on SIGTERM/SIGINT
function gracefulShutdown(signal: string): void {
  console.log(`\n[${new Date().toISOString()}] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    db.close();
    console.log("Database connection closed.");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
