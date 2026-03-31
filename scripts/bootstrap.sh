#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads pre-built database from Firebase Storage if needed, then starts server

DB_PATH="${DB_PATH:-/app/data/culture.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_URL="https://firebasestorage.googleapis.com/v0/b/cheeseapphq.firebasestorage.app/o/culture-db%2Fculture.db.gz?alt=media&token=ea3e5ec9-5c49-4acf-85ce-98d05ec96113"

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

  curl -L -o "$DB_DIR/culture.db.gz" "$DB_URL"

  if [ $? -eq 0 ] && [ -f "$DB_DIR/culture.db.gz" ]; then
    echo "Download complete. Decompressing..."
    gunzip -f "$DB_DIR/culture.db.gz"

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
