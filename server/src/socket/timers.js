// timers.js — Turn timer management
//
// Each room gets one active timer. When it expires, the current player
// is automatically forced to discard their most recently drawn card
// (or a random card if somehow in ACTION phase without drawing).
// The Socket.io handler passes in a callback to execute the forced move.

const timers = new Map(); // roomCode → { timeout, endsAt }

const DEFAULT_DURATION_MS = 60_000; // 60 seconds default

function startTimer(roomCode, durationMs, onExpire) {
  clearTimer(roomCode); // cancel any existing timer

  const endsAt = Date.now() + durationMs;
  const timeout = setTimeout(() => {
    timers.delete(roomCode);
    onExpire();
  }, durationMs);

  timers.set(roomCode, { timeout, endsAt });
}

function clearTimer(roomCode) {
  const entry = timers.get(roomCode);
  if (entry) {
    clearTimeout(entry.timeout);
    timers.delete(roomCode);
  }
}

function getTimeRemaining(roomCode) {
  const entry = timers.get(roomCode);
  if (!entry) return 0;
  return Math.max(0, Math.ceil((entry.endsAt - Date.now()) / 1000)); // seconds
}

module.exports = { startTimer, clearTimer, getTimeRemaining, DEFAULT_DURATION_MS };
