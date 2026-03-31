#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads pre-built database from Firebase Storage if needed, then starts server

DB_PATH="${DB_PATH:-/app/data/culture.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_URL="https://firebasestorage.googleapis.com/v0/b/cheeseapphq.firebasestorage.app/o/culture-db%2Fculture.db.gz?alt=media&token=683a6450-b828-4b78-be3a-54c78424c239"

mkdir -p "$DB_DIR"

# Check if database has data
COUNT=$(node -e "
const Database = require('better-sqlite3');
try {
  const db = new Database('$DB_PATH');
  const row = db.prepare('SELECT COUNT(*) as c FROM foods').get();
  console.log(row.c);
  db.close();
} catch(e) { console.log(0); }
" 2>/dev/null)

echo "Current food count: $COUNT"

if [ "$COUNT" -lt "1000" ]; then
  echo "Database empty or missing. Downloading pre-built database from Firebase Storage..."

  node -e "
const https = require('https');
const fs = require('fs');
const zlib = require('zlib');
const url = '$DB_URL';
const dest = '$DB_PATH';

function download(u) {
  https.get(u, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return download(res.headers.location);
    }
    if (res.statusCode !== 200) {
      console.error('HTTP ' + res.statusCode);
      process.exit(1);
    }
    const total = parseInt(res.headers['content-length'] || '0');
    let downloaded = 0;
    res.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total) process.stdout.write('Downloaded ' + Math.round(downloaded/1024/1024) + '/' + Math.round(total/1024/1024) + ' MB\r');
    });
    res.pipe(zlib.createGunzip()).pipe(fs.createWriteStream(dest)).on('finish', () => {
      console.log('\nDownload and decompress complete.');
    });
  });
}
download(url);
"

  if [ $? -eq 0 ] && [ -f "$DB_PATH" ]; then

    # Verify the download worked
    COUNT=$(node -e "
const Database = require('better-sqlite3');
try {
  const db = new Database('$DB_PATH');
  const row = db.prepare('SELECT COUNT(*) as c FROM foods').get();
  console.log(row.c);
  db.close();
} catch(e) { console.log(0); }
" 2>/dev/null)

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
