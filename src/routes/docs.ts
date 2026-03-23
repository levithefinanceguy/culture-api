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
    <button data-section="vendors">Vendors</button>
    <button data-section="meals">Meals</button>
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
        <p style="font-size:14px;color:var(--text-muted)">Searches the food database using FTS5 full-text search. Returns paginated results ranked by relevance with custom scoring that prefers exact matches, shorter names, unbranded foods, and USDA sources.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>q</td><td>string</td><td><span class="required">required</span></td><td>Search query (e.g. "chicken breast")</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
          <tr><td>source</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by source (e.g. "usda", "vendor", "community")</td></tr>
          <tr><td>allergen_free</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated allergens to exclude (e.g. "gluten,dairy")</td></tr>
          <tr><td>dietary</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated dietary tags to require (e.g. "vegan,high-protein")</td></tr>
          <tr><td>grade</td><td>string</td><td><span class="optional">optional</span></td><td>Comma-separated Nutri-Score grades to filter (e.g. "A,B")</td></tr>
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
  <span class="key">"offset"</span>: <span class="num">0</span>
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
        <p style="font-size:14px;color:var(--text-muted)">Returns detailed nutrition information for a single food item. If the food is a vendor recipe, the response includes the recipe ingredients breakdown.</p>

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
  <span class="key">"allergens"</span>: [],
  <span class="key">"dietaryTags"</span>: [],
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
    <span class="key">"protein"</span>: <span class="num">31</span>,
    <span class="key">"vitaminD"</span>: <span class="num">0.1</span>,
    <span class="key">"calcium"</span>: <span class="num">15</span>,
    <span class="key">"iron"</span>: <span class="num">1.04</span>,
    <span class="key">"potassium"</span>: <span class="num">256</span>
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

    <!-- GET /api/v1/foods/barcode/:code -->
    <div class="endpoint" data-group="foods">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/barcode/:code</span>
        <span class="endpoint-desc">Barcode lookup</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Look up a food by its barcode (UPC/EAN). Returns full nutrition data if found.</p>

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
  </div>

  <!-- ==================== SERVINGS ==================== -->
  <div class="section" data-group="servings">
    <div class="section-title">Serving Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/foods/:id/servings -->
    <div class="endpoint" data-group="servings">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/foods/:id/servings</span>
        <span class="endpoint-desc">Calculate nutrition for custom serving</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Calculates scaled nutrition for a custom serving size. Provide one of: servings, slices, or amount+unit. Useful for calculating nutrition per-slice (pizza, bread) or for custom gram amounts.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Food ID</td></tr>
        </table>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>slices</td><td>number</td><td><span class="optional">one of</span></td><td>Number of slices (requires servings_per_container on food)</td></tr>
          <tr><td>servings</td><td>number</td><td><span class="optional">one of</span></td><td>Number of servings</td></tr>
          <tr><td>amount</td><td>number</td><td><span class="optional">one of</span></td><td>Custom amount in specified unit</td></tr>
          <tr><td>unit</td><td>string</td><td><span class="optional">optional</span></td><td>Unit for amount: g (default), oz, ml, kg, lb</td></tr>
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
            <label>Food ID</label>
            <input class="try-input" data-path="id" placeholder="usda-171077" value="usda-171077" />
          </div>
          <div class="try-input-group">
            <label>Serving parameters (provide one)</label>
            <input class="try-input" data-param="servings" placeholder="servings" style="max-width:100px" value="2" />
            <input class="try-input" data-param="slices" placeholder="slices" style="max-width:100px" />
            <input class="try-input" data-param="amount" placeholder="amount" style="max-width:100px" />
            <input class="try-input" data-param="unit" placeholder="unit (g)" style="max-width:100px" />
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
        <span class="endpoint-desc">Get size variants for a food</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all available size variants for a food item (e.g. small, medium, large pizza). Includes per-slice and whole nutrition for each size. Optionally filter by brand.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>q</td><td>string</td><td><span class="required">required</span></td><td>Food name to search (e.g. "pepperoni pizza")</td></tr>
          <tr><td>brand</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by brand name (partial match)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"item"</span>: <span class="str">"Pepperoni Pizza"</span>,
  <span class="key">"brand"</span>: <span class="str">"Papa Johns"</span>,
  <span class="key">"sizes"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"food-uuid"</span>,
      <span class="key">"size"</span>: <span class="str">"Medium"</span>,
      <span class="key">"slices"</span>: <span class="num">8</span>,
      <span class="key">"per_slice"</span>: { <span class="key">"calories"</span>: <span class="num">230</span> },
      <span class="key">"whole"</span>: { <span class="key">"calories"</span>: <span class="num">1840</span> }
    }
  ]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Search</label>
            <input class="try-input" data-param="q" placeholder="pepperoni pizza" />
            <input class="try-input" data-param="brand" placeholder="brand" style="max-width:180px" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/foods/sizes', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== PARSE ==================== -->
  <div class="section" data-group="parse">
    <div class="section-title">Parse Endpoint <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/parse -->
    <div class="endpoint" data-group="parse">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/parse</span>
        <span class="endpoint-desc">Natural language food parsing</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Parse a natural language food description into structured ingredients with nutrition. Supports quantities (numbers, fractions, words like "two"), units (cups, oz, tbsp, slices, pieces), and multiple items separated by commas, "and", or newlines. Max 2000 characters.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>input</td><td>string</td><td><span class="required">required</span></td><td>Natural language text describing food (e.g. "2 eggs and a slice of toast")</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"input"</span>: <span class="str">"2 eggs and a slice of toast"</span>,
  <span class="key">"items"</span>: [
    {
      <span class="key">"original"</span>: <span class="str">"2 eggs"</span>,
      <span class="key">"quantity"</span>: <span class="num">2</span>,
      <span class="key">"unit"</span>: <span class="str">"whole"</span>,
      <span class="key">"food_query"</span>: <span class="str">"eggs"</span>,
      <span class="key">"match"</span>: { <span class="key">"id"</span>: <span class="str">"usda-171287"</span>, <span class="key">"name"</span>: <span class="str">"Egg, whole, cooked"</span> },
      <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">143</span>, <span class="key">"protein"</span>: <span class="num">12.6</span> },
      <span class="key">"confidence"</span>: <span class="num">0.9</span>
    }
  ],
  <span class="key">"totals"</span>: { <span class="key">"calories"</span>: <span class="num">222</span>, <span class="key">"protein"</span>: <span class="num">15.3</span> },
  <span class="key">"matched"</span>: <span class="num">2</span>,
  <span class="key">"total_items"</span>: <span class="num">2</span>
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
    <div class="section-title">Scan Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- POST /api/v1/scan/label -->
    <div class="endpoint" data-group="scan">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/scan/label</span>
        <span class="endpoint-desc">Extract nutrition from image</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Accepts a base64-encoded image and uses AI (Gemini) to extract structured nutrition data. Supports nutrition labels, barcodes, and menus. Returns extracted data with auto-detected allergens, dietary tags, and Nutri-Score.</p>

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
    <span class="key">"name"</span>: <span class="str">"Granola Bar"</span>,
    <span class="key">"calories"</span>: <span class="num">190</span>,
    <span class="key">"protein"</span>: <span class="num">3</span>,
    <span class="key">"total_fat"</span>: <span class="num">7</span>,
    <span class="key">"total_carbohydrates"</span>: <span class="num">29</span>
  },
  <span class="key">"allergens"</span>: [<span class="str">"gluten"</span>, <span class="str">"nuts"</span>],
  <span class="key">"dietary_tags"</span>: [<span class="str">"vegetarian"</span>],
  <span class="key">"nutri_score"</span>: { <span class="key">"score"</span>: <span class="num">5</span>, <span class="key">"grade"</span>: <span class="str">"C"</span> },
  <span class="key">"message"</span>: <span class="str">"Review the extracted data and submit it via POST /api/v1/scan/submit"</span>
}</pre>
      </div>
    </div>

    <!-- POST /api/v1/scan/submit -->
    <div class="endpoint" data-group="scan">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method post">POST</span>
        <span class="endpoint-path">/api/v1/scan/submit</span>
        <span class="endpoint-desc">Save scanned food entry</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Takes extracted/reviewed nutrition data and saves it as a community food entry. Automatically detects allergens, dietary tags, and calculates Nutri-Score. Rejects duplicate barcodes.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Food name</td></tr>
          <tr><td>brand</td><td>string</td><td><span class="optional">optional</span></td><td>Brand name</td></tr>
          <tr><td>barcode</td><td>string</td><td><span class="optional">optional</span></td><td>Barcode (UPC/EAN)</td></tr>
          <tr><td>ingredients_text</td><td>string</td><td><span class="optional">optional</span></td><td>Full ingredients list text</td></tr>
          <tr><td>nutrition</td><td>object</td><td><span class="required">required</span></td><td>Nutrition object with at least calories. Fields: calories, total_fat, saturated_fat, trans_fat, cholesterol, sodium, total_carbohydrates, dietary_fiber, total_sugars, protein, vitamin_d, calcium, iron, potassium, serving_size, serving_unit</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"new-food-uuid"</span>,
  <span class="key">"name"</span>: <span class="str">"Granola Bar"</span>,
  <span class="key">"source"</span>: <span class="str">"community"</span>,
  <span class="key">"calories"</span>: <span class="num">190</span>,
  <span class="key">"allergens"</span>: [<span class="str">"gluten"</span>, <span class="str">"nuts"</span>],
  <span class="key">"dietary_tags"</span>: [<span class="str">"vegetarian"</span>],
  <span class="key">"nutri_score"</span>: { <span class="key">"score"</span>: <span class="num">5</span>, <span class="key">"grade"</span>: <span class="str">"C"</span> },
  <span class="key">"message"</span>: <span class="str">"Food entry created successfully from scanned label."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "name": "Example Food",
  "brand": "Brand",
  "nutrition": {
    "calories": 200,
    "protein": 10,
    "total_fat": 8,
    "total_carbohydrates": 25
  }
}</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/scan/submit', true)">Send Request</button>
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
        <p style="font-size:14px;color:var(--text-muted)">Returns a paginated list of registered vendors (restaurants, food trucks, etc.). Optionally filter by city or state.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>city</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by city name (partial match)</td></tr>
          <tr><td>state</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by state (exact, e.g. "CA")</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"vendors"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"abc-123"</span>,
      <span class="key">"name"</span>: <span class="str">"Fresh Bowl Co."</span>,
      <span class="key">"type"</span>: <span class="str">"restaurant"</span>,
      <span class="key">"city"</span>: <span class="str">"Austin"</span>,
      <span class="key">"state"</span>: <span class="str">"TX"</span>
    }
  ],
  <span class="key">"total"</span>: <span class="num">12</span>,
  <span class="key">"limit"</span>: <span class="num">25</span>,
  <span class="key">"offset"</span>: <span class="num">0</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Filters</label>
            <input class="try-input" data-param="city" placeholder="city" style="max-width:150px" />
            <input class="try-input" data-param="state" placeholder="state (e.g. CA)" style="max-width:120px" />
            <input class="try-input" data-param="limit" placeholder="limit" style="max-width:80px" />
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
        <p style="font-size:14px;color:var(--text-muted)">Register a new vendor (restaurant, food truck, etc.) and receive a vendor-specific API key for submitting menu items.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Vendor name</td></tr>
          <tr><td>type</td><td>string</td><td><span class="required">required</span></td><td>One of: restaurant, food_truck, farmers_market, independent</td></tr>
          <tr><td>address</td><td>string</td><td><span class="optional">optional</span></td><td>Street address</td></tr>
          <tr><td>city</td><td>string</td><td><span class="optional">optional</span></td><td>City</td></tr>
          <tr><td>state</td><td>string</td><td><span class="optional">optional</span></td><td>State code (e.g. "CA")</td></tr>
          <tr><td>zip</td><td>string</td><td><span class="optional">optional</span></td><td>ZIP code</td></tr>
          <tr><td>lat</td><td>number</td><td><span class="optional">optional</span></td><td>Latitude</td></tr>
          <tr><td>lng</td><td>number</td><td><span class="optional">optional</span></td><td>Longitude</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"abc-123-def-456"</span>,
  <span class="key">"name"</span>: <span class="str">"Fresh Bowl Co."</span>,
  <span class="key">"type"</span>: <span class="str">"restaurant"</span>,
  <span class="key">"apiKey"</span>: <span class="str">"cult_v1b2c3d4..."</span>,
  <span class="key">"message"</span>: <span class="str">"Vendor registered. Use your API key to submit menu items."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "name": "Fresh Bowl Co.",
  "type": "restaurant",
  "city": "Austin",
  "state": "TX"
}</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/vendors/register', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
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
        <p style="font-size:14px;color:var(--text-muted)">Returns details for a single vendor by ID including name, type, address, and coordinates.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor UUID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"abc-123-def-456"</span>,
  <span class="key">"name"</span>: <span class="str">"Fresh Bowl Co."</span>,
  <span class="key">"type"</span>: <span class="str">"restaurant"</span>,
  <span class="key">"city"</span>: <span class="str">"Austin"</span>,
  <span class="key">"state"</span>: <span class="str">"TX"</span>,
  <span class="key">"lat"</span>: <span class="num">30.267</span>,
  <span class="key">"lng"</span>: <span class="num">-97.743</span>,
  <span class="key">"created_at"</span>: <span class="str">"2026-03-20T12:00:00Z"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Vendor ID</label>
            <input class="try-input" data-path="id" placeholder="vendor-uuid" />
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
        <p style="font-size:14px;color:var(--text-muted)">Returns all food items submitted by this vendor.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor UUID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"vendor"</span>: <span class="str">"Fresh Bowl Co."</span>,
  <span class="key">"foods"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"food-uuid-123"</span>,
      <span class="key">"name"</span>: <span class="str">"Grilled Chicken Bowl"</span>,
      <span class="key">"category"</span>: <span class="str">"Entrees"</span>
    }
  ]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Vendor ID</label>
            <input class="try-input" data-path="id" placeholder="vendor-uuid" />
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
        <span class="endpoint-desc">Submit a recipe / menu item</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Submit a menu item as a recipe composed of USDA-verified ingredients. Nutrition is automatically calculated from the ingredient quantities. Nutri-Score is computed per 100g. Requires the vendor's own API key.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Vendor UUID (must match your vendor API key)</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Menu item name</td></tr>
          <tr><td>category</td><td>string</td><td><span class="optional">optional</span></td><td>Category (default: "Uncategorized")</td></tr>
          <tr><td>servingSize</td><td>number</td><td><span class="optional">optional</span></td><td>Serving size (default: 100)</td></tr>
          <tr><td>servingUnit</td><td>string</td><td><span class="optional">optional</span></td><td>Serving unit (default: "g")</td></tr>
          <tr><td>ingredients</td><td>array</td><td><span class="required">required</span></td><td>Array of { foodId: string, grams: number }</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"new-food-uuid"</span>,
  <span class="key">"name"</span>: <span class="str">"Grilled Chicken Bowl"</span>,
  <span class="key">"source"</span>: <span class="str">"vendor"</span>,
  <span class="key">"vendorId"</span>: <span class="str">"vendor-uuid"</span>,
  <span class="key">"nutriScore"</span>: <span class="num">-2</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"A"</span>,
  <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">412.5</span>, <span class="key">"protein"</span>: <span class="num">38.2</span> },
  <span class="key">"ingredientCount"</span>: <span class="num">2</span>,
  <span class="key">"message"</span>: <span class="str">"Food created. Nutrition calculated from USDA-verified ingredient data."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Vendor ID (path)</label>
            <input class="try-input" data-path="id" placeholder="vendor-uuid" />
          </div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "name": "Grilled Chicken Bowl",
  "category": "Entrees",
  "servingSize": 350,
  "servingUnit": "g",
  "ingredients": [
    { "foodId": "usda-171077", "grams": 200 },
    { "foodId": "usda-168875", "grams": 100 }
  ]
}</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/vendors/:id/foods', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== MEALS ==================== -->
  <div class="section" data-group="meals">
    <div class="section-title">Meal Builder Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

    <!-- GET /api/v1/meals/chains -->
    <div class="endpoint" data-group="meals">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/meals/chains</span>
        <span class="endpoint-desc">List chains with component data</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all restaurant chains that have meal component data available for building custom meals.</p>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"chains"</span>: [
    {
      <span class="key">"name"</span>: <span class="str">"Chipotle"</span>,
      <span class="key">"componentCount"</span>: <span class="num">45</span>,
      <span class="key">"categoryCount"</span>: <span class="num">6</span>
    }
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
        <span class="endpoint-desc">Get chain components by category</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all available components for a chain, grouped by category (e.g. Protein, Rice, Toppings). Each component includes nutrition per portion type (standard, light, double, etc.) with allergen and dietary tag info.</p>

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
          <span class="key">"standard"</span>: {
            <span class="key">"portionGrams"</span>: <span class="num">113</span>,
            <span class="key">"calories"</span>: <span class="num">180</span>,
            <span class="key">"protein"</span>: <span class="num">32</span>,
            <span class="key">"allergens"</span>: [],
            <span class="key">"dietaryTags"</span>: [<span class="str">"gluten-free"</span>]
          }
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
        <span class="endpoint-desc">Build a custom meal</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Build a custom meal from chain components and get combined nutrition totals with Nutri-Score, allergen summary, and per-component breakdown. Does not save the meal.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>chain</td><td>string</td><td><span class="required">required</span></td><td>Chain name</td></tr>
          <tr><td>name</td><td>string</td><td><span class="optional">optional</span></td><td>Custom meal name</td></tr>
          <tr><td>components</td><td>array</td><td><span class="required">required</span></td><td>Array of { name: string, portion?: string }. Portion defaults to "standard".</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"meal"</span>: {
    <span class="key">"name"</span>: <span class="str">"My Chipotle Bowl"</span>,
    <span class="key">"chain"</span>: <span class="str">"Chipotle"</span>,
    <span class="key">"componentCount"</span>: <span class="num">4</span>
  },
  <span class="key">"totals"</span>: {
    <span class="key">"calories"</span>: <span class="num">735</span>,
    <span class="key">"protein"</span>: <span class="num">45.2</span>,
    <span class="key">"portionGrams"</span>: <span class="num">510</span>
  },
  <span class="key">"nutriScore"</span>: <span class="num">3</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>,
  <span class="key">"allergens"</span>: [<span class="str">"dairy"</span>],
  <span class="key">"breakdown"</span>: [...]
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "chain": "Chipotle",
  "name": "My Chipotle Bowl",
  "components": [
    { "name": "Chicken" },
    { "name": "White Rice" },
    { "name": "Black Beans" },
    { "name": "Mild Salsa" }
  ]
}</textarea>
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
        <span class="endpoint-desc">Build and save a custom meal</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Like /meals/build, but also saves the combined meal as a new food entry in the database. The meal becomes searchable and retrievable by ID.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>chain</td><td>string</td><td><span class="required">required</span></td><td>Chain name</td></tr>
          <tr><td>name</td><td>string</td><td><span class="required">required</span></td><td>Meal name (required for saving)</td></tr>
          <tr><td>components</td><td>array</td><td><span class="required">required</span></td><td>Array of { name: string, portion?: string }</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"new-food-uuid"</span>,
  <span class="key">"name"</span>: <span class="str">"My Chipotle Bowl"</span>,
  <span class="key">"chain"</span>: <span class="str">"Chipotle"</span>,
  <span class="key">"components"</span>: [<span class="str">"Chicken (standard)"</span>, <span class="str">"White Rice (standard)"</span>],
  <span class="key">"servingSize"</span>: <span class="num">510</span>,
  <span class="key">"servingUnit"</span>: <span class="str">"g"</span>,
  <span class="key">"nutrition"</span>: { <span class="key">"calories"</span>: <span class="num">735</span>, <span class="key">"protein"</span>: <span class="num">45.2</span> },
  <span class="key">"nutriScore"</span>: <span class="num">3</span>,
  <span class="key">"nutriGrade"</span>: <span class="str">"B"</span>,
  <span class="key">"message"</span>: <span class="str">"Meal saved to foods database"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "chain": "Chipotle",
  "name": "My Chipotle Bowl",
  "components": [
    { "name": "Chicken" },
    { "name": "White Rice" },
    { "name": "Black Beans" }
  ]
}</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/meals/save', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== CONTRIBUTIONS ==================== -->
  <div class="section" data-group="contributions">
    <div class="section-title">Contribution Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(authenticated)</span></div>

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
        <p style="font-size:14px;color:var(--text-muted)">Submit a community contribution: add a new food, correct existing food data, or add a barcode to an existing food. Contributions are reviewed before being applied.</p>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>type</td><td>string</td><td><span class="required">required</span></td><td>One of: new_food, correction, barcode_add</td></tr>
          <tr><td>food_id</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for correction and barcode_add types</td></tr>
          <tr><td>name</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>category</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>calories</td><td>number</td><td><span class="optional">conditional</span></td><td>Required for new_food</td></tr>
          <tr><td>barcode</td><td>string</td><td><span class="optional">conditional</span></td><td>Required for barcode_add</td></tr>
          <tr><td>...</td><td>any</td><td><span class="optional">optional</span></td><td>Any additional nutrition fields to set/correct</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"contribution-uuid"</span>,
  <span class="key">"type"</span>: <span class="str">"new_food"</span>,
  <span class="key">"status"</span>: <span class="str">"pending"</span>,
  <span class="key">"food_id"</span>: <span class="null">null</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution submitted for review. Thank you!"</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Request Body (JSON)</label>
            <textarea class="try-input" data-body>{
  "type": "new_food",
  "name": "Homemade Granola",
  "category": "Cereals",
  "calories": 450,
  "protein": 10,
  "total_fat": 18,
  "total_carbohydrates": 65
}</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/contributions', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
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
        <p style="font-size:14px;color:var(--text-muted)">Returns a paginated list of contributions submitted with your API key. Optionally filter by status.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>status</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by status: pending, approved, rejected</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"contributions"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"contrib-uuid"</span>,
      <span class="key">"type"</span>: <span class="str">"new_food"</span>,
      <span class="key">"status"</span>: <span class="str">"pending"</span>,
      <span class="key">"data"</span>: { <span class="key">"name"</span>: <span class="str">"Homemade Granola"</span> },
      <span class="key">"createdAt"</span>: <span class="str">"2026-03-20T12:00:00Z"</span>
    }
  ],
  <span class="key">"total"</span>: <span class="num">3</span>,
  <span class="key">"limit"</span>: <span class="num">25</span>,
  <span class="key">"offset"</span>: <span class="num">0</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Filters</label>
            <input class="try-input" data-param="status" placeholder="status (pending)" style="max-width:150px" />
            <input class="try-input" data-param="limit" placeholder="limit" style="max-width:80px" />
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
        <p style="font-size:14px;color:var(--text-muted)">Returns details for a specific contribution. You can only view your own contributions (matched by API key).</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution UUID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"contrib-uuid"</span>,
  <span class="key">"type"</span>: <span class="str">"new_food"</span>,
  <span class="key">"status"</span>: <span class="str">"approved"</span>,
  <span class="key">"foodId"</span>: <span class="null">null</span>,
  <span class="key">"data"</span>: { <span class="key">"name"</span>: <span class="str">"Homemade Granola"</span>, <span class="key">"calories"</span>: <span class="num">450</span> },
  <span class="key">"createdAt"</span>: <span class="str">"2026-03-20T12:00:00Z"</span>,
  <span class="key">"reviewedAt"</span>: <span class="str">"2026-03-21T08:00:00Z"</span>,
  <span class="key">"reviewerNote"</span>: <span class="null">null</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Contribution ID</label>
            <input class="try-input" data-path="id" placeholder="contribution-uuid" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'GET', '/api/v1/contributions/:id', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ==================== ADMIN ==================== -->
  <div class="section" data-group="admin">
    <div class="section-title">Admin Endpoints <span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">(admin tier required)</span></div>

    <!-- GET /api/v1/admin/contributions -->
    <div class="endpoint" data-group="admin">
      <div class="endpoint-header" onclick="toggleEndpoint(this)">
        <span class="method get">GET</span>
        <span class="endpoint-path">/api/v1/admin/contributions</span>
        <span class="endpoint-desc">List all contributions</span>
        <span class="endpoint-chevron">&#9654;</span>
      </div>
      <div class="endpoint-body">
        <div class="detail-label">Description</div>
        <p style="font-size:14px;color:var(--text-muted)">Returns all contributions across all users. Requires admin-tier API key. Optionally filter by status.</p>

        <div class="detail-label">Query Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>status</td><td>string</td><td><span class="optional">optional</span></td><td>Filter by status: pending, approved, rejected</td></tr>
          <tr><td>limit</td><td>integer</td><td><span class="optional">optional</span></td><td>Results per page (default 25, max 100)</td></tr>
          <tr><td>offset</td><td>integer</td><td><span class="optional">optional</span></td><td>Pagination offset (default 0)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"contributions"</span>: [
    {
      <span class="key">"id"</span>: <span class="str">"contrib-uuid"</span>,
      <span class="key">"apiKey"</span>: <span class="str">"cult_..."</span>,
      <span class="key">"type"</span>: <span class="str">"new_food"</span>,
      <span class="key">"status"</span>: <span class="str">"pending"</span>,
      <span class="key">"data"</span>: { <span class="key">"name"</span>: <span class="str">"Homemade Granola"</span> },
      <span class="key">"createdAt"</span>: <span class="str">"2026-03-20T12:00:00Z"</span>
    }
  ],
  <span class="key">"total"</span>: <span class="num">15</span>,
  <span class="key">"limit"</span>: <span class="num">25</span>,
  <span class="key">"offset"</span>: <span class="num">0</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Filters</label>
            <input class="try-input" data-param="status" placeholder="status (pending)" style="max-width:150px" />
            <input class="try-input" data-param="limit" placeholder="limit" style="max-width:80px" />
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
        <p style="font-size:14px;color:var(--text-muted)">Approves a pending contribution and applies the changes to the database. For new_food, creates a new food entry. For correction, updates the existing food. For barcode_add, adds the barcode. Only pending contributions can be approved.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution UUID</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"contrib-uuid"</span>,
  <span class="key">"status"</span>: <span class="str">"approved"</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution approved and applied."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Contribution ID</label>
            <input class="try-input" data-path="id" placeholder="contribution-uuid" />
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/admin/contributions/:id/approve', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
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
        <p style="font-size:14px;color:var(--text-muted)">Rejects a pending contribution with an optional reason. Only pending contributions can be rejected.</p>

        <div class="detail-label">Path Parameters</div>
        <table class="param-table">
          <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>id</td><td>string</td><td><span class="required">required</span></td><td>Contribution UUID</td></tr>
        </table>

        <div class="detail-label">Request Body</div>
        <table class="param-table">
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td>reason</td><td>string</td><td><span class="optional">optional</span></td><td>Reason for rejection (shown to the contributor)</td></tr>
        </table>

        <div class="detail-label">Example Response</div>
        <pre>{
  <span class="key">"id"</span>: <span class="str">"contrib-uuid"</span>,
  <span class="key">"status"</span>: <span class="str">"rejected"</span>,
  <span class="key">"reason"</span>: <span class="str">"Duplicate entry"</span>,
  <span class="key">"message"</span>: <span class="str">"Contribution rejected."</span>
}</pre>

        <div class="try-it">
          <div class="try-it-title">&#9889; Try it</div>
          <div class="try-input-group">
            <label>Contribution ID</label>
            <input class="try-input" data-path="id" placeholder="contribution-uuid" />
          </div>
          <div class="try-input-group">
            <label>Request Body (JSON, optional)</label>
            <textarea class="try-input" data-body>{ "reason": "Duplicate entry" }</textarea>
          </div>
          <button class="try-btn" onclick="tryRequest(this, 'POST', '/api/v1/admin/contributions/:id/reject', true)">Send Request</button>
          <div class="try-result"></div>
        </div>
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
  const section = e.target.dataset.section;
  document.querySelectorAll('.section').forEach(s => {
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

  // Body for POST
  if (method === 'POST') {
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
