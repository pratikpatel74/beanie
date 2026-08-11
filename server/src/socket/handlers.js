// handlers.js — Socket.io event handlers
//
// Every client event follows the same pattern:
//   1. Execute the action via roomManager
//   2. If error → emit 'game:error' back to the sender only
//   3. If success → broadcast 'game:state' to everyone in the room
//      (state is sanitised — each player only sees their own hand)
//
// Reconnect strategy
// ──────────────────
// Each browser generates a persistent clientId (stored in localStorage) and
// sends it as socket.handshake.auth.clientId on every connection.
//
// Module-level maps track the relationship between clientId, the player's
// stable game-identity (playerId = their original socket.id), and the current
// live socket. When a player disconnects mid-game:
//   • their seat is held for RECONNECT_GRACE_MS (60 s)
//   • if they reconnect in time, the new socket is mapped to their old playerId
//     and they receive game:state as if nothing happened
//   • if the grace period expires, the disconnect is surfaced to other players
//
// Server-restart recovery is handled separately via room:rejoin (sent by the
// client on every connect using its localStorage session data).

const rm = require('../rooms/roomManager');
const { startTimer, clearTimer, DEFAULT_DURATION_MS } = require('./timers');
const { PHASE, STATUS, LOBBY_EXPIRY_MS } = require('../game/engine');

const TURN_DURATION_MS     = DEFAULT_DURATION_MS;
const RECONNECT_GRACE_MS   = 60 * 1000; // 60 seconds

// ─── Module-level session maps ────────────────────────────────────────────────
// These survive across individual socket connections.

// clientId → { roomCode, playerId, socketId }
const clientToSession = new Map();

// playerId (original, stable game identity) → current live socket
const playerToSocket = new Map();

// clientId → setTimeout handle (grace period timers)
const disconnectedTimers = new Map();

// roomCode → setTimeout handle (lobby expiry timers)
const lobbyExpiryTimers = new Map();

// ─────────────────────────────────────────────────────────────────────────────

