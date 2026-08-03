// persistence.js — Upstash Redis game-state persistence
//
// Saves every room to Redis after each mutation so games survive server restarts.
// Uses @upstash/redis (REST-based — no TCP connection required, works on Railway).
//
// Gracefully degrades to a no-op when the env vars are missing, so the server
// runs fine without Redis in local development.
//
// Env vars required (add to Railway service variables):
//   UPSTASH_REDIS_REST_URL    — e.g. https://xxxxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN  — from Upstash console

let _redis = null;

function getRedis() {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Warn once, then stay silent
    if (!getRedis._warned) {
      console.warn('[persistence] UPSTASH_REDIS_REST_URL / TOKEN not set — running without persistence');
      getRedis._warned = true;
    }
    return null;
  }
  try {
    const { Redis } = require('@upstash/redis');
    _redis = new Redis({ url, token });
    console.log('[persistence] Upstash Redis connected');
    return _redis;
  } catch (e) {
    console.error('[persistence] Failed to init Redis (is @upstash/redis installed?):', e.message);
    return null;
  }
}

const PREFIX    = 'beanie:room:';
const INDEX_KEY = 'beanie:rooms';  // a Redis SET of active room codes
const TTL_S     = 60 * 60 * 24;   // rooms expire after 24 h of inactivity

/** Persist a single room. Fire-and-forget — errors are logged but not thrown. */
async function saveRoom(roomCode, game) {
  const r = getRedis();
  if (!r) return;
  try {
    // @upstash/redis serialises plain objects automatically
    await r.set(`${PREFIX}${roomCode}`, game, { ex: TTL_S });
    await r.sadd(INDEX_KEY, roomCode);
  } catch (e) {
    console.error('[persistence] saveRoom:', e.message);
  }
}

/** Remove a room from Redis when it's deleted. */
async function deleteRoom(roomCode) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(`${PREFIX}${roomCode}`);
    await r.srem(INDEX_KEY, roomCode);
  } catch (e) {
    console.error('[persistence] deleteRoom:', e.message);
  }
}

/**
 * Load all persisted rooms on server startup.
 * Returns a plain object { roomCode: gameState }.
 */
async function loadAllRooms() {
  const r = getRedis();
  if (!r) return {};
  try {
    const codes = await r.smembers(INDEX_KEY);
    if (!codes || codes.length === 0) return {};

    const entries = await Promise.all(
      codes.map(async code => {
        const game = await r.get(`${PREFIX}${code}`);
        return game ? [code, game] : null;
      })
    );
    return Object.fromEntries(entries.filter(Boolean));
  } catch (e) {
    console.error('[persistence] loadAllRooms:', e.message);
    return {};
  }
}

module.exports = { saveRoom, deleteRoom, loadAllRooms };
