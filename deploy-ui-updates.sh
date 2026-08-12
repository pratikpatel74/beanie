#!/bin/bash
# Beanie deploy script
# Copies updated source files → installs server deps → builds client → commits → pushes to Railway

set -e

# Game source files (client + server code)
GAME_DIR="$HOME/Library/Application Support/Claude/local-agent-mode-sessions/90a9624c-097f-4b96-93ff-443cc57017ba/14998ba6-cd60-4907-acaf-382bb5158e2d/local_3fcb91dd-27d8-4122-8811-80bacf6d83a0/outputs/beanie"

# Landing page (always use the latest — this session)
LANDING_DIR="$HOME/Library/Application Support/Claude/local-agent-mode-sessions/90a9624c-097f-4b96-93ff-443cc57017ba/14998ba6-cd60-4907-acaf-382bb5158e2d/local_c9da9aa3-b040-44a8-b73b-b16148c8a697/outputs"

PROJECT_DIR="$HOME/Desktop/beanie"

echo "→ Copying updated files to $PROJECT_DIR ..."

# Client files
cp "$GAME_DIR/client/src/socket.js"                            "$PROJECT_DIR/client/src/socket.js"
cp "$GAME_DIR/client/src/hooks/useGame.js"                     "$PROJECT_DIR/client/src/hooks/useGame.js"
cp "$GAME_DIR/client/src/index.css"                            "$PROJECT_DIR/client/src/index.css"
cp "$GAME_DIR/client/src/screens/GameScreen.jsx"               "$PROJECT_DIR/client/src/screens/GameScreen.jsx"
cp "$GAME_DIR/client/src/screens/GameEndScreen.jsx"            "$PROJECT_DIR/client/src/screens/GameEndScreen.jsx"
cp "$GAME_DIR/client/src/screens/HowToPlayScreen.jsx"          "$PROJECT_DIR/client/src/screens/HowToPlayScreen.jsx"
cp "$GAME_DIR/client/src/screens/RoundEndScreen.jsx"           "$PROJECT_DIR/client/src/screens/RoundEndScreen.jsx"
cp "$GAME_DIR/client/src/screens/HomeScreen.jsx"               "$PROJECT_DIR/client/src/screens/HomeScreen.jsx"
cp "$GAME_DIR/client/src/screens/NameScreen.jsx"               "$PROJECT_DIR/client/src/screens/NameScreen.jsx"
cp "$GAME_DIR/client/src/screens/CreateScreen.jsx"             "$PROJECT_DIR/client/src/screens/CreateScreen.jsx"
cp "$GAME_DIR/client/src/screens/JoinScreen.jsx"               "$PROJECT_DIR/client/src/screens/JoinScreen.jsx"
cp "$GAME_DIR/client/src/screens/LobbyScreen.jsx"              "$PROJECT_DIR/client/src/screens/LobbyScreen.jsx"
cp "$GAME_DIR/client/src/App.jsx"                              "$PROJECT_DIR/client/src/App.jsx"
cp "$GAME_DIR/client/src/components/ErrorBoundary.jsx"         "$PROJECT_DIR/client/src/components/ErrorBoundary.jsx"
cp "$GAME_DIR/client/src/components/Card.jsx"                  "$PROJECT_DIR/client/src/components/Card.jsx"

# Landing page — always from the latest session (LANDING_DIR)
mkdir -p "$PROJECT_DIR/server/public"
cp "$LANDING_DIR/index.html"   "$PROJECT_DIR/server/public/index.html"
cp "$GAME_DIR/netlify.toml"    "$PROJECT_DIR/netlify.toml"

# Server files
cp "$GAME_DIR/server/src/index.js"                             "$PROJECT_DIR/server/src/index.js"
cp "$GAME_DIR/server/src/socket/handlers.js"                   "$PROJECT_DIR/server/src/socket/handlers.js"
cp "$GAME_DIR/server/src/rooms/roomManager.js"                 "$PROJECT_DIR/server/src/rooms/roomManager.js"
cp "$GAME_DIR/server/src/persistence.js"                       "$PROJECT_DIR/server/src/persistence.js"
cp "$GAME_DIR/server/src/game/engine.js"                       "$PROJECT_DIR/server/src/game/engine.js"
cp "$GAME_DIR/server/package.json"                             "$PROJECT_DIR/server/package.json"

echo "→ Installing server dependencies ..."
cd "$PROJECT_DIR/server"
npm install

echo "→ Building client ..."
cd "$PROJECT_DIR/client"
npm run build

echo "→ Force-adding dist and server files to git ..."
cd "$PROJECT_DIR"
git add -f client/dist
git add server/src/persistence.js server/src/index.js server/src/socket/handlers.js
git add server/public/index.html netlify.toml
git add server/src/rooms/roomManager.js server/src/game/engine.js
git add server/package.json server/package-lock.json
git add -f client/src/socket.js client/src/hooks/useGame.js
git add -f client/src/components/ErrorBoundary.jsx client/src/components/Card.jsx
git add -f client/src/App.jsx client/src/index.css
git add -f client/src/screens/GameScreen.jsx client/src/screens/GameEndScreen.jsx client/src/screens/HowToPlayScreen.jsx client/src/screens/RoundEndScreen.jsx
git add -f client/src/screens/HomeScreen.jsx client/src/screens/NameScreen.jsx client/src/screens/CreateScreen.jsx client/src/screens/JoinScreen.jsx client/src/screens/LobbyScreen.jsx

echo "→ Committing ..."
git diff --cached --quiet && echo "Nothing to commit." || git commit -m "Deploy latest Beanie updates"

echo "→ Pushing ..."
git push

echo ""
echo "✅ Done! Railway + Netlify will redeploy automatically."
