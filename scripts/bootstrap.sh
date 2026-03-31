#!/bin/bash
# Bootstrap script for Railway deployment
# Downloads and imports USDA data if database is empty

DB_PATH="${DB_PATH:-/app/data/culture.db}"

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
  echo "Database empty or missing. Running USDA bulk import..."
  echo "This will download ~2GB of data and take 10-15 minutes."
  npm run import:bulk

  echo "Calculating nutrition scores..."
  npx ts-node scripts/add-scores.ts

  echo "Calculating culture scores..."
  npx ts-node scripts/add-culture-score.ts

  echo "Bootstrap complete!"
else
  echo "Database has $COUNT foods. Skipping import."
fi

echo "Starting server..."
npm run start:server
