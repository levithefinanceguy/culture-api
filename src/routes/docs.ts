import { Router } from "express";

export const docsRoutes = Router();

docsRoutes.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(HTML);
});

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Culture API — Documentation</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --surface2: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --green: #3fb950;
    --orange: #d29922;
    --red: #f85149;
    --purple: #bc8cff;
    --cyan: #39d353;
    --radius: 8px;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* Header */
  .header {
    border-bottom: 1px solid var(--border);
    padding: 24px 0;
    background: var(--surface);
  }
  .header-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
  }
  .header h1 span { color: var(--accent); }
  .header p {
    color: var(--text-muted);
    margin-top: 4px;
    font-size: 15px;
  }
  .badge-row {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .badge.green { color: var(--green); border-color: #238636; }
  .badge.orange { color: var(--orange); border-color: #9e6a03; }
  .badge.purple { color: var(--purple); border-color: #6e40c9; }

  /* Layout */
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  /* Nav */
  .nav {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 32px;
  }
  .nav button {
    background: var(--surface);
    color: var(--text-muted);
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nav button:hover { color: var(--text); border-color: var(--accent); }
  .nav button.active {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(88,166,255,0.1);
  }

  /* Auth banner */
  .auth-banner {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 20px;
    margin-bottom: 32px;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .auth-banner label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 600;
    white-space: nowrap;
  }
  .auth-banner input {
    flex: 1;
    min-width: 200px;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 6px;
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 13px;
  }
  .auth-banner input:focus { outline: none; border-color: var(--accent); }
  .auth-banner .hint {
    font-size: 12px;
    color: var(--text-muted);
    width: 100%;
  }

  /* Section */
  .section-title {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }
  .section { margin-bottom: 48px; }

  /* Endpoint card */
  .endpoint {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 16px;
    overflow: hidden;
  }
  .endpoint-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }
  .endpoint-header:hover { background: var(--surface2); }
  .method {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    font-family: "SF Mono", monospace;
    min-width: 52px;
    text-align: center;
    flex-shrink: 0;
  }
  .method.get { background: rgba(63,185,80,0.15); color: var(--green); }
  .method.post { background: rgba(88,166,255,0.15); color: var(--accent); }
  .method.put { background: rgba(210,153,34,0.15); color: var(--orange); }
  .method.delete { background: rgba(248,81,73,0.15); color: var(--red); }
  .endpoint-path {
    font-family: "SF Mono", monospace;
    font-size: 14px;
    color: var(--text);
  }
  .endpoint-desc {
    color: var(--text-muted);
    font-size: 13px;
    margin-left: auto;
    text-align: right;
  }
  .endpoint-chevron {
    color: var(--text-muted);
    font-size: 12px;
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .endpoint.open .endpoint-chevron { transform: rotate(90deg); }
  .endpoint-body {
    display: none;
    border-top: 1px solid var(--border);
    padding: 20px;
  }
  .endpoint.open .endpoint-body { display: block; }

  /* Detail tables */
  .detail-label {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 8px;
    margin-top: 16px;
  }
  .detail-label:first-child { margin-top: 0; }
  .param-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .param-table th {
    text-align: left;
    padding: 6px 12px;
    background: var(--surface2);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .param-table td {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    vertical-align: top;
  }
  .param-table td:first-child {
    font-family: "SF Mono", monospace;
    color: var(--accent);
    white-space: nowrap;
  }
  .param-table .required {
    color: var(--red);
    font-size: 11px;
    font-weight: 600;
  }
  .param-table .optional {
    color: var(--text-muted);
    font-size: 11px;
  }

  /* Code blocks */
  pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px 16px;
    overflow-x: auto;
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
    margin-top: 8px;
  }
  code {
    font-family: "SF Mono", "Fira Code", monospace;
    font-size: 13px;
  }
  .str { color: #a5d6ff; }
  .num { color: #79c0ff; }
  .key { color: var(--accent); }
  .null { color: var(--text-muted); }

  /* Try it */
  .try-it {
    margin-top: 20px;
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
  .try-it-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--green);
    margin-bottom: 12px;
  }
  .try-input-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }
  .try-input-group label {
    font-size: 12px;
    color: var(--text-muted);
    width: 100%;
  }
  .try-input {
    flex: 1;
    min-width: 120px;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 12px;
    border-radius: 6px;
    font-family: "SF Mono", monospace;
    font-size: 13px;
  }
  .try-input:focus { outline: none; border-color: var(--accent); }
  textarea.try-input {
    width: 100%;
    min-height: 80px;
    resize: vertical;
  }
  .try-btn {
    background: var(--green);
    color: #000;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }
  .try-btn:hover { opacity: 0.85; }
  .try-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .try-result {
    margin-top: 12px;
  }
  .try-result pre {
    max-height: 400px;
    overflow-y: auto;
  }
  .try-status {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .try-status.ok { color: var(--green); }
  .try-status.err { color: var(--red); }

  /* Rate limits */
  .rate-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    margin-top: 8px;
  }
  .rate-table th, .rate-table td {
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .rate-table th {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .endpoint-desc { display: none; }
    .auth-banner { flex-direction: column; }
    .auth-banner input { width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-inner">
    <h1><span>Culture API</span> Documentation</h1>
    <p>The #1 Food Nutrition API &mdash; powered by USDA-verified ingredient data</p>
    <div class="badge-row">
      <span class="badge green">v1.0.0</span>
      <span class="badge orange">REST + JSON</span>
      <span class="badge purple">API Key Auth</span>
    </div>
  </div>
</div>

<div class="container">

  <div class="nav" id="nav">
    <button class="active" data-section="all">All</button>
    <button data-section="public">Public</button>
    <button data-section="foods">Foods</button>
    <button data-section="servings">Servings</button>
    <button data-section="parse">Parse</button>
    <button data-section="scan">Scan</button>
    <button data-section="photo">Photo</button>
    <button data-section="recipe">Recipe</button>
    <button data-section="order">Order</button>
    <button data-section="customize">Customize</button>
    <button data-section="meals">Meals</button>
    <button data-section="swaps">Swaps</button>
    <button data-section="alternatives">Alternatives</button>
    <button data-section="health">Health Score</button>
    <button data-section="preferences">Preferences</button>
    <button data-section="vendors">Vendors</button>
    <button data-section="contributions">Contributions</button>
    <button data-section="admin">Admin</button>
    <button data-section="rate-limits">Rate Limits</button>
  </div>

  <div class="auth-banner">
    <label for="globalKey">API Key</label>
    <input type="text" id="globalKey" placeholder="Enter your API key for live requests..." />
    <span class="hint">This key is used for the "Try it" sections below. Get one via POST /api/v1/keys/register.</span>
  </div>

  <!-- ==================== PUBLIC ==================== -->
  <div class="section" data-group="public">
    <div class="section-title">Public Endpoints</div>

    <!-- GET / -->
    <div class="endpoint" data-group="public">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/</span>
        <span class="endpoint-desc">API info and available endpoints</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns basic information about the API, version, and a list of available endpoints.</p>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/')">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /health -->
    <div class="endpoint" data-group="public">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/health</span>
        <span class="endpoint-desc">Health check</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns API health status, uptime, food count, and version.</p>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"status"</span>: <span class="str">"ok"</span>,
  <span class="key">"uptime"</span>: <span class="num">12345.67</span>,
  <span class="key">"foodCount"</span>: <span class="num">8463</span>,
  <span class="key">"version"</span>: <span class="str">"1.0.0"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/health')">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /docs -->
    <div class="endpoint" data-group="public">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/docs</span>
        <span class="endpoint-desc">API documentation (this page)</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns this interactive API documentation page.</p>
      </div>
    </div>

    <!-- POST /api/v1/keys/register -->
    <div class="endpoint" data-group="public">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/keys/register</span>
        <span class="endpoint-desc">Register for an API key</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Creates a new API key for the given name. Store this key securely; it will not be shown again.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Your name or app name</td></tr>
          <tr><td>email</td><td>string</td><td><span class="optional">optional</span></td><td>Contact email</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"apiKey"</span>: <span class="str">"cult_a1b2c3d4e5f6..."</span>,
  <span class="key">"owner"</span>: <span class="str">"My App"</span>,
  <span class="key">"tier"</span>: <span class="str">"free"</span>,
  <span class="key">"rateLimit"</span>: <span class="str">"100 requests/day"</span>,
  <span class="key">"message"</span>: <span class="str">"Store this key securely. It won't be shown again."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "name": "My App" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/keys/register')">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/keys/status -->
    <div class="endpoint" data-group="public">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/keys/status</span>
        <span class="endpoint-desc">Check API key status and usage</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns the current status of your API key including tier, daily usage, and rate limits.</p>

        <div class="detail-label">Headers</div>
        <table class="param-table">
          <tr><th>Header</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>x-api-key</td><td>string</td><td><span class="required">required</span></td><td>Your API key</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"owner"</span>: <span class="str">"My App"</span>,
  <span class="key">"tier"</span>: <span class="str">"free"</span>,
  <span class="key">"requestsToday"</span>: <span class="num">42</span>,
  <span class="key">"dailyLimit"</span>: <span class="num">100</span>,
  <span class="key">"createdAt"</span>: <span class="str">"2026-03-20T12:00:00Z"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/keys/status', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== FOODS ==================== -->
  <div class="section" data-group="foods">
    <div class="section-title">Food Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/foods/search -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/search</span>
        <span class="endpoint-desc">Full-text search for foods</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Searches the food database using FTS5 full-text search with fuzzy matching fallback and Open Food Facts as a final fallback. Returns paginated results ranked by relevance.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>q</td><td>string</td><td><span class="required">required</span></td><td>Search query (e.g. "chicken breast")</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
          <tr><td>source</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by source (e.g. "usda", "vendor", "community")</td></tr>
          <tr><td>grade</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated Nutri-Score grades (e.g. "A,B")</td></tr>
          <tr><td>min_score</td><td>integer</td><td><span class="optional">optional</span></td><td>Minimum Culture Score (0-100)</td></tr>
          <tr><td>allergen_free</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated allergens to exclude (e.g. "gluten,dairy")</td></tr>
          <tr><td>dietary</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated dietary tags to require (e.g. "vegan,high-protein")</td></tr>
          <tr><td>gi</td><td>string</td><td><span class="optional">optional</span></td><td>Glycemic index level filter (low, medium, high)</td></tr>
          <tr><td>fuzzy</td><td>string</td><td><span class="optional">optional</span></td><td>Set to "false" to disable fuzzy matching</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"foods"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"usda-171077"</span>,
      <span class="key">"name"</span>: <span class="str">"Chicken, breast, roasted"</span>,
      <span class="key">"brand"</span>: <span class="null">null</span>,
      <span class="key">"category"</span>: <span class="str">"Poultry Products"</span>,
      <span class="key">"servingSize"</span>: <span class="num">100</span>,
      <span class="key">"servingUnit"</span>: <span class="str">"g"</span>,
      <span class="key">"nutriScore"</span>: <span class="num">-2</span>,
      <span class="key">"nutriGrade"</span>: <span class="str">"A"</span>,
      <span class="key">"nutrition"</span>: {
        <span class="key">"calories"</span>: <span class="num">165</span>,
        <span class="key">"protein"</span>: <span class="num">31</span>,
        <span class="key">"totalFat"</span>: <span class="num">3.6</span>,
        <span class="key">"totalCarbohydrates"</span>: <span class="num">0</span>
      }
    }
  ],
  <span class="key">"total"</span>: <span class="num">143</span>,
  <span class="key">"limit"</span>: <span class="num">25</span>,
  <span class="key">"offset"</span>: <span class="num">0</span>,
  <span class="key">"did_you_mean"</span>: <span class="null">null</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Search query</label>
            <input class="try-input" data-param="q" placeholder="chicken breast" value="chicken" />
            <input class="try-input" data-param="limit" placeholder="limit (25)" style="max-width:100px" />
            <input class="try-input" data-param="source" placeholder="source" style="max-width:120px" />
            <input class="try-input" data-param="allergen_free" placeholder="allergen_free" style="max-width:140px" />
            <input class="try-input" data-param="dietary" placeholder="dietary" style="max-width:140px" />
            <input class="try-input" data-param="grade" placeholder="grade (A,B)" style="max-width:120px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/search', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/foods/barcode/:code -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/barcode/:code</span>
        <span class="endpoint-desc">Barcode lookup (with Open Food Facts fallback)</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Look up a food by its barcode (UPC/EAN). Searches Culture DB first, then falls back to Open Food Facts. Valid OFF results are auto-imported into Culture.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>code</td><td>string</td><td><span class="required">required</span></td><td>Barcode (UPC/EAN)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"off-0049000006346"</span>,
  <span class="key">"name"</span>: <span class="str">"Coca-Cola Classic"</span>,
  <span class="key">"brand"</span>: <span class="str">"Coca-Cola"</span>,
  <span class="key">"barcode"</span>: <span class="str">"0049000006346"</span>,
  <span class="key">"nutrition"</span>: {
    <span class="key">"calories"</span>: <span class="num">140</span>,
    <span class="key">"totalSugars"</span>: <span class="num">39</span>,
    <span class="key">"sodium"</span>: <span class="num">45</span>
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Barcode</label>
            <input class="try-input" data-path="code" placeholder="0049000006346" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/barcode/:code', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/foods/stats -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/stats</span>
        <span class="endpoint-desc">Database statistics</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns statistics about the food database including total count, breakdown by source, and top categories.</p>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"total"</span>: <span class="num">8463</span>,
  <span class="key">"bySource"</span>: [
    { <span class="key">"source"</span>: <span class="str">"usda"</span>, <span class="key">"count"</span>: <span class="num">8200</span> },
    { <span class="key">"source"</span>: <span class="str">"vendor"</span>, <span class="key">"count"</span>: <span class="num">263</span> }
  ],
  <span class="key">"topCategories"</span>: [
    { <span class="key">"category"</span>: <span class="str">"Baked Products"</span>, <span class="key">"count"</span>: <span class="num">860</span> }
  ]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/stats', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/foods/top -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/top</span>
        <span class="endpoint-desc">Top-scored foods by nutrition</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns foods with the best Nutri-Score grades, sorted by score ascending (best first) then by calories ascending. Optionally filter by category.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
          <tr><td>category</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by category (partial match)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"foods"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"usda-168875"</span>,
      <span class="key">"name"</span>: <span class="str">"Spinach, raw"</span>,
      <span class="key">"nutriScore"</span>: <span class="num">-8</span>,
      <span class="key">"nutriGrade"</span>: <span class="str">"A"</span>,
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">23</span>, <span class="key">"protein"</span>: <span class="num">2.9</span> }
    }
  ],
  <span class="key">"total"</span>: <span class="num">500</span>,
  <span class="key">"limit"</span>: <span class="num">25</span>,
  <span class="key">"offset"</span>: <span class="num">0</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Filters</label>
            <input class="try-input" data-param="limit" placeholder="limit (25)" style="max-width:100px" />
            <input class="try-input" data-param="category" placeholder="category" style="max-width:180px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/top', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/foods/:id -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/:id</span>
        <span class="endpoint-desc">Get food by ID</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns detailed nutrition information for a single food item. If the food is a recipe, the response includes the recipe ingredients breakdown.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID (e.g. "usda-171077")</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"usda-171077"</span>,
  <span class="key">"name"</span>: <span class="str">"Chicken, breast, roasted"</span>,
  <span class="key">"brand"</span>: <span class="null">null</span>,
  <span class="key">"category"</span>: <span class="str">"Poultry Products"</span>,
  <span class="key">"servingSize"</span>: <span class="num">100</span>,
  <span class="key">"servingUnit"</span>: <span class="str">"g"</span>,
  <span class="key">"source"</span>: <span class="str">"usda"</span>,
  <span class="key">"nutriScore"</span>: <span class="num">-2</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"A"</span>,
  <span class="key">"nutrition"</span>: {
    <span class="key">"calories"</span>: <span class="num">165</span>,
    <span class="key">"totalFat"</span>: <span class="num">3.6</span>,
    <span class="key">"saturatedFat"</span>: <span class="num">1</span>,
    <span class="key">"transFat"</span>: <span class="num">0</span>,
    <span class="key">"cholesterol"</span>: <span class="num">85</span>,
    <span class="key">"sodium"</span>: <span class="num">74</span>,
    <span class="key">"totalCarbohydrates"</span>: <span class="num">0</span>,
    <span class="key">"dietaryFiber"</span>: <span class="num">0</span>,
    <span class="key">"totalSugars"</span>: <span class="num">0</span>,
    <span class="key">"protein"</span>: <span class="num">31</span>
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Food ID</label>
            <input class="try-input" data-path="id" placeholder="usda-171077" value="usda-171077" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/:id', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/foods/import -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/foods/import</span>
        <span class="endpoint-desc">Import food from Open Food Facts</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Imports a provisional Open Food Facts result into Culture's database. Provide either a barcode to look up, or a full OFF food object to import directly.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>barcode</td><td>string</td><td><span class="optional">one of</span></td><td>Barcode to look up and import from OFF</td></tr>
          <tr><td>food</td><td>object</td><td><span class="optional">one of</span></td><td>Full OFF food object to import directly</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"message"</span>: <span class="str">"Food imported from Open Food Facts and saved to Culture"</span>,
  <span class="key">"food"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"..."</span> },
  <span class="key">"attribution"</span>: <span class="str">"Data from Open Food Facts (openfoodfacts.org), licensed under ODbL"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "barcode": "0049000006346" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/foods/import', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== SERVINGS ==================== -->
  <div class="section" data-group="servings">
    <div class="section-title">Serving Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/foods/:id/servings -->
    <div class="endpoint" data-group="servings">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/:id/servings</span>
        <span class="endpoint-desc">Calculate nutrition for a custom serving</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Calculates scaled nutrition for a custom serving size. Supports servings count, slice count, or weight amount with unit conversion (g, oz, ml, kg, lb).</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID</td></tr>
        </table>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>servings</td><td>number</td><td><span class="optional">one of</span></td><td>Number of servings (e.g. 2.5)</td></tr>
          <tr><td>slices</td><td>number</td><td><span class="optional">one of</span></td><td>Number of slices (for pizza-type items)</td></tr>
          <tr><td>amount</td><td>number</td><td><span class="optional">one of</span></td><td>Weight amount</td></tr>
          <tr><td>unit</td><td>string</td><td><span class="optional">optional</span></td><td>Unit for amount: g, oz, ml, kg, lb (default: g)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"usda-171077"</span>,
  <span class="key">"name"</span>: <span class="str">"Chicken, breast, roasted"</span>,
  <span class="key">"requestedServing"</span>: <span class="str">"2 servings"</span>,
  <span class="key">"scaleFactor"</span>: <span class="num">2</span>,
  <span class="key">"baseServing"</span>: { <span class="key">"size"</span>: <span class="num">100</span>, <span class="key">"unit"</span>: <span class="str">"g"</span> },
  <span class="key">"nutrition"</span>: {
    <span class="key">"calories"</span>: <span class="num">330</span>,
    <span class="key">"protein"</span>: <span class="num">62</span>,
    <span class="key">"totalFat"</span>: <span class="num">7.2</span>
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Food ID and serving</label>
            <input class="try-input" data-path="id" placeholder="usda-171077" value="usda-171077" />
            <input class="try-input" data-param="servings" placeholder="servings" style="max-width:100px" value="2" />
            <input class="try-input" data-param="amount" placeholder="amount" style="max-width:100px" />
            <input class="try-input" data-param="unit" placeholder="unit (g)" style="max-width:80px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/:id/servings', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/foods/sizes -->
    <div class="endpoint" data-group="servings">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/sizes</span>
        <span class="endpoint-desc">Get all size variants for a food</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all size variants for a food (e.g. Small, Medium, Large pizza) with per-slice and whole nutrition for each size.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>q</td><td>string</td><td><span class="required">required</span></td><td>Food name to search (e.g. "pepperoni pizza")</td></tr>
          <tr><td>brand</td><td>string</td><td><span class="optional">optional</span></td><td>Brand filter (e.g. "Papa Johns")</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"item"</span>: <span class="str">"Pepperoni Pizza"</span>,
  <span class="key">"brand"</span>: <span class="str">"Papa Johns"</span>,
  <span class="key">"sizes"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"..."</span>,
      <span class="key">"size"</span>: <span class="str">"Large"</span>,
      <span class="key">"slices"</span>: <span class="num">8</span>,
      <span class="key">"per_slice"</span>: { <span class="key">"calories"</span>: <span class="num">300</span> },
      <span class="key">"whole"</span>: { <span class="key">"calories"</span>: <span class="num">2400</span> }
    }
  ]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Search</label>
            <input class="try-input" data-param="q" placeholder="pepperoni pizza" />
            <input class="try-input" data-param="brand" placeholder="brand (optional)" style="max-width:180px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/sizes', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PARSE ==================== -->
  <div class="section" data-group="parse">
    <div class="section-title">Natural Language Parse <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/parse -->
    <div class="endpoint" data-group="parse">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/parse</span>
        <span class="endpoint-desc">Parse natural language food descriptions</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Parses a natural language food description into individual items with matched nutrition data. Uses Gemini AI for intelligent parsing with a string-matching fallback. Supports compound descriptions, mixed fractions, and number words.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>mode</td><td>string</td><td><span class="optional">optional</span></td><td>Set to "fast" to skip AI and use string matching only</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>input</td><td>string</td><td><span class="required">required</span></td><td>Natural language food description (max 2000 chars)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"input"</span>: <span class="str">"2 eggs and a slice of toast"</span>,
  <span class="key">"items"</span>: [
    {
      <span class="key">"original"</span>: <span class="str">"2 eggs"</span>,
      <span class="key">"quantity"</span>: <span class="num">100</span>,
      <span class="key">"unit"</span>: <span class="str">"g"</span>,
      <span class="key">"food_query"</span>: <span class="str">"eggs"</span>,
      <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"usda-..."</span>, <span class="key">"name"</span>: <span class="str">"Egg, whole, raw"</span> },
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">143</span>, <span class="key">"protein"</span>: <span class="num">12.6</span> },
      <span class="key">"confidence"</span>: <span class="num">0.9</span>
    }
  ],
  <span class="key">"totals"</span>: { <span class="key">"calories"</span>: <span class="num">220</span>, <span class="key">"protein"</span>: <span class="num">15</span> },
  <span class="key">"matched"</span>: <span class="num">2</span>,
  <span class="key">"total_items"</span>: <span class="num">2</span>,
  <span class="key">"parser_used"</span>: <span class="str">"gemini"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "input": "2 eggs and a slice of toast" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/parse', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== SCAN ==================== -->
  <div class="section" data-group="scan">
    <div class="section-title">Label Scan <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/scan/label -->
    <div class="endpoint" data-group="scan">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/scan/label</span>
        <span class="endpoint-desc">Scan a nutrition label, barcode, or menu</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Accepts a base64-encoded image and uses Gemini AI to extract nutrition data. Supports nutrition labels, barcodes, and restaurant menus.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>image</td><td>string</td><td><span class="required">required</span></td><td>Base64-encoded image (with or without data URI prefix)</td></tr>
          <tr><td>format</td><td>string</td><td><span class="optional">optional</span></td><td>One of: nutrition_label (default), barcode, menu</td></tr>
        </table>

        <div class="detail-label">Example Response (nutrition_label)</div>
        <pre>{
  <span class="key">"format"</span>: <span class="str">"nutrition_label"</span>,
  <span class="key">"nutrition"</span>: {
    <span class="key">"name"</span>: <span class="str">"Protein Bar"</span>,
    <span class="key">"calories"</span>: <span class="num">210</span>,
    <span class="key">"protein"</span>: <span class="num">20</span>,
    <span class="key">"total_fat"</span>: <span class="num">7</span>
  },
  <span class="key">"allergens"</span>: [<span class="str">"milk"</span>, <span class="str">"soy"</span>],
  <span class="key">"dietary_tags"</span>: [<span class="str">"high-protein"</span>],
  <span class="key">"nutri_score"</span>: { <span class="key">"score"</span>: <span class="num">2</span>, <span class="key">"grade"</span>: <span class="str">"B"</span> }
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/scan/submit -->
    <div class="endpoint" data-group="scan">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/scan/submit</span>
        <span class="endpoint-desc">Save scanned nutrition data as a food entry</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Takes extracted nutrition data (from /scan/label) and saves it as a community food entry in the database. Auto-detects allergens, dietary tags, and calculates nutri-score.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Food name</td></tr>
          <tr><td>brand</td><td>string</td><td><span class="optional">optional</span></td><td>Brand name</td></tr>
          <tr><td>barcode</td><td>string</td><td><span class="optional">optional</span></td><td>Barcode (must be unique)</td></tr>
          <tr><td>nutrition</td><td>object</td><td><span class="required">required</span></td><td>Nutrition object with calories (required), plus total_fat, protein, etc.</td></tr>
          <tr><td>ingredients_text</td><td>string</td><td><span class="optional">optional</span></td><td>Ingredients list for allergen/tag detection</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"a1b2c3..."</span>,
  <span class="key">"name"</span>: <span class="str">"Protein Bar"</span>,
  <span class="key">"source"</span>: <span class="str">"community"</span>,
  <span class="key">"calories"</span>: <span class="num">210</span>,
  <span class="key">"allergens"</span>: [<span class="str">"milk"</span>],
  <span class="key">"nutri_score"</span>: { <span class="key">"score"</span>: <span class="num">2</span>, <span class="key">"grade"</span>: <span class="str">"B"</span> }
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== PHOTO ==================== -->
  <div class="section" data-group="photo">
    <div class="section-title">Photo Recognition <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/photo/analyze -->
    <div class="endpoint" data-group="photo">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/photo/analyze</span>
        <span class="endpoint-desc">Analyze a food photo for nutrition</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Uses Gemini AI to identify all food items in a photo, estimate portions, and return matched nutrition data with confidence scores. Returns an analysis_id for feedback.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>image</td><td>string</td><td><span class="required">required</span></td><td>Base64-encoded food photo</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"analysis_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"items"</span>: [
    {
      <span class="key">"name"</span>: <span class="str">"grilled chicken breast"</span>,
      <span class="key">"portion_grams"</span>: <span class="num">170</span>,
      <span class="key">"confidence"</span>: <span class="num">0.85</span>,
      <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"usda-..."</span>, <span class="key">"name"</span>: <span class="str">"Chicken breast"</span> },
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">281</span>, <span class="key">"protein"</span>: <span class="num">53</span> }
    }
  ],
  <span class="key">"total"</span>: { <span class="key">"calories"</span>: <span class="num">450</span>, <span class="key">"protein"</span>: <span class="num">60</span> },
  <span class="key">"overall_culture_score"</span>: <span class="num">78</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/photo/log -->
    <div class="endpoint" data-group="photo">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/photo/log</span>
        <span class="endpoint-desc">Analyze and log a food photo</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Combines photo analysis with automatic food logging. Identifies food items, calculates nutrition, and saves matched items as meal entries.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>image</td><td>string</td><td><span class="required">required</span></td><td>Base64-encoded food photo</td></tr>
          <tr><td>meal_type</td><td>string</td><td><span class="optional">optional</span></td><td>One of: breakfast, lunch, dinner, snack</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"analysis_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"items"</span>: [<span class="str">...</span>],
  <span class="key">"total"</span>: { <span class="key">"calories"</span>: <span class="num">450</span> },
  <span class="key">"meal_type"</span>: <span class="str">"lunch"</span>,
  <span class="key">"logged"</span>: <span class="num">true</span>,
  <span class="key">"saved_entries"</span>: <span class="num">3</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/photo/quick -->
    <div class="endpoint" data-group="photo">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/photo/quick</span>
        <span class="endpoint-desc">Quick photo analysis (calories + macros only)</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Streamlined photo analysis that returns only calories, macros, item names, and Culture Score. Ideal for quick logging UIs.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>image</td><td>string</td><td><span class="required">required</span></td><td>Base64-encoded food photo</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"calories"</span>: <span class="num">450</span>,
  <span class="key">"protein"</span>: <span class="num">35</span>,
  <span class="key">"carbs"</span>: <span class="num">40</span>,
  <span class="key">"fat"</span>: <span class="num">18</span>,
  <span class="key">"items"</span>: [<span class="str">"grilled chicken breast (170g)"</span>, <span class="str">"brown rice (150g)"</span>],
  <span class="key">"culture_score"</span>: <span class="num">78</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/photo/feedback -->
    <div class="endpoint" data-group="photo">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/photo/feedback</span>
        <span class="endpoint-desc">Submit corrections for photo analysis</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Submit corrections for a previous photo analysis to improve future accuracy. Reference items by their index in the analysis result.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>analysis_id</td><td>string</td><td><span class="required">required</span></td><td>The analysis_id from a previous /photo/analyze or /photo/log response</td></tr>
          <tr><td>corrections</td><td>array</td><td><span class="required">required</span></td><td>Array of correction objects</td></tr>
          <tr><td>corrections[].item_index</td><td>integer</td><td><span class="required">required</span></td><td>Index of the item to correct</td></tr>
          <tr><td>corrections[].correct_name</td><td>string</td><td><span class="optional">optional</span></td><td>Corrected food name</td></tr>
          <tr><td>corrections[].correct_grams</td><td>number</td><td><span class="optional">optional</span></td><td>Corrected portion in grams</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"message"</span>: <span class="str">"Feedback recorded. Thank you for helping improve photo analysis accuracy."</span>,
  <span class="key">"analysis_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"corrections_saved"</span>: <span class="num">1</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== RECIPE ==================== -->
  <div class="section" data-group="recipe">
    <div class="section-title">Recipe Parsing <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/recipe/parse -->
    <div class="endpoint" data-group="recipe">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/recipe/parse</span>
        <span class="endpoint-desc">Parse recipe from URL</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Fetches a recipe URL (supports blogs, TikTok, Instagram, YouTube), extracts ingredients via Gemini AI, matches them to the food database, and calculates per-serving and total nutrition with Culture Score.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>url</td><td>string</td><td><span class="required">required</span></td><td>Recipe URL (any food blog, social media, etc.)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"title"</span>: <span class="str">"Chicken Stir Fry"</span>,
  <span class="key">"source_url"</span>: <span class="str">"https://example.com/recipe/..."</span>,
  <span class="key">"servings"</span>: <span class="num">4</span>,
  <span class="key">"ingredients"</span>: [
    {
      <span class="key">"original"</span>: <span class="str">"2 chicken breast"</span>,
      <span class="key">"matched"</span>: { <span class="key">"id"</span>: <span class="str">"usda-..."</span>, <span class="key">"name"</span>: <span class="str">"Chicken breast"</span> },
      <span class="key">"grams"</span>: <span class="num">348</span>,
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">575</span> }
    }
  ],
  <span class="key">"per_serving"</span>: { <span class="key">"calories"</span>: <span class="num">320</span>, <span class="key">"protein"</span>: <span class="num">35</span> },
  <span class="key">"total_nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">1280</span> },
  <span class="key">"culture_score"</span>: <span class="num">72</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "url": "https://allrecipes.com/recipe/228285/" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/recipe/parse', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/recipe/text -->
    <div class="endpoint" data-group="recipe">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/recipe/text</span>
        <span class="endpoint-desc">Parse recipe from plain text</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Parses a recipe from plain text input. Extracts ingredients, matches them to the database, and returns per-serving and total nutrition.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>text</td><td>string</td><td><span class="required">required</span></td><td>Recipe text (max 10000 chars)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"title"</span>: <span class="str">"Chicken and Rice"</span>,
  <span class="key">"servings"</span>: <span class="num">4</span>,
  <span class="key">"ingredients"</span>: [<span class="str">...</span>],
  <span class="key">"per_serving"</span>: { <span class="key">"calories"</span>: <span class="num">350</span> },
  <span class="key">"total_nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">1400</span> },
  <span class="key">"culture_score"</span>: <span class="num">68</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "text": "2 chicken breasts\\n1 cup rice\\n2 tbsp soy sauce\\nServes 4" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/recipe/text', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/recipe/save -->
    <div class="endpoint" data-group="recipe">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/recipe/save</span>
        <span class="endpoint-desc">Save a parsed recipe as a food</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Saves a parsed recipe (from /recipe/parse or /recipe/text) as a new food entry in the database. Stores per-serving nutrition, ingredient linkages, and calculates nutri-score.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>title</td><td>string</td><td><span class="optional">optional</span></td><td>Recipe title (or use "name")</td></tr>
          <tr><td>name</td><td>string</td><td><span class="optional">optional</span></td><td>Overrides title for the saved food name</td></tr>
          <tr><td>servings</td><td>number</td><td><span class="optional">optional</span></td><td>Number of servings (default 1)</td></tr>
          <tr><td>ingredients</td><td>array</td><td><span class="required">required</span></td><td>Ingredients array from the parse response</td></tr>
          <tr><td>per_serving</td><td>object</td><td><span class="required">required</span></td><td>Per-serving nutrition from the parse response</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"name"</span>: <span class="str">"Chicken Stir Fry"</span>,
  <span class="key">"servings"</span>: <span class="num">4</span>,
  <span class="key">"serving_size"</span>: <span class="num">250</span>,
  <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">320</span>, <span class="key">"protein"</span>: <span class="num">35</span> },
  <span class="key">"nutri_score"</span>: <span class="num">1</span>,
  <span class="key">"nutri_grade"</span>: <span class="str">"B"</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== ORDER ==================== -->
  <div class="section" data-group="order">
    <div class="section-title">Order Scanning <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/order/scan -->
    <div class="endpoint" data-group="order">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/order/scan</span>
        <span class="endpoint-desc">Scan a food delivery order screenshot</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Analyzes a food delivery or restaurant order screenshot (DoorDash, Uber Eats, etc.), extracts items with quantities/sizes/prices, matches them to the food database, and returns nutrition totals. Customizations (e.g. "no pickles", "extra cheese") are auto-applied.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>image</td><td>string</td><td><span class="required">required</span></td><td>Base64-encoded screenshot of the order</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"order_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"restaurant"</span>: <span class="str">"McDonald's"</span>,
  <span class="key">"platform"</span>: <span class="str">"DoorDash"</span>,
  <span class="key">"items"</span>: [
    {
      <span class="key">"original_name"</span>: <span class="str">"Big Mac"</span>,
      <span class="key">"quantity"</span>: <span class="num">1</span>,
      <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"Big Mac"</span> },
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">550</span> }
    }
  ],
  <span class="key">"total_nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">1200</span> },
  <span class="key">"total_price"</span>: <span class="num">15.47</span>,
  <span class="key">"item_count"</span>: <span class="num">3</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/order/calculate -->
    <div class="endpoint" data-group="order">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/order/calculate</span>
        <span class="endpoint-desc">Recalculate nutrition for selected items</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Recalculates nutrition totals for a previously scanned order, allowing item selection, quantity changes, and split calculations (for sharing meals). Order scans expire after 24 hours.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>order_id</td><td>string</td><td><span class="required">required</span></td><td>Order ID from /order/scan response</td></tr>
          <tr><td>items</td><td>array</td><td><span class="required">required</span></td><td>Array of selection objects</td></tr>
          <tr><td>items[].index</td><td>integer</td><td><span class="required">required</span></td><td>Item index from the scan</td></tr>
          <tr><td>items[].selected</td><td>boolean</td><td><span class="optional">optional</span></td><td>Include this item (default true)</td></tr>
          <tr><td>items[].quantity</td><td>integer</td><td><span class="optional">optional</span></td><td>Override quantity</td></tr>
          <tr><td>items[].split</td><td>integer</td><td><span class="optional">optional</span></td><td>Split between N people (divides nutrition)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"order_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"restaurant"</span>: <span class="str">"McDonald's"</span>,
  <span class="key">"items"</span>: [<span class="str">...</span>],
  <span class="key">"total_nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">550</span> },
  <span class="key">"total_price"</span>: <span class="num">5.99</span>,
  <span class="key">"item_count"</span>: <span class="num">1</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/order/log -->
    <div class="endpoint" data-group="order">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/order/log</span>
        <span class="endpoint-desc">Log selected order items as meal entries</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Saves selected items from a scanned order as meal entries. Supports item selection, quantity overrides, split calculations, and meal type tagging.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>order_id</td><td>string</td><td><span class="required">required</span></td><td>Order ID from /order/scan response</td></tr>
          <tr><td>items</td><td>array</td><td><span class="required">required</span></td><td>Selection objects (same format as /calculate)</td></tr>
          <tr><td>meal_type</td><td>string</td><td><span class="optional">optional</span></td><td>One of: breakfast, lunch, dinner, snack</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"order_id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"restaurant"</span>: <span class="str">"McDonald's"</span>,
  <span class="key">"meal_type"</span>: <span class="str">"lunch"</span>,
  <span class="key">"logged"</span>: <span class="num">true</span>,
  <span class="key">"saved_entries"</span>: <span class="num">2</span>,
  <span class="key">"entry_ids"</span>: [<span class="str">"..."</span>, <span class="str">"..."</span>]
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== CUSTOMIZE ==================== -->
  <div class="section" data-group="customize">
    <div class="section-title">Menu Customization <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/foods/:id/customize -->
    <div class="endpoint" data-group="customize">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/foods/:id/customize</span>
        <span class="endpoint-desc">Preview customized nutrition</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Customizes a food item by adding, removing, or swapping ingredients and returns the adjusted nutrition. Supports portion sizes (light, standard, extra, double). Resolves ingredients from chain meal components, a built-in reference table, or the foods database.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID to customize</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>add</td><td>array</td><td><span class="optional">optional</span></td><td>Items to add: [{ name: "guacamole", portion: "standard" }]</td></tr>
          <tr><td>remove</td><td>array</td><td><span class="optional">optional</span></td><td>Items to remove: ["cheese", "sour cream"]</td></tr>
          <tr><td>swap</td><td>array</td><td><span class="optional">optional</span></td><td>Ingredient swaps: [{ from: "beef", to: "chicken" }]</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"original"</span>: {
    <span class="key">"name"</span>: <span class="str">"Burrito Bowl"</span>,
    <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">650</span> },
    <span class="key">"cultureScore"</span>: <span class="num">62</span>
  },
  <span class="key">"customized"</span>: {
    <span class="key">"name"</span>: <span class="str">"Burrito Bowl + guacamole - sour cream"</span>,
    <span class="key">"modifications"</span>: [
      { <span class="key">"action"</span>: <span class="str">"add"</span>, <span class="key">"item"</span>: <span class="str">"guacamole"</span>, <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">50</span> } },
      { <span class="key">"action"</span>: <span class="str">"remove"</span>, <span class="key">"item"</span>: <span class="str">"sour cream"</span>, <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">-60</span> } }
    ],
    <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">640</span> },
    <span class="key">"cultureScore"</span>: <span class="num">63</span>
  },
  <span class="key">"difference"</span>: { <span class="key">"calories"</span>: <span class="str">"-10"</span> }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Food ID</label>
            <input class="try-input" data-path="id" placeholder="food-id" />
          </div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "add": [{ "name": "guacamole", "portion": "standard" }], "remove": ["sour cream"] }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/foods/:id/customize', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/foods/:id/customize/save -->
    <div class="endpoint" data-group="customize">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/foods/:id/customize/save</span>
        <span class="endpoint-desc">Save customized food to database</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Applies customizations and saves the result as a new community food entry in the database. Returns the new food ID along with original vs customized nutrition comparison.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Base food ID to customize</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>add</td><td>array</td><td><span class="optional">optional</span></td><td>Items to add (same format as /customize)</td></tr>
          <tr><td>remove</td><td>array</td><td><span class="optional">optional</span></td><td>Items to remove</td></tr>
          <tr><td>swap</td><td>array</td><td><span class="optional">optional</span></td><td>Ingredient swaps</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"new-food-uuid"</span>,
  <span class="key">"original"</span>: { <span class="key">"name"</span>: <span class="str">"Burrito Bowl"</span> },
  <span class="key">"customized"</span>: {
    <span class="key">"name"</span>: <span class="str">"Burrito Bowl + guacamole"</span>,
    <span class="key">"nutriScore"</span>: <span class="num">3</span>,
    <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>
  },
  <span class="key">"message"</span>: <span class="str">"Customized food saved to database"</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== MEALS ==================== -->
  <div class="section" data-group="meals">
    <div class="section-title">Meal Builder <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/meals/chains -->
    <div class="endpoint" data-group="meals">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/meals/chains</span>
        <span class="endpoint-desc">List restaurant chains</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all restaurant chains that have component data for custom meal building.</p>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"chains"</span>: [
    { <span class="key">"name"</span>: <span class="str">"Chipotle"</span>, <span class="key">"componentCount"</span>: <span class="num">45</span>, <span class="key">"categoryCount"</span>: <span class="num">8</span> },
    { <span class="key">"name"</span>: <span class="str">"Subway"</span>, <span class="key">"componentCount"</span>: <span class="num">38</span>, <span class="key">"categoryCount"</span>: <span class="num">6</span> }
  ]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/meals/chains', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/meals/components -->
    <div class="endpoint" data-group="meals">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/meals/components</span>
        <span class="endpoint-desc">Get components for a chain</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all available components for a restaurant chain, grouped by category (e.g. "Protein", "Rice", "Toppings"). Each component includes portion variants with full nutrition, allergens, and dietary tags.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>chain</td><td>string</td><td><span class="required">required</span></td><td>Chain name (e.g. "Chipotle")</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"chain"</span>: <span class="str">"Chipotle"</span>,
  <span class="key">"categories"</span>: {
    <span class="key">"Protein"</span>: [
      {
        <span class="key">"name"</span>: <span class="str">"Chicken"</span>,
        <span class="key">"portions"</span>: {
          <span class="key">"standard"</span>: { <span class="key">"portionGrams"</span>: <span class="num">113</span>, <span class="key">"calories"</span>: <span class="num">180</span>, <span class="key">"protein"</span>: <span class="num">32</span> }
        }
      }
    ]
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Chain name</label>
            <input class="try-input" data-param="chain" placeholder="Chipotle" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/meals/components', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/meals/build -->
    <div class="endpoint" data-group="meals">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/meals/build</span>
        <span class="endpoint-desc">Build a custom meal and get nutrition</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Builds a custom meal from chain components and calculates combined nutrition totals, nutri-score, and allergens. Preview only - does not save.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>chain</td><td>string</td><td><span class="required">required</span></td><td>Chain name</td></tr>
          <tr><td>name</td><td>string</td><td><span class="optional">optional</span></td><td>Custom meal name</td></tr>
          <tr><td>components</td><td>array</td><td><span class="required">required</span></td><td>Array of { name, portion } objects</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"meal"</span>: { <span class="key">"name"</span>: <span class="str">"My Chipotle Bowl"</span>, <span class="key">"chain"</span>: <span class="str">"Chipotle"</span> },
  <span class="key">"totals"</span>: { <span class="key">"calories"</span>: <span class="num">685</span>, <span class="key">"protein"</span>: <span class="num">45</span> },
  <span class="key">"nutriScore"</span>: <span class="num">3</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>,
  <span class="key">"allergens"</span>: [<span class="str">"milk"</span>],
  <span class="key">"breakdown"</span>: [<span class="str">...</span>]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "chain": "Chipotle", "name": "My Bowl", "components": [{ "name": "Chicken", "portion": "standard" }, { "name": "White Rice", "portion": "standard" }] }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/meals/build', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/meals/save -->
    <div class="endpoint" data-group="meals">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/meals/save</span>
        <span class="endpoint-desc">Save a custom meal to the database</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Builds a custom meal from chain components and saves it as a new food entry in the database. Returns the new food ID with full nutrition, nutri-score, allergens, and dietary tags.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>chain</td><td>string</td><td><span class="required">required</span></td><td>Chain name</td></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Meal name (required when saving)</td></tr>
          <tr><td>components</td><td>array</td><td><span class="required">required</span></td><td>Array of { name, portion } objects</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"name"</span>: <span class="str">"My Chipotle Bowl"</span>,
  <span class="key">"chain"</span>: <span class="str">"Chipotle"</span>,
  <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">685</span>, <span class="key">"protein"</span>: <span class="num">45</span> },
  <span class="key">"nutriScore"</span>: <span class="num">3</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>,
  <span class="key">"message"</span>: <span class="str">"Meal saved to foods database"</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== SWAPS ==================== -->
  <div class="section" data-group="swaps">
    <div class="section-title">Ingredient Swaps <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/swap -->
    <div class="endpoint" data-group="swaps">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/swap</span>
        <span class="endpoint-desc">Get AI-powered ingredient swap suggestions</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Uses Gemini AI to suggest 3-5 alternative ingredients based on a reason (e.g. dairy_free, low_calorie, keto). Matches suggestions to the food database and computes nutrition differences and compatibility scores. Respects user preferences set via /preferences.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>swap_out</td><td>string</td><td><span class="required">required</span></td><td>Ingredient to replace (e.g. "cheese")</td></tr>
          <tr><td>reason</td><td>string</td><td><span class="required">required</span></td><td>Reason: dairy_free, low_calorie, keto, high_protein, low_fat, low_sodium, gluten_free, etc.</td></tr>
          <tr><td>food_id</td><td>string</td><td><span class="optional">one of</span></td><td>Food ID to get ingredient context from</td></tr>
          <tr><td>ingredients</td><td>array</td><td><span class="optional">one of</span></td><td>Array of ingredient names for context</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"original"</span>: {
    <span class="key">"name"</span>: <span class="str">"cheese"</span>,
    <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"usda-..."</span>, <span class="key">"name"</span>: <span class="str">"Cheddar cheese"</span> },
    <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">403</span> }
  },
  <span class="key">"reason"</span>: <span class="str">"dairy_free"</span>,
  <span class="key">"suggestions"</span>: [
    {
      <span class="key">"name"</span>: <span class="str">"nutritional yeast"</span>,
      <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span> },
      <span class="key">"reason"</span>: <span class="str">"Cheesy flavor without dairy, high in B vitamins"</span>,
      <span class="key">"nutrition_change"</span>: { <span class="key">"calories"</span>: <span class="num">-80</span> },
      <span class="key">"compatibility_score"</span>: <span class="num">0.85</span>
    }
  ],
  <span class="key">"user_preferences_applied"</span>: <span class="num">true</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "swap_out": "cheese", "reason": "dairy_free", "ingredients": ["rice", "chicken", "cheese", "beans"] }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/swap', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== ALTERNATIVES ==================== -->
  <div class="section" data-group="alternatives">
    <div class="section-title">Healthier Alternatives <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/foods/:id/alternatives -->
    <div class="endpoint" data-group="alternatives">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/:id/alternatives</span>
        <span class="endpoint-desc">Find healthier alternatives for a food</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Finds healthier alternatives to a specific food in the same or similar categories. Ranks alternatives by a composite score based on nutri-grade improvement and goal-specific metrics. Returns reasons and detailed improvement breakdowns.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID to find alternatives for</td></tr>
        </table>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Max results (default 10, max 25)</td></tr>
          <tr><td>goal</td><td>string</td><td><span class="optional">optional</span></td><td>One of: low_calorie, high_protein, low_fat, low_carb, low_sodium</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"original"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"Cheddar cheese"</span> },
  <span class="key">"alternatives"</span>: [
    {
      <span class="key">"food"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"Swiss cheese, low fat"</span> },
      <span class="key">"reason"</span>: <span class="str">"35% fewer calories, similar protein"</span>,
      <span class="key">"improvements"</span>: { <span class="key">"calories"</span>: { <span class="key">"change"</span>: <span class="str">"-35%"</span> } },
      <span class="key">"score"</span>: <span class="num">0.82</span>
    }
  ],
  <span class="key">"goal"</span>: <span class="str">"low_calorie"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Food ID and goal</label>
            <input class="try-input" data-path="id" placeholder="food-id" />
            <input class="try-input" data-param="goal" placeholder="goal (optional)" style="max-width:160px" />
            <input class="try-input" data-param="limit" placeholder="limit (10)" style="max-width:100px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/:id/alternatives', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/alternatives/category/:category -->
    <div class="endpoint" data-group="alternatives">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/alternatives/category/:category</span>
        <span class="endpoint-desc">Best foods in a category by goal</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns the best foods in a category ranked by a specific nutritional goal (or overall nutri-score if no goal is specified).</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>category</td><td>string</td><td><span class="required">required</span></td><td>Food category (e.g. "Dairy and Egg Products")</td></tr>
        </table>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Max results (default 10, max 50)</td></tr>
          <tr><td>goal</td><td>string</td><td><span class="optional">optional</span></td><td>One of: low_calorie, high_protein, low_fat, low_carb, low_sodium</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"category"</span>: <span class="str">"Dairy and Egg Products"</span>,
  <span class="key">"goal"</span>: <span class="str">"high_protein"</span>,
  <span class="key">"foods"</span>: [
    { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"Greek yogurt, nonfat"</span>, <span class="key">"nutrition"</span>: { <span class="key">"protein"</span>: <span class="num">10</span> } }
  ],
  <span class="key">"total"</span>: <span class="num">25</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Category and goal</label>
            <input class="try-input" data-path="category" placeholder="Dairy and Egg Products" />
            <input class="try-input" data-param="goal" placeholder="goal (optional)" style="max-width:160px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/alternatives/category/:category', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== HEALTH SCORE ==================== -->
  <div class="section" data-group="health">
    <div class="section-title">Health Score <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/foods/:id/health-score -->
    <div class="endpoint" data-group="health">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/:id/health-score</span>
        <span class="endpoint-desc">Get detailed Culture Score and nutrition analysis</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns a comprehensive health analysis including the base Culture Score, a personalized score (if preferences are set), color-coded nutrition facts with %DV ratings, glycemic index/load, and pros/cons. Each nutrient is rated as good, moderate, high, or very_high with an associated color.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"food"</span>: { <span class="key">"id"</span>: <span class="str">"..."</span>, <span class="key">"name"</span>: <span class="str">"Chicken breast"</span> },
  <span class="key">"culture_score"</span>: { <span class="key">"score"</span>: <span class="num">82</span>, <span class="key">"label"</span>: <span class="str">"Great"</span>, <span class="key">"color"</span>: <span class="str">"#2ECC71"</span> },
  <span class="key">"your_score"</span>: {
    <span class="key">"score"</span>: <span class="num">88</span>,
    <span class="key">"summary"</span>: <span class="str">"Your score is higher because it matches your high protein goal"</span>
  },
  <span class="key">"nutrition_facts"</span>: {
    <span class="key">"calories"</span>: { <span class="key">"value"</span>: <span class="num">165</span>, <span class="key">"unit"</span>: <span class="str">"kcal"</span> },
    <span class="key">"protein"</span>: { <span class="key">"value"</span>: <span class="num">31</span>, <span class="key">"rating"</span>: <span class="str">"good"</span>, <span class="key">"color"</span>: <span class="str">"#2ECC71"</span>, <span class="key">"percentDv"</span>: <span class="num">62</span> },
    <span class="key">"sodium"</span>: { <span class="key">"value"</span>: <span class="num">74</span>, <span class="key">"rating"</span>: <span class="str">"good"</span>, <span class="key">"color"</span>: <span class="str">"#2ECC71"</span>, <span class="key">"percentDv"</span>: <span class="num">3</span> }
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Food ID</label>
            <input class="try-input" data-path="id" placeholder="usda-171077" value="usda-171077" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/:id/health-score', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PREFERENCES ==================== -->
  <div class="section" data-group="preferences">
    <div class="section-title">User Preferences <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/preferences -->
    <div class="endpoint" data-group="preferences">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/preferences</span>
        <span class="endpoint-desc">Get current user preferences</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns the dietary preferences set for your API key. Preferences affect personalized health scores and ingredient swap suggestions.</p>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"preferences"</span>: {
    <span class="key">"avoid_ingredients"</span>: [<span class="str">"dairy"</span>, <span class="str">"gluten"</span>],
    <span class="key">"dietary_goals"</span>: [<span class="str">"high_protein"</span>, <span class="str">"low_carb"</span>],
    <span class="key">"health_conditions"</span>: [],
    <span class="key">"calorie_target"</span>: <span class="num">2000</span>,
    <span class="key">"protein_target"</span>: <span class="num">150</span>
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/preferences', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- PUT /api/v1/preferences -->
    <div class="endpoint" data-group="preferences">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method put">PUT</span>
        <span class="endpoint-path">/api/v1/preferences</span>
        <span class="endpoint-desc">Set or update user preferences</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Creates or updates dietary preferences for your API key. All fields are optional and only provided fields are updated. These preferences personalize health scores and filter out avoided ingredients from swap suggestions.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>avoid_ingredients</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated ingredients to avoid (e.g. "dairy,gluten,soy")</td></tr>
          <tr><td>dietary_goals</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated goals (e.g. "high_protein,low_carb")</td></tr>
          <tr><td>health_conditions</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated conditions (e.g. "diabetes,hypertension")</td></tr>
          <tr><td>calorie_target</td><td>number</td><td><span class="optional">optional</span></td><td>Daily calorie target</td></tr>
          <tr><td>protein_target</td><td>number</td><td><span class="optional">optional</span></td><td>Daily protein target (grams)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"message"</span>: <span class="str">"Preferences updated"</span>,
  <span class="key">"preferences"</span>: {
    <span class="key">"avoid_ingredients"</span>: [<span class="str">"dairy"</span>],
    <span class="key">"dietary_goals"</span>: [<span class="str">"high_protein"</span>],
    <span class="key">"calorie_target"</span>: <span class="num">2000</span>,
    <span class="key">"protein_target"</span>: <span class="num">150</span>
  }
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{ "avoid_ingredients": "dairy", "dietary_goals": "high_protein", "calorie_target": 2000 }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'PUT', '/api/v1/preferences', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== VENDORS ==================== -->
  <div class="section" data-group="vendors">
    <div class="section-title">Vendor Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/vendors -->
    <div class="endpoint" data-group="vendors">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/vendors</span>
        <span class="endpoint-desc">List vendors</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns a paginated list of registered vendors (restaurants, food trucks, farmers markets). Optionally filter by city or state.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset</td></tr>
          <tr><td>city</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by city (partial match)</td></tr>
          <tr><td>state</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by state (exact match)</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-param="city" placeholder="city" style="max-width:150px" />
            <input class="try-input" data-param="state" placeholder="state" style="max-width:80px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/vendors', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/vendors/register -->
    <div class="endpoint" data-group="vendors">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/vendors/register</span>
        <span class="endpoint-desc">Register a new vendor</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Registers a new vendor (restaurant, food truck, etc.) and returns a dedicated API key for submitting menu items.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Vendor name</td></tr>
          <tr><td>type</td><td>string</td><td><span class="required">required</span></td><td>One of: restaurant, food_truck, farmers_market, independent</td></tr>
          <tr><td>address</td><td>string</td><td><span class="optional">optional</span></td><td>Street address</td></tr>
          <tr><td>city</td><td>string</td><td><span class="optional">optional</span></td><td>City</td></tr>
          <tr><td>state</td><td>string</td><td><span class="optional">optional</span></td><td>State</td></tr>
          <tr><td>zip</td><td>string</td><td><span class="optional">optional</span></td><td>ZIP code</td></tr>
          <tr><td>lat</td><td>number</td><td><span class="optional">optional</span></td><td>Latitude</td></tr>
          <tr><td>lng</td><td>number</td><td><span class="optional">optional</span></td><td>Longitude</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"name"</span>: <span class="str">"Fresh Bowl Co"</span>,
  <span class="key">"type"</span>: <span class="str">"restaurant"</span>,
  <span class="key">"apiKey"</span>: <span class="str">"cult_..."</span>,
  <span class="key">"message"</span>: <span class="str">"Vendor registered. Use your API key to submit menu items."</span>
}</pre>
      </div>
    </div>

    <!-- GET /api/v1/vendors/:id -->
    <div class="endpoint" data-group="vendors">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/vendors/:id</span>
        <span class="endpoint-desc">Get vendor details</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns details for a specific vendor including name, type, address, and coordinates.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor ID</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-path="id" placeholder="vendor-id" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/vendors/:id', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/vendors/:id/foods -->
    <div class="endpoint" data-group="vendors">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/vendors/:id/foods</span>
        <span class="endpoint-desc">Get vendor's menu items</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all food items submitted by a specific vendor.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor ID</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-path="id" placeholder="vendor-id" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/vendors/:id/foods', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/vendors/:id/foods -->
    <div class="endpoint" data-group="vendors">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/vendors/:id/foods</span>
        <span class="endpoint-desc">Submit a menu item (recipe-based)</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Submits a new menu item by specifying its ingredients (as food IDs and grams). Nutrition is auto-calculated from USDA-verified ingredient data. Requires the vendor's own API key.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor ID</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Menu item name</td></tr>
          <tr><td>category</td><td>string</td><td><span class="optional">optional</span></td><td>Category (e.g. "Entrees")</td></tr>
          <tr><td>servingSize</td><td>number</td><td><span class="optional">optional</span></td><td>Serving size in grams (default 100)</td></tr>
          <tr><td>servingUnit</td><td>string</td><td><span class="optional">optional</span></td><td>Serving unit (default "g")</td></tr>
          <tr><td>ingredients</td><td>array</td><td><span class="required">required</span></td><td>Array of { foodId, grams } objects</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"name"</span>: <span class="str">"Grilled Chicken Bowl"</span>,
  <span class="key">"source"</span>: <span class="str">"vendor"</span>,
  <span class="key">"nutriScore"</span>: <span class="num">1</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>,
  <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">420</span>, <span class="key">"protein"</span>: <span class="num">45</span> },
  <span class="key">"message"</span>: <span class="str">"Food created. Nutrition calculated from USDA-verified ingredient data."</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== CONTRIBUTIONS ==================== -->
  <div class="section" data-group="contributions">
    <div class="section-title">Community Contributions <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/contributions -->
    <div class="endpoint" data-group="contributions">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/contributions</span>
        <span class="endpoint-desc">Submit a contribution</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Submit a new food entry, a correction to existing data, or a barcode association. Contributions are reviewed before being applied.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>type</td><td>string</td><td><span class="required">required</span></td><td>One of: new_food, correction, barcode_add</td></tr>
          <tr><td>food_id</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for correction and barcode_add</td></tr>
          <tr><td>name</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>category</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>calories</td><td>number</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>barcode</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for barcode_add</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"type"</span>: <span class="str">"new_food"</span>,
  <span class="key">"status"</span>: <span class="str">"pending"</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution submitted for review. Thank you!"</span>
}</pre>
      </div>
    </div>

    <!-- GET /api/v1/contributions -->
    <div class="endpoint" data-group="contributions">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/contributions</span>
        <span class="endpoint-desc">List your contributions</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns a paginated list of your own contributions with optional status filtering.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>status</td><td>string</td><td><span class="optional">optional</span></td><td>Filter: pending, approved, rejected</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-param="status" placeholder="status (pending)" style="max-width:150px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/contributions', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- GET /api/v1/contributions/:id -->
    <div class="endpoint" data-group="contributions">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/contributions/:id</span>
        <span class="endpoint-desc">Get contribution details</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns details for a specific contribution (must be yours).</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution ID</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-path="id" placeholder="contribution-id" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/contributions/:id', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== ADMIN ==================== -->
  <div class="section" data-group="admin">
    <div class="section-title">Admin Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(admin API key required)</span></div>

    <!-- GET /api/v1/admin/contributions -->
    <div class="endpoint" data-group="admin">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/admin/contributions</span>
        <span class="endpoint-desc">List all contributions (admin)</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all contributions from all users with optional status filtering. Requires admin tier API key.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>status</td><td>string</td><td><span class="optional">optional</span></td><td>Filter: pending, approved, rejected</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset</td></tr>
        </table>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <input class="try-input" data-param="status" placeholder="status (pending)" style="max-width:150px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/admin/contributions', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>

    <!-- POST /api/v1/admin/contributions/:id/approve -->
    <div class="endpoint" data-group="admin">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/admin/contributions/:id/approve</span>
        <span class="endpoint-desc">Approve a contribution</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Approves a pending contribution and applies its changes (inserts new food, updates existing food, or adds barcode). Requires admin tier API key.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution ID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"status"</span>: <span class="str">"approved"</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution approved and applied."</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/admin/contributions/:id/reject -->
    <div class="endpoint" data-group="admin">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/admin/contributions/:id/reject</span>
        <span class="endpoint-desc">Reject a contribution</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Rejects a pending contribution with an optional reason. Requires admin tier API key.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution ID</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>reason</td><td>string</td><td><span class="optional">optional</span></td><td>Rejection reason</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"uuid-here"</span>,
  <span class="key">"status"</span>: <span class="str">"rejected"</span>,
  <span class="key">"reason"</span>: <span class="str">"Duplicate entry"</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution rejected."</span>
}</pre>
      </div>
    </div>
  </div>

  <!-- ==================== RATE LIMITS ==================== -->
  <div class="section" data-group="rate-limits">
    <div class="section-title">Rate Limits</div>
    <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px">
      All authenticated endpoints are rate-limited based on your API key tier. Limits reset daily at midnight UTC.
    </p>
    <table class="rate-table">
      <thead>
        <tr><th>Tier</th><th>Requests / Day</th><th>Price</th></tr>
      </thead>
      <tbody>
        <tr><td style="color:var(--green);font-weight:600">Free</td><td>100</td><td>$0</td></tr>
        <tr><td style="color:var(--accent);font-weight:600">Pro</td><td>10,000</td><td>Contact us</td></tr>
        <tr><td style="color:var(--purple);font-weight:600">Enterprise</td><td>100,000</td><td>Contact us</td></tr>
      </tbody>
    </table>
    <p style="font-size:13px;color:var(--text-muted);margin-top:12px">
      When you exceed your limit, the API returns <code style="color:var(--red)">429 Too Many Requests</code>.
      Check your usage anytime via <code>GET /api/v1/keys/status</code>.
    </p>
  </div>

