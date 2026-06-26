#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads pre-built database from Firebase Storage if needed, then starts server

DB_PATH="${DB_PATH:-/tmp/culture.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_URL="https://firebasestorage.googleapis.com/v0/b/cheeseapphq.firebasestorage.app/o/culture-db%2Fculture.db.gz?alt=media"

mkdir -p "$DB_DIR"

echo "DB_PATH: $DB_PATH"

# Function to count foods
count_foods() {
  node -e "
const Database = require('better-sqlite3');
try {
  const db = new Database(process.argv[1]);
  const row = db.prepare('SELECT COUNT(*) as c FROM foods').get();
  console.log(row.c);
  db.close();
} catch(e) {
  console.error('SQLite error:', e.code || e.message);
  console.log(0);
}
" "$1" 2>&1 | tail -1
}

COUNT=$(count_foods "$DB_PATH")
echo "Current food count: $COUNT"

# Force re-download on version bump
DB_VERSION_FILE="${DB_DIR}/.db_version"
CURRENT_VERSION="17"
STORED_VERSION=$(cat "$DB_VERSION_FILE" 2>/dev/null || echo "0")
if [ "$STORED_VERSION" != "$CURRENT_VERSION" ]; then
  echo "Database version mismatch ($STORED_VERSION vs $CURRENT_VERSION). Forcing re-download..."
  rm -f "$DB_PATH"
  echo "$CURRENT_VERSION" > "$DB_VERSION_FILE"
  COUNT=0
fi

if [ "$COUNT" -lt "1000" ]; then
  echo "Database needs download (foods: $COUNT). Downloading..."
  rm -f "$DB_PATH"

  node -e "
const https = require('https');
const fs = require('fs');
const zlib = require('zlib');

const url = process.argv[1];
const dest = process.argv[2];

function download(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      const gunzip = zlib.createGunzip();
      const out = fs.createWriteStream(dest);
      res.pipe(gunzip).pipe(out);
      out.on('finish', () => { out.close(); console.log('Download complete.'); resolve(); });
      out.on('error', reject); gunzip.on('error', reject); res.on('error', reject);
    }).on('error', reject);
  });
}

download(url, dest).then(() => process.exit(0)).catch((err) => { console.error('Download failed:', err.message); process.exit(1); });
" "$DB_URL" "$DB_PATH"

  DL_OK=0
  if [ $? -eq 0 ] && [ -f "$DB_PATH" ]; then
    COUNT=$(count_foods "$DB_PATH")
    if [ "$COUNT" -ge "1000" ]; then
      DL_OK=1
      echo "Database ready with $COUNT foods (downloaded)."
    fi
  fi

  # Fallback: if the Firebase download is unavailable (e.g. HTTP 402 egress quota),
  # seed from the culture.db.gz bundled in the repo so the service still boots.
  if [ "$DL_OK" -ne 1 ]; then
    BUNDLED_GZ="$(cd "$(dirname "$0")/.." && pwd)/culture.db.gz"
    echo "Download unavailable — falling back to bundled DB: $BUNDLED_GZ"
    rm -f "$DB_PATH"
    node -e "
const fs = require('fs');
const zlib = require('zlib');
const src = process.argv[1];
const dest = process.argv[2];
fs.writeFileSync(dest, zlib.gunzipSync(fs.readFileSync(src)));
console.log('Seeded from bundled DB.');
" "$BUNDLED_GZ" "$DB_PATH"

    if [ $? -eq 0 ] && [ -f "$DB_PATH" ]; then
      COUNT=$(count_foods "$DB_PATH")
      if [ "$COUNT" -lt "1000" ]; then
        echo "ERROR: Bundled DB has $COUNT foods."
        exit 1
      fi
      echo "Database ready with $COUNT foods (bundled)."
    else
      echo "ERROR: Failed to seed database (download and bundled both failed)."
      exit 1
    fi
  fi
else
  echo "Database has $COUNT foods."
fi

echo "Starting server..."
npm run start:server