module.exports = function registerHandlers(io, socket) {
  const clientId = socket.handshake.auth?.clientId;

  // Determine this socket's room + player identity.
  // For returning clients: restore from session map.
  // For new clients:       playerId = socket.id (first connection).
  let currentRoom     = null;
  let currentPlayerId = socket.id; // default for new connections

  if (clientId && clientToSession.has(clientId)) {
    const session    = clientToSession.get(clientId);
    currentRoom      = session.roomCode;
    currentPlayerId  = session.playerId;
    session.socketId = socket.id;
    clientToSession.set(clientId, session);
    playerToSocket.set(currentPlayerId, socket);

    // Clear any pending grace-period timer
    if (disconnectedTimers.has(clientId)) {
      clearTimeout(disconnectedTimers.get(clientId));
      disconnectedTimers.delete(clientId);
      console.log(`[reconnect] ${clientId.slice(0, 8)}… re-attached as ${currentPlayerId} in ${currentRoom}`);
    }
  } else {
    // Fresh connection — register socket under its own id
    if (clientId) playerToSocket.set(currentPlayerId, socket);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  function sendError(msg) {
    socket.emit('game:error', { message: msg });
  }

  /** Broadcast sanitised game state to every player's current live socket. */
  function broadcast(roomCode, game) {
    if (!game) return;
    game.players.forEach(player => {
      const target = playerToSocket.get(player.id);
      if (target && target.connected) {
        // Include myPlayerId so the client knows which player it is
        // even after reconnect (when socket.id has changed)
        target.emit('game:state', { ...sanitise(game, player.id), myPlayerId: player.id });
      }
    });
    io.to(roomCode).emit('game:state:public', publicView(game));
  }

  /** ── Lobby expiry ────────────────────────────────────────────────────────
   * Starts (or re-starts after a server restart) the lobby expiry countdown.
   * Safe to call multiple times — no-ops if a timer already exists for the room.
   */
  function startLobbyExpiry(roomCode) {
    if (lobbyExpiryTimers.has(roomCode)) return; // already running
    const game = rm.getRoom(roomCode);
    if (!game || game.status !== STATUS.WAITING) return;

    const remaining = (game.lobbyExpiresAt || 0) - Date.now();
    if (remaining <= 0) {
      // Already expired — fire immediately
      _expireRoom(roomCode);
      return;
    }

    const handle = setTimeout(() => _expireRoom(roomCode), remaining);
    lobbyExpiryTimers.set(roomCode, handle);
  }

  function cancelLobbyExpiry(roomCode) {
    const handle = lobbyExpiryTimers.get(roomCode);
    if (handle) {
      clearTimeout(handle);
      lobbyExpiryTimers.delete(roomCode);
    }
  }

  function _expireRoom(roomCode) {
    lobbyExpiryTimers.delete(roomCode);
    const game = rm.getRoom(roomCode);
    if (!game || game.status !== STATUS.WAITING) return; // already started
    rm.forceDeleteRoom(roomCode);
    io.to(roomCode).emit('room:expired');
    console.log(`[lobby-expiry] Room ${roomCode} expired`);
  }

  /** Start (or restart) the turn timer for the current player. */
  function resetTimer(roomCode, game) {
    clearTimer(roomCode);
    if (game.status !== STATUS.PLAYING) return;

    const currentPlayer = game.players[game.currentPlayerIndex];

    startTimer(roomCode, TURN_DURATION_MS, () => {
      // Timer expired — force a discard (or draw+discard if still in draw phase)
      let g = rm.getRoom(roomCode);
      if (!g || g.status !== STATUS.PLAYING || g.isPaused) return;

      let cp = g.players[g.currentPlayerIndex];
      if (!cp) return;

      // If player is in DRAW phase, try to force-draw for them
      if (g.phase === PHASE.DRAW) {
        const drawn = rm.playerDrawFromPile(roomCode, cp.id);
        if (!drawn.error) {
          g = drawn.game;
        } else {
          // Race condition: player already drew (or pile empty after reshuffle attempt).
          // Re-read the live game state so we can attempt the forced discard.
          const fresh = rm.getRoom(roomCode);
          if (!fresh || fresh.status !== STATUS.PLAYING) return;
          g  = fresh;
          cp = g.players[g.currentPlayerIndex];
          if (!cp) return;
        }
      }

      // Force a discard if the current player is now in ACTION phase
      if (g.phase === PHASE.ACTION) {
        const cpHand = g.players.find(p => p.id === cp.id)?.hand || [];
        if (cpHand.length === 0) return;
        const forced = rm.playerDiscard(roomCode, cp.id, cpHand[0].id);
        if (!forced.error) {
          broadcast(roomCode, forced.game);
          resetTimer(roomCode, forced.game);
          io.to(roomCode).emit('game:timer-expired', { playerName: cp.name });
        }
      }
    });

    io.to(roomCode).emit('game:timer', {
      playerId:   currentPlayer.id,
      playerName: currentPlayer.name,
      seconds:    TURN_DURATION_MS / 1000,
    });
  }

  // ─── Room events ──────────────────────────────────────────────────────────

  socket.on('room:create', ({ playerName }) => {
    if (!playerName?.trim()) return sendError('Display name required');

    const { roomCode, game } = rm.createRoom(currentPlayerId, playerName.trim());
    currentRoom = roomCode;
    socket.join(roomCode);

    if (clientId) {
      clientToSession.set(clientId, { roomCode, playerId: currentPlayerId, socketId: socket.id });
    }
    playerToSocket.set(currentPlayerId, socket);

    socket.emit('room:created', { roomCode });
    broadcast(roomCode, game);
    startLobbyExpiry(roomCode);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!roomCode?.trim() || !playerName?.trim()) return sendError('Room code and name required');

    const code   = roomCode.toUpperCase().trim();
    const result = rm.joinRoom(code, currentPlayerId, playerName.trim());
    if (result.error) return sendError(result.error);

    currentRoom = code;
    socket.join(currentRoom);

    if (clientId) {
      clientToSession.set(clientId, { roomCode: currentRoom, playerId: currentPlayerId, socketId: socket.id });
    }
    playerToSocket.set(currentPlayerId, socket);

    socket.emit('room:joined', { roomCode: currentRoom });
    broadcast(currentRoom, result.game);
  });

  // ── Rejoin after server restart ────────────────────────────────────────────
  // Client emits room:rejoin on every connect, carrying its localStorage session.
  // The server only acts if the room exists and the player is in it (rooms are
  // restored from Redis on startup, so this handles the restart case).

  socket.on('room:rejoin', ({ roomCode, playerId }) => {
    if (!roomCode || !playerId) return;

    const code = roomCode.toUpperCase().trim();
    const room = rm.getRoom(code);
    if (!room) {
      // Room gone (e.g. host cancelled while player was away) — tell client to clear stale session
      socket.emit('room:session-expired');
      return;
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    // Don't double-join if already handled by the session map at connect time
    if (currentRoom === code && currentPlayerId === playerId) {
      // Already re-attached via session map — just make sure socket is in the room
      if (!socket.rooms.has(code)) socket.join(code);
      const screenHint = screenFor(room.status);
      socket.emit('room:rejoined', { roomCode: code, screen: screenHint });
      socket.emit('game:state', { ...sanitise(room, playerId), myPlayerId: playerId });
      return;
    }

    currentRoom     = code;
    currentPlayerId = playerId;
    socket.join(currentRoom);

    if (clientId) {
      clientToSession.set(clientId, { roomCode: currentRoom, playerId, socketId: socket.id });
    }
    playerToSocket.set(playerId, socket);

    const screenHint = screenFor(room.status);
    socket.emit('room:rejoined', { roomCode: currentRoom, screen: screenHint });
    socket.emit('game:state', { ...sanitise(room, playerId), myPlayerId: playerId });
    io.to(currentRoom).emit('game:player-reconnected', { playerId, playerName: player.name });

    // Restart lobby expiry timer if room is still in WAITING (e.g. after server restart)
    if (room.status === STATUS.WAITING) startLobbyExpiry(currentRoom);

    console.log(`[rejoin] ${player.name} rejoined ${currentRoom} (server restart path)`);
  });

  socket.on('room:leave', () => {
    if (!currentRoom) return;
    const result = rm.leaveRoom(currentRoom, currentPlayerId);
    socket.leave(currentRoom);

    if (!result.deleted) broadcast(currentRoom, result.game);
    socket.emit('room:left');

    if (clientId) clientToSession.delete(clientId);
    playerToSocket.delete(currentPlayerId);
    currentRoom = null;
  });

  // ─── Game events ──────────────────────────────────────────────────────────

  socket.on('game:start', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.start(currentRoom);
    if (result.error) return sendError(result.error);
    cancelLobbyExpiry(currentRoom);
    broadcast(currentRoom, result.game);
    resetTimer(currentRoom, result.game);
  });

  /** Guard helper — rejects action if game is paused */
  function rejectIfPaused() {
    const g = rm.getRoom(currentRoom);
    if (g?.isPaused) { sendError('Game is paused'); return true; }
    return false;
  }

  socket.on('game:draw-pile', () => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerDrawFromPile(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
  });

  socket.on('game:draw-discard', () => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerDrawFromDiscard(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
  });

  socket.on('game:lay-set', ({ cardIds, beanieOverrides = {} }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    if (!Array.isArray(cardIds) || cardIds.length < 3) return sendError('Select at least 3 cards');
    const result = rm.playerLayDownSet(currentRoom, currentPlayerId, cardIds, beanieOverrides);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:add-to-set', ({ setIndex, cardIds }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerAddCardsToSet(currentRoom, currentPlayerId, setIndex, cardIds);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:add-beanie-to-set', ({ setIndex, beanieCardId, rankOverride = null }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerAddBeanieToSet(currentRoom, currentPlayerId, setIndex, beanieCardId, rankOverride);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:steal-beanie', ({ setIndex, replacementCardId, beanieCardId = null }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerStealBeanie(currentRoom, currentPlayerId, setIndex, replacementCardId, beanieCardId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:discard', ({ cardId }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerDiscard(currentRoom, currentPlayerId, cardId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status === STATUS.PLAYING) {
      resetTimer(currentRoom, result.game);
    } else {
      clearTimer(currentRoom);
    }
  });

  socket.on('game:next-round', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.beginNextRound(currentRoom);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    resetTimer(currentRoom, result.game);
  });

  socket.on('game:declare-draw', () => {
    if (!currentRoom) return sendError('Not in a room');
    if (rejectIfPaused()) return;
    const result = rm.playerDeclareDraw(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
    // Notify all players whether this was a vote or a cancellation
    const voted = (result.game.drawVotes || []).includes(currentPlayerId);
    const playerName = result.game.players.find(p => p.id === currentPlayerId)?.name;
    if (playerName) {
      io.to(currentRoom).emit('game:draw-vote', { playerName, voted });
    }
  });

  socket.on('game:pause', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.pauseRoom(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    clearTimer(currentRoom);
    broadcast(currentRoom, result.game);
  });

  socket.on('game:resume', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.resumeRoom(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    resetTimer(currentRoom, result.game);
  });

  socket.on('game:exit', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.cancelGame(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    clearTimer(currentRoom);
    io.to(currentRoom).emit('game:cancelled');
    if (clientId) clientToSession.delete(clientId);
    playerToSocket.delete(currentPlayerId);
    currentRoom = null;
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    if (!currentRoom) {
      playerToSocket.delete(currentPlayerId);
      return;
    }

    const game = rm.getRoom(currentRoom);
    if (!game) {
      if (clientId) clientToSession.delete(clientId);
      playerToSocket.delete(currentPlayerId);
      return;
    }

    if (game.status === STATUS.WAITING) {
      // Lobby disconnect — remove player immediately (no grace period needed)
      const result = rm.leaveRoom(currentRoom, currentPlayerId);
      if (!result.deleted) broadcast(currentRoom, result.game);
      if (clientId) clientToSession.delete(clientId);
      playerToSocket.delete(currentPlayerId);
    } else {
      // Mid-game disconnect — hold seat for RECONNECT_GRACE_MS
      const playerName = game.players.find(p => p.id === currentPlayerId)?.name;

      io.to(currentRoom).emit('game:player-disconnected', {
        playerId:   currentPlayerId,
        playerName,
      });

      // Remove live socket reference but keep session so reconnect can find it
      playerToSocket.delete(currentPlayerId);

      if (clientId) {
        const gracedRoom = currentRoom;
        const gracedId   = currentPlayerId;
        const timer = setTimeout(() => {
          disconnectedTimers.delete(clientId);
          clientToSession.delete(clientId);
          console.log(`[grace] ${playerName} grace period expired — ${gracedRoom}`);
          // Notify other players that this player has now truly left
          io.to(gracedRoom).emit('game:player-left', { playerId: gracedId, playerName });
        }, RECONNECT_GRACE_MS);
        disconnectedTimers.set(clientId, timer);
      }
    }
  });
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function screenFor(status) {
  if (status === 'PLAYING')   return 'game';
  if (status === 'ROUND_END') return 'round-end';
  if (status === 'GAME_END')  return 'game-end';
  return 'lobby';
}

// ─── State sanitisation ───────────────────────────────────────────────────────

/**
 * Each player receives their own hand in full but sees other players'
 * hand only as a count. Public sets, draw pile size, and discard top are
 * visible to all.
 *
 * myPlayerId is injected by broadcast() so the client always knows its
 * stable game identity, even after a reconnect where socket.id changed.
 */
function sanitise(game, viewingPlayerId) {
  return {
    roomCode:            game.roomCode,
    status:              game.status,
    round:               game.round,
    beanieRank:          game.beanieRank,
    currentPlayerIndex:  game.currentPlayerIndex,
    firstPlayerIndex:    game.firstPlayerIndex,
    phase:               game.phase,
    roundWinner:         game.roundWinner,
    roundFirstTurnDone:  game.roundFirstTurnDone,
    publicSets:          game.publicSets,
    drawPileCount:       game.drawPile.length,
    discardTop:          game.discardPile[game.discardPile.length - 1] || null,
    drawVotes:           game.drawVotes || [],
    isPaused:            game.isPaused || false,
    lobbyExpiresAt:      game.lobbyExpiresAt || null,
    players: game.players.map(p => ({
      id:           p.id,
      name:         p.name,
      hasLaidSet:   p.hasLaidSet,
      firstTurnDone: p.firstTurnDone || false,
      totalScore:   p.totalScore,
      roundScores:  p.roundScores,
      handCount:    p.hand.length,
      hand: p.id === viewingPlayerId ? p.hand : [],
    })),
  };
}

function publicView(game) {
  return sanitise(game, null);
}
