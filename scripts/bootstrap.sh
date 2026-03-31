#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads pre-built database from Firebase Storage if needed, then starts server

DB_PATH="${DB_PATH:-/tmp/culture.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_URL="https://firebasestorage.googleapis.com/v0/b/cheeseapphq.firebasestorage.app/o/culture-db%2Fculture.db.gz?alt=media"

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

  # Remove any partial/corrupt DB
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
        if (total) process.stdout.write('Downloaded ' + Math.round(downloaded/1024/1024) + '/' + Math.round(total/1024/1024) + ' MB\r');
      });
      const gunzip = zlib.createGunzip();
      const out = fs.createWriteStream(dest);
      res.pipe(gunzip).pipe(out);
      out.on('finish', () => {
        out.close();
        console.log('\nDownload and decompress complete.');
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

    if [ "$COUNT" -lt "1000" ]; then
      echo "ERROR: Database downloaded but only has $COUNT foods. File may be corrupt."
      ls -la "$DB_PATH"
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
