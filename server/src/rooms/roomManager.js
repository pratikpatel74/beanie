// roomManager.js — In-memory store for all active game rooms
//
// Each room maps a roomCode → game state (from engine.js).
// The Socket.io layer calls these functions; the results are
// broadcast to all players in the room.
//
// Persistence: every mutation is saved to Upstash Redis (fire-and-forget).
// On startup, initRooms() restores any rooms that were active before a restart.

const {
  createGame, addPlayer, removePlayer,
  startGame, nextRound,
  drawFromPile, drawFromDiscard,
  layDownSet, addCardsToSet, addBeanieToSet, stealBeanie, discard,
  declareDraw,
  pauseGame, resumeGame,
  STATUS,
} = require('../game/engine');

const persistence = require('../persistence');

const rooms = new Map(); // roomCode → gameState

// ─── Idle room cleanup ────────────────────────────────────────────────────────
// Rooms that haven't been touched in IDLE_TTL_MS are deleted from memory and
// Redis. This runs every hour. Redis itself also has a 24h TTL as a backstop.

const IDLE_TTL_MS      = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL = 60 * 60 * 1000;       // check every hour

// Each room gets a lastActivity timestamp updated on every mutation.
const roomActivity = new Map(); // roomCode → Date.now()

function touchRoom(roomCode) {
  roomActivity.set(roomCode, Date.now());
}

setInterval(() => {
  const now = Date.now();
  let count = 0;
  for (const [roomCode, lastActive] of roomActivity.entries()) {
    if (now - lastActive > IDLE_TTL_MS) {
      rooms.delete(roomCode);
      roomActivity.delete(roomCode);
      persistence.deleteRoom(roomCode);
      count++;
    }
  }
  if (count > 0) console.log(`[cleanup] Removed ${count} idle room(s)`);
}, CLEANUP_INTERVAL);

// ─── Startup ─────────────────────────────────────────────────────────────────

/**
 * Restore rooms from Redis on server startup.
 * Called once from index.js before the HTTP server starts listening.
 */
async function initRooms() {
  const saved = await persistence.loadAllRooms();
  const codes = Object.keys(saved);
  if (codes.length === 0) return;

  let restored = 0;
  codes.forEach(code => {
    const room = saved[code];

    // Don't restore completed games — they can't be resumed and may carry stale state.
    if (room.status === STATUS.GAME_END) {
      persistence.deleteRoom(code);
      return;
    }

    // Detect corrupted PLAYING rooms: the old timer-race bug could leave multiple
    // players with 8+ cards. Legitimately only one player (the current one) can
    // ever hold 8 cards at a time. Purge any room where this invariant is violated.
    if (room.status === STATUS.PLAYING) {
      const tooMany = (room.players || []).filter(p => (p.hand || []).length >= 8);
      if (tooMany.length > 1) {
        console.log(`[roomManager] Purging corrupted room ${code} (${tooMany.length} players with 8+ cards)`);
        persistence.deleteRoom(code);
        return;
      }
    }

    rooms.set(code, room);
    touchRoom(code);
    restored++;
  });

  console.log(`[roomManager] Restored ${restored} room(s) from Redis (skipped ${codes.length - restored} completed)`);
}

// ─── Room lifecycle ───────────────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code; // retry on collision
}

function createRoom(hostId, hostName) {
  const roomCode = generateRoomCode();
  let game = createGame(roomCode);
  game = addPlayer(game, hostId, hostName);
  rooms.set(roomCode, game);
  touchRoom(roomCode);
  persistence.saveRoom(roomCode, game);
  return { roomCode, game };
}

function joinRoom(roomCode, playerId, playerName) {
  const game = rooms.get(roomCode);
  if (!game) return { error: 'Room not found' };
  if (game.status !== STATUS.WAITING) return { error: 'Game already in progress' };

  const updated = addPlayer(game, playerId, playerName);
  if (updated.error) return { error: updated.error };

  rooms.set(roomCode, updated);
  touchRoom(roomCode);
  persistence.saveRoom(roomCode, updated);
  return { game: updated };
}

