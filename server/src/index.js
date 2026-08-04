// index.js — Beanie game server entry point
//
// In production (NODE_ENV=production) the server also serves the built
// Vite client from ../../client/dist — so a single Railway service handles
// both WebSockets AND the static front-end.
//
// In development, run the Vite dev server separately on port 5173.

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');

const registerHandlers = require('./socket/handlers');
const rm               = require('./rooms/roomManager');

const PORT    = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Built client lives at ../../client/dist relative to this file
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

// Marketing landing page (served for www.* requests)
const LANDING_HTML = path.join(__dirname, '..', 'public', 'landing.html');

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();

// In dev allow the Vite dev server; in prod same-origin (no CORS needed)
const corsOrigin = IS_PROD ? false : ['http://localhost:5173', 'http://localhost:3001'];
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve built React app in production
if (IS_PROD) {
  // Landing page for www.playbeanie.com and www.playbeanie.co.uk
  app.get('*', (req, res, next) => {
    if ((req.hostname || '').startsWith('www.')) {
      return res.sendFile(LANDING_HTML);
    }
    next();
  });

  app.use(express.static(CLIENT_DIST));
  // SPA fallback — all non-API routes return index.html
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

// ─── Socket.io ───────────────────────────────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: IS_PROD ? false : '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', socket => {
  console.log(`[connect]    ${socket.id}`);
  registerHandlers(io, socket);
  socket.on('disconnect', () => console.log(`[disconnect] ${socket.id}`));
});

// ─── Start ───────────────────────────────────────────────────────────────────
// Restore persisted rooms from Redis before accepting connections, so
// room:rejoin requests work immediately after a server restart.

rm.initRooms()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Beanie server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
  })
  .catch(err => {
    console.error('[startup] initRooms failed — starting anyway:', err.message);
    httpServer.listen(PORT, () => {
      console.log(`Beanie server running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
    });
  });
