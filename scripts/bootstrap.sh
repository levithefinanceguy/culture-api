#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads pre-built database from Firebase Storage if needed, then starts server

DB_PATH="${DB_PATH:-/tmp/culture.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_URL="https://firebasestorage.googleapis.com/v0/b/cheeseapphq.firebasestorage.app/o/culture-db%2Fculture.db.gz?alt=media"

mkdir -p "$DB_DIR"

echo "DB_PATH: $DB_PATH"

# Function to count foods — shows errors instead of hiding them
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

# Force re-download for restaurant update (v2)
DB_VERSION_FILE="${DB_DIR}/.db_version"
CURRENT_VERSION="10"
STORED_VERSION=$(cat "$DB_VERSION_FILE" 2>/dev/null || echo "0")
if [ "$STORED_VERSION" != "$CURRENT_VERSION" ]; then
  echo "Database version mismatch ($STORED_VERSION vs $CURRENT_VERSION). Forcing re-download..."
  rm -f "$DB_PATH"
  echo "$CURRENT_VERSION" > "$DB_VERSION_FILE"
fi

VENDOR_COUNT=$(node -e "
const Database = require('better-sqlite3');
try { const db = new Database(process.argv[1]); const r = db.prepare(\"SELECT COUNT(*) as c FROM foods WHERE source='vendor'\").get(); console.log(r.c); db.close(); } catch(e) { console.log(0); }
" "$DB_PATH" 2>&1 | tail -1)
echo "Vendor food count: $VENDOR_COUNT"

if [ "$COUNT" -lt "1000" ] || [ "$VENDOR_COUNT" -lt "1275" ]; then
  echo "Database needs update (foods: $COUNT, vendors: $VENDOR_COUNT). Downloading..."
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
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0');
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total && downloaded % (5*1024*1024) < chunk.length) {
          console.log('Downloaded ' + Math.round(downloaded/1024/1024) + '/' + Math.round(total/1024/1024) + ' MB');
        }
      });
      const gunzip = zlib.createGunzip();
      const out = fs.createWriteStream(dest);
      res.pipe(gunzip).pipe(out);
      out.on('finish', () => {
        out.close();
        console.log('Download and decompress complete.');
        console.log('File size: ' + Math.round(fs.statSync(dest).size / 1024 / 1024) + ' MB');
        resolve();
      });
      out.on('error', reject);
      gunzip.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

download(url, dest).then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Download failed:', err.message);
  process.exit(1);
});
" "$DB_URL" "$DB_PATH"

  if [ $? -eq 0 ] && [ -f "$DB_PATH" ]; then
    echo "File downloaded:"
    ls -la "$DB_PATH"

    # Check SQLite header
    HEADER=$(head -c 16 "$DB_PATH" | strings)
    echo "SQLite header: $HEADER"

    COUNT=$(count_foods "$DB_PATH")

    if [ "$COUNT" -lt "1000" ]; then
      echo "ERROR: Database has $COUNT foods after download."
      echo "Trying direct sqlite3 check..."
      sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM foods;" 2>&1 || true
      echo "Tables in DB:"
      sqlite3 "$DB_PATH" ".tables" 2>&1 || true
      exit 1
    fi

    echo "Database ready with $COUNT foods."
  else
    echo "ERROR: Failed to download database."
    exit 1
  fi
else
  echo "Database has $COUNT foods."
fi

echo "Starting server..."
npm run start:server
