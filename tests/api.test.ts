import request from "supertest";
import app from "../src/index";

let apiKey: string;

beforeAll(async () => {
  // Register an API key to use across all tests
  const res = await request(app)
    .post("/api/v1/keys/register")
    .send({ name: "test-runner", email: "test@test.com" });
  apiKey = res.body.apiKey;
});

// ---------- Health check ----------

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("foodCount");
    expect(res.body).toHaveProperty("uptime");
  });
});

// ---------- API Keys ----------

describe("API Keys", () => {
  it("POST /api/v1/keys/register returns 201 with apiKey", async () => {
    const res = await request(app)
      .post("/api/v1/keys/register")
      .send({ name: "another-test" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("apiKey");
    expect(res.body.apiKey).toMatch(/^culture_/);
    expect(res.body.tier).toBe("free");
  });

  it("GET /api/v1/keys/status returns key info", async () => {
    const res = await request(app)
      .get("/api/v1/keys/status")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("owner", "test-runner");
    expect(res.body).toHaveProperty("tier", "free");
    expect(res.body).toHaveProperty("dailyLimit");
  });
});

// ---------- Food Search ----------

describe("Food Search", () => {
  it("GET /api/v1/foods/search?q=chicken returns results", async () => {
    const res = await request(app)
      .get("/api/v1/foods/search?q=chicken")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body.foods.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("total");
  });

  it("GET /api/v1/foods/search without q returns 400", async () => {
    const res = await request(app)
      .get("/api/v1/foods/search")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("search results include cultureScore, nutriScore, nutriGrade", async () => {
    const res = await request(app)
      .get("/api/v1/foods/search?q=chicken+breast")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    const food = res.body.foods[0];
    expect(food).toHaveProperty("cultureScore");
    expect(food).toHaveProperty("nutriScore");
    expect(food).toHaveProperty("nutriGrade");
  });

  it("fuzzy search: 'chiken' returns results", async () => {
    const res = await request(app)
      .get("/api/v1/foods/search?q=chiken")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body.foods.length).toBeGreaterThan(0);
  });
});

// ---------- Food Detail ----------

describe("Food Detail", () => {
  it("GET /api/v1/foods/:id returns food with nutrition", async () => {
    const res = await request(app)
      .get("/api/v1/foods/usda-2038064")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("nutrition");
  });

  it("GET /api/v1/foods/nonexistent returns 404", async () => {
    const res = await request(app)
      .get("/api/v1/foods/nonexistent-id-12345")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(404);
  });
});

// ---------- Barcode ----------

describe("Barcode", () => {
  it("GET /api/v1/foods/barcode/:code with known barcode returns food", async () => {
    const res = await request(app)
      .get("/api/v1/foods/barcode/796853100065")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
  });
});

// ---------- Stats ----------

describe("Stats", () => {
  it("GET /api/v1/foods/stats returns total count and bySource", async () => {
    const res = await request(app)
      .get("/api/v1/foods/stats")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("bySource");
    expect(Array.isArray(res.body.bySource)).toBe(true);
  });
});

// ---------- Parse ----------

describe("Parse", () => {
  it("POST /api/v1/parse with mode=fast returns parsed items", async () => {
    const res = await request(app)
      .post("/api/v1/parse?mode=fast")
      .set("x-api-key", apiKey)
      .send({ input: "2 eggs and a banana" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("parser_used", "fallback");
  });
});

// ---------- Vendors ----------

describe("Vendors", () => {
  let vendorId: string;

  it("POST /api/v1/vendors/register creates vendor", async () => {
    const res = await request(app)
      .post("/api/v1/vendors/register")
      .set("x-api-key", apiKey)
      .send({ name: "Test Kitchen", type: "restaurant" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("apiKey");
    vendorId = res.body.id;
  });

  it("GET /api/v1/vendors lists vendors", async () => {
    const res = await request(app)
      .get("/api/v1/vendors")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("vendors");
    expect(Array.isArray(res.body.vendors)).toBe(true);
  });
});

// ---------- Meals ----------

describe("Meals", () => {
  it("GET /api/v1/meals/chains returns chain list", async () => {
    const res = await request(app)
      .get("/api/v1/meals/chains")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("chains");
    expect(res.body.chains.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/meals/build with Chipotle components returns nutrition totals", async () => {
    const res = await request(app)
      .post("/api/v1/meals/build")
      .set("x-api-key", apiKey)
      .send({
        chain: "Chipotle",
        components: [
          { name: "White Rice", portion: "standard" },
          { name: "Brown Rice", portion: "standard" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totals");
    expect(res.body.totals).toHaveProperty("calories");
    expect(res.body.totals.calories).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("nutriScore");
    expect(res.body).toHaveProperty("nutriGrade");
  });
});

// ---------- Preferences ----------

describe("Preferences", () => {
  it("PUT /api/v1/preferences saves preferences", async () => {
    const res = await request(app)
      .put("/api/v1/preferences")
      .set("x-api-key", apiKey)
      .send({
        avoid_ingredients: "seed oils,msg",
        dietary_goals: "high_protein",
        calorie_target: 2000,
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("preferences");
    expect(res.body.preferences.avoid_ingredients).toContain("seed oils");
  });

  it("GET /api/v1/preferences returns saved preferences", async () => {
    const res = await request(app)
      .get("/api/v1/preferences")
      .set("x-api-key", apiKey);
    expect(res.status).toBe(200);
    expect(res.body.preferences).not.toBeNull();
    expect(res.body.preferences.calorie_target).toBe(2000);
    expect(res.body.preferences.dietary_goals).toContain("high_protein");
  });
});
