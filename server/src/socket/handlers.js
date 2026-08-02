// handlers.js — Socket.io event handlers
//
// Every client event follows the same pattern:
//   1. Execute the action via roomManager
//   2. If error → emit 'error' back to the sender only
//   3. If success → broadcast 'game:state' to everyone in the room
//      (state is sanitised — each player only sees their own hand)
//
// Client events:   room:create, room:join, room:leave, game:start,
//                  game:draw-pile, game:draw-discard, game:lay-set,
//                  game:add-to-set, game:steal-beanie, game:discard,
//                  game:next-round
//
// Server events:   game:state, game:error, room:joined, room:left,
//                  room:created, game:timer

const rm = require('../rooms/roomManager');
const { startTimer, clearTimer, getTimeRemaining, DEFAULT_DURATION_MS } = require('./timers');
const { PHASE, STATUS } = require('../game/engine');

// How long each turn lasts. Can be configured per-room in future.
const TURN_DURATION_MS = DEFAULT_DURATION_MS;

module.exports = function registerHandlers(io, socket) {
  // Track which room this socket is in and the player's id
  let currentRoom = null;
  let currentPlayerId = socket.id; // use socket id as player id

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function sendError(msg) {
    socket.emit('game:error', { message: msg });
  }

  /** Broadcast sanitised game state to everyone in the room. */
  function broadcast(roomCode, game) {
    if (!game) return;
    game.players.forEach(player => {
      // Find the socket belonging to this player
      const targetSocket = io.sockets.sockets.get(player.id);
      if (targetSocket) {
        targetSocket.emit('game:state', sanitise(game, player.id));
      }
    });
    // Also send the public view to any spectators (same room, not a player)
    socket.to(roomCode).emit('game:state:public', publicView(game));
  }

  /** Start (or restart) the turn timer for the current player. */
  function resetTimer(roomCode, game) {
    clearTimer(roomCode);
    if (game.status !== STATUS.PLAYING) return;

    const currentPlayer = game.players[game.currentPlayerIndex];

    startTimer(roomCode, TURN_DURATION_MS, () => {
      // Timer expired — force a discard or draw+discard
      let g = rm.getRoom(roomCode);
      if (!g || g.status !== STATUS.PLAYING) return;

      const cp = g.players[g.currentPlayerIndex];
      if (!cp) return;

      // If still in DRAW phase, draw from pile first
      if (g.phase === PHASE.DRAW && g.drawPile.length > 0) {
        const drawn = rm.playerDrawFromPile(roomCode, cp.id);
        if (!drawn.error) g = drawn.game;
      }

      // Discard the first card in hand
      if (g.phase === PHASE.ACTION && cp.hand.length > 0) {
        const forced = rm.playerDiscard(roomCode, cp.id, g.players.find(p => p.id === cp.id).hand[0].id);
        if (!forced.error) {
          broadcast(roomCode, forced.game);
          resetTimer(roomCode, forced.game);
          io.to(roomCode).emit('game:timer-expired', { playerName: cp.name });
        }
      }
    });

    // Broadcast timer start so clients can show countdown
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

    socket.emit('room:created', { roomCode });
    broadcast(roomCode, game);
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!roomCode?.trim() || !playerName?.trim()) return sendError('Room code and name required');

    const result = rm.joinRoom(roomCode.toUpperCase().trim(), currentPlayerId, playerName.trim());
    if (result.error) return sendError(result.error);

    currentRoom = roomCode.toUpperCase().trim();
    socket.join(currentRoom);

    socket.emit('room:joined', { roomCode: currentRoom });
    broadcast(currentRoom, result.game);
  });

  socket.on('room:leave', () => {
    if (!currentRoom) return;
    const result = rm.leaveRoom(currentRoom, currentPlayerId);
    socket.leave(currentRoom);

    if (!result.deleted) broadcast(currentRoom, result.game);
    socket.emit('room:left');
    currentRoom = null;
  });

  // ─── Game events ──────────────────────────────────────────────────────────

  socket.on('game:start', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.start(currentRoom);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    resetTimer(currentRoom, result.game);
  });

  socket.on('game:draw-pile', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.playerDrawFromPile(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
  });

  socket.on('game:draw-discard', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.playerDrawFromDiscard(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
  });

  socket.on('game:lay-set', ({ cardIds, beanieOverrides = {} }) => {
    if (!currentRoom) return sendError('Not in a room');
    if (!Array.isArray(cardIds) || cardIds.length < 3) return sendError('Select at least 3 cards');
    const result = rm.playerLayDownSet(currentRoom, currentPlayerId, cardIds, beanieOverrides);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:add-to-set', ({ setIndex, cardIds }) => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.playerAddCardsToSet(currentRoom, currentPlayerId, setIndex, cardIds);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:steal-beanie', ({ setIndex, replacementCardId, beanieCardId = null }) => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.playerStealBeanie(currentRoom, currentPlayerId, setIndex, replacementCardId, beanieCardId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status !== STATUS.PLAYING) clearTimer(currentRoom);
  });

  socket.on('game:discard', ({ cardId }) => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.playerDiscard(currentRoom, currentPlayerId, cardId);
    if (result.error) return sendError(result.error);
    broadcast(currentRoom, result.game);
    if (result.game.status === STATUS.PLAYING) {
      resetTimer(currentRoom, result.game); // start timer for next player
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

  socket.on('game:exit', () => {
    if (!currentRoom) return sendError('Not in a room');
    const result = rm.cancelGame(currentRoom, currentPlayerId);
    if (result.error) return sendError(result.error);
    clearTimer(currentRoom);
    // Notify all players in the room that the game was cancelled
    io.to(currentRoom).emit('game:cancelled');
    currentRoom = null;
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    if (!currentRoom) return;

    const game = rm.getRoom(currentRoom);
    if (!game) return;

    if (game.status === STATUS.WAITING) {
      // Remove from lobby cleanly
      const result = rm.leaveRoom(currentRoom, currentPlayerId);
      if (!result.deleted) broadcast(currentRoom, result.game);
    } else {
      // Mid-game disconnect: notify others, leave timer running
      // If it was their turn, the timer will force a move
      io.to(currentRoom).emit('game:player-disconnected', {
        playerId:   currentPlayerId,
        playerName: game.players.find(p => p.id === currentPlayerId)?.name,
      });
    }
  });
};

// ─── State sanitisation ───────────────────────────────────────────────────────

/**
 * Each player receives their own hand in full but sees other players'
 * hand only as a count. Public sets, draw pile size, and discard top are visible to all.
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
    players: game.players.map(p => ({
      id:          p.id,
      name:        p.name,
      hasLaidSet:  p.hasLaidSet,
      totalScore:  p.totalScore,
      roundScores: p.roundScores,
      handCount:   p.hand.length,
      // Only send actual cards to the player who owns them
      hand: p.id === viewingPlayerId ? p.hand : [],
    })),
  };
}

/** A view with no hand data — for spectators or future use. */
function publicView(game) {
  return sanitise(game, null);
}
