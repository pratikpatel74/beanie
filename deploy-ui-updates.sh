#!/bin/bash
# Beanie deploy script
# Builds the client, copies dist into server/public/, then commits and pushes to Railway.
# Run from anywhere — the script locates the project by PROJECT_DIR below.

set -e

PROJECT_DIR="$HOME/Desktop/beanie"

echo "→ Installing server dependencies ..."
cd "$PROJECT_DIR/server"
npm install

echo "→ Building client ..."
cd "$PROJECT_DIR/client"
npm run build

echo "→ Copying client dist into server/public/ ..."
cp -r "$PROJECT_DIR/client/dist/"* "$PROJECT_DIR/server/public/"

echo "→ Staging files for commit ..."
cd "$PROJECT_DIR"

# Client source
git add client/src/

# Built client (dist is gitignored for dev, but we force-add the built output)
git add -f server/public/

# Server source
git add server/src/
git add server/package.json server/package-lock.json

echo "→ Committing ..."
git diff --cached --quiet && echo "Nothing to commit." || git commit -m "Deploy latest Beanie updates"

echo "→ Pushing ..."
git push

echo ""
echo "Done! Railway and Netlify will redeploy automatically."