</div>

<script>
function toggleEndpoint(header) {
  header.parentElement.classList.toggle('open');
}

// Nav filtering
document.getElementById('nav').addEventListener('click', function(e) {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('#nav button').forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  var section = e.target.dataset.section;
  document.querySelectorAll('.section').forEach(function(s) {
    if (section === 'all') {
      s.style.display = '';
    } else {
      s.style.display = s.dataset.group === section ? '' : 'none';
    }
  });
});

function getBaseUrl() {
  return window.location.origin;
}

function tryRequest(btn, method, pathTemplate, needsAuth) {
  var card = btn.closest('.endpoint-body');
  var resultDiv = card.querySelector('.try-result');
  var apiKey = document.getElementById('globalKey').value.trim();

  if (needsAuth && !apiKey) {
    resultDiv.innerHTML = '<div class="try-status err">Enter your API key in the banner above.</div>';
    return;
  }

  // Build path from :param inputs
  var path = pathTemplate;
  card.querySelectorAll('[data-path]').forEach(function(input) {
    var val = input.value.trim();
    if (val) {
      path = path.replace(':' + input.dataset.path, encodeURIComponent(val));
    }
  });

  // Collect query params
  var params = [];
  card.querySelectorAll('[data-param]').forEach(function(input) {
    var val = input.value.trim();
    if (val) {
      params.push(encodeURIComponent(input.dataset.param) + '=' + encodeURIComponent(val));
    }
  });

  var url = getBaseUrl() + path;
  if (params.length > 0) url += '?' + params.join('&');

  var opts = { method: method, headers: {} };
  if (needsAuth && apiKey) {
    opts.headers['x-api-key'] = apiKey;
  }

  // Body for POST/PUT
  if (method === 'POST' || method === 'PUT') {
    opts.headers['Content-Type'] = 'application/json';
    var bodyEl = card.querySelector('[data-body]');
    if (bodyEl) {
      try {
        JSON.parse(bodyEl.value);
        opts.body = bodyEl.value;
      } catch(e) {
        resultDiv.innerHTML = '<div class="try-status err">Invalid JSON body: ' + e.message + '</div>';
        return;
      }
    }
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  fetch(url, opts)
    .then(function(resp) {
      var status = resp.status;
      return resp.text().then(function(text) {
        var statusClass = status >= 200 && status < 300 ? 'ok' : 'err';
        var formatted = text;
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2);
        } catch(e) {}
        resultDiv.innerHTML = '<div class="try-status ' + statusClass + '">' + status + ' ' + resp.statusText + '</div><pre>' + escapeHtml(formatted) + '</pre>';
      });
    })
    .catch(function(err) {
      resultDiv.innerHTML = '<div class="try-status err">Network error: ' + escapeHtml(err.message) + '</div>';
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = 'Send Request';
    });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
</script>
</body>
</html>`;
