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
import { authenticateApiKey } from "./middleware/auth";
import { docsRoutes } from "./routes/docs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public routes
app.get("/", (_req, res) => {
  res.json({
    name: "Culture API",
    version: "1.0.0",
    description: "The #1 Food Nutrition API — powered by USDA-verified ingredient data",
    endpoints: {
      search: "GET /api/v1/foods/search?q=chicken",
      food: "GET /api/v1/foods/:id",
      barcode: "GET /api/v1/foods/barcode/:code",
      stats: "GET /api/v1/foods/stats",
      vendors: "GET /api/v1/vendors",
      parse: "POST /api/v1/parse",
      register: "POST /api/v1/keys/register",
      contributions: "POST /api/v1/contributions",
      myContributions: "GET /api/v1/contributions",
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

app.listen(PORT, () => {
  console.log(`Culture API running on port ${PORT}`);
});

export default app;