function leaveRoom(roomCode, playerId) {
  const game = rooms.get(roomCode);
  if (!game) return { error: 'Room not found' };

  const updated = removePlayer(game, playerId);
  if (updated.error) return { error: updated.error };

  if (updated.players.length === 0) {
    rooms.delete(roomCode);
    persistence.deleteRoom(roomCode);
    return { deleted: true };
  }

  rooms.set(roomCode, updated);
  persistence.saveRoom(roomCode, updated);
  return { game: updated };
}

function getRoom(roomCode) {
  return rooms.get(roomCode) || null;
}

/** Host cancels the game — deletes the room entirely. */
function cancelGame(roomCode, requestingPlayerId) {
  const game = rooms.get(roomCode);
  if (!game) return { error: 'Room not found' };
  if (game.players[0]?.id !== requestingPlayerId) return { error: 'Only the host can cancel the game' };
  rooms.delete(roomCode);
  persistence.deleteRoom(roomCode);
  return { ok: true };
}

// ─── Game actions — each returns { game } or { error } ───────────────────────

function _action(roomCode, fn) {
  const game = rooms.get(roomCode);
  if (!game) return { error: 'Room not found' };
  const updated = fn(game);
  if (updated.error) return { error: updated.error };
  rooms.set(roomCode, updated);
  touchRoom(roomCode);
  persistence.saveRoom(roomCode, updated); // fire-and-forget
  return { game: updated };
}

function start(roomCode)            { return _action(roomCode, g => startGame(g)); }
function beginNextRound(roomCode)   { return _action(roomCode, g => nextRound(g)); }

function playerDrawFromPile(roomCode, playerId) {
  return _action(roomCode, g => drawFromPile(g, playerId));
}
function playerDrawFromDiscard(roomCode, playerId) {
  return _action(roomCode, g => drawFromDiscard(g, playerId));
}
function playerLayDownSet(roomCode, playerId, cardIds, beanieOverrides = {}) {
  return _action(roomCode, g => layDownSet(g, playerId, cardIds, beanieOverrides));
}
function playerAddCardsToSet(roomCode, playerId, setIndex, cardIds) {
  return _action(roomCode, g => addCardsToSet(g, playerId, setIndex, cardIds));
}
function playerAddBeanieToSet(roomCode, playerId, setIndex, beanieCardId, rankOverride = null) {
  return _action(roomCode, g => addBeanieToSet(g, playerId, setIndex, beanieCardId, rankOverride));
}
function playerStealBeanie(roomCode, playerId, setIndex, replacementCardId, beanieCardId = null) {
  return _action(roomCode, g => stealBeanie(g, playerId, setIndex, replacementCardId, beanieCardId));
}
function playerDiscard(roomCode, playerId, cardId) {
  return _action(roomCode, g => discard(g, playerId, cardId));
}

function playerDeclareDraw(roomCode, playerId) {
  return _action(roomCode, g => declareDraw(g, playerId));
}

function pauseRoom(roomCode, playerId) {
  return _action(roomCode, g => pauseGame(g, playerId));
}

function resumeRoom(roomCode, playerId) {
  return _action(roomCode, g => resumeGame(g, playerId));
}

/** Force-delete a room (used for lobby expiry). No permission check. */
function forceDeleteRoom(roomCode) {
  rooms.delete(roomCode);
  roomActivity.delete(roomCode);
  persistence.deleteRoom(roomCode);
}

module.exports = {
  initRooms,
  createRoom, joinRoom, leaveRoom, getRoom, cancelGame,
  start, beginNextRound,
  playerDrawFromPile, playerDrawFromDiscard,
  playerLayDownSet, playerAddCardsToSet, playerAddBeanieToSet,
  playerStealBeanie, playerDiscard, playerDeclareDraw,
  pauseRoom, resumeRoom,
  forceDeleteRoom,
};
