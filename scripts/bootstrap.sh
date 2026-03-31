#!/bin/bash
# Bootstrap script for Railway deployment
# Starts server immediately, imports data in background if needed

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
  echo "Database empty. Starting server first, then importing in background..."
  # Start server in background
  npm run start:server &
  SERVER_PID=$!

  # Wait for server to be ready
  sleep 5

  echo "Running USDA bulk import in background..."
  npm run import:bulk 2>&1 | tail -20

  echo "Calculating scores..."
  npx ts-node scripts/add-scores.ts 2>&1 | tail -5

  echo "Bootstrap import complete! Server is running."
  # Wait for server process
  wait $SERVER_PID
else
  echo "Database has $COUNT foods. Starting server."
  npm run start:server
fi
