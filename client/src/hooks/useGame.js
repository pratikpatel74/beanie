// useGame.js — Central game state + socket event wiring
//
// Exposes:
//   state        — { screen, roomCode, myId, game, error, timer, notice }
//   actions      — all game and room actions as simple functions

import { useEffect, useReducer, useCallback } from 'react';
import socket from '../socket';

// ─── Session persistence ──────────────────────────────────────────────────────
// Stores { roomCode, playerId } in localStorage so we can rejoin after a
// server restart. Cleared when the player leaves or the game is cancelled.

const SESSION_KEY = 'beanie_session';

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

function saveSession(roomCode, playerId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode, playerId }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

const INITIAL = {
  screen:   'home',   // home | create | join | lobby | game | round-end | game-end
  roomCode: null,
  myId:     null,     // player's persistent ID within the game (may differ from socket.id after reconnect)
  game:     null,
  error:    null,
  timer:    null,     // { seconds, playerName }
  notice:   null,     // transient notification (disconnect, timer expired, etc.)
};

function reducer(state, action) {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, myId: action.id };
    case 'SET_SCREEN':
      return { ...state, screen: action.screen, error: null };
    case 'ROOM_CREATED':
      return { ...state, screen: 'lobby', roomCode: action.roomCode };
    case 'ROOM_JOINED':
      return { ...state, screen: 'lobby', roomCode: action.roomCode };
    case 'ROOM_REJOINED':
      return { ...state, roomCode: action.roomCode, screen: action.screen || 'lobby' };
    case 'GAME_STATE': {
      const g = action.game;
      let screen = state.screen;
      if (g.status === 'WAITING')    screen = 'lobby';
      if (g.status === 'PLAYING')    screen = 'game';
      if (g.status === 'ROUND_END')  screen = 'round-end';
      if (g.status === 'GAME_END')   screen = 'game-end';
      // Server tells us our player ID — handles reconnect where socket.id changed
      const myId = g.myPlayerId || state.myId;
      return { ...state, game: g, screen, myId, error: null };
    }
    case 'ERROR':
      return { ...state, error: action.message };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'TIMER':
      return { ...state, timer: { seconds: action.seconds, playerName: action.playerName } };
    case 'TIMER_TICK':
      if (!state.timer) return state;
      return { ...state, timer: { ...state.timer, seconds: Math.max(0, state.timer.seconds - 1) } };
    case 'TIMER_CLEAR':
      return { ...state, timer: null };
    case 'NOTICE':
      return { ...state, notice: action.message };
    case 'CLEAR_NOTICE':
      return { ...state, notice: null };
    case 'RESET':
      return { ...INITIAL, myId: state.myId };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGame() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // ─── Socket connection & event listeners ──────────────────────────────────

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      dispatch({ type: 'CONNECTED', id: socket.id });
      // On every connect (first load or reconnect), attempt to rejoin the last session.
      // The server will only act on this if the room still exists.
      const session = loadSession();
      if (session?.roomCode && session?.playerId) {
        socket.emit('room:rejoin', { roomCode: session.roomCode, playerId: session.playerId });
      }
    });

    socket.on('room:created', ({ roomCode }) =>
      dispatch({ type: 'ROOM_CREATED', roomCode }));

    socket.on('room:joined', ({ roomCode }) =>
      dispatch({ type: 'ROOM_JOINED', roomCode }));

    // Sent by server when a room:rejoin succeeds (restores screen without re-render flicker)
    socket.on('room:rejoined', ({ roomCode, screen }) =>
      dispatch({ type: 'ROOM_REJOINED', roomCode, screen }));

    socket.on('room:left', () => {
      clearSession();
      dispatch({ type: 'RESET' });
    });

    socket.on('game:state', game => {
      // Persist session so we can rejoin after a server restart
      if (game.myPlayerId && game.roomCode) {
        saveSession(game.roomCode, game.myPlayerId);
      }
      dispatch({ type: 'GAME_STATE', game });
    });

    socket.on('game:error', ({ message }) =>
      dispatch({ type: 'ERROR', message }));

    socket.on('game:timer', ({ playerName, seconds }) =>
      dispatch({ type: 'TIMER', playerName, seconds }));

    socket.on('game:timer-expired', ({ playerName }) =>
      dispatch({ type: 'NOTICE', message: `${playerName}'s turn timed out` }));

    socket.on('game:player-disconnected', ({ playerName }) =>
      dispatch({ type: 'NOTICE', message: `${playerName} disconnected` }));

    socket.on('game:player-reconnected', ({ playerName }) =>
      dispatch({ type: 'NOTICE', message: `${playerName} reconnected` }));

    socket.on('game:player-left', ({ playerName }) =>
      dispatch({ type: 'NOTICE', message: `${playerName} left the game` }));

    socket.on('game:cancelled', () => {
      clearSession();
      dispatch({ type: 'RESET' });
    });

    // Server sends this when room:rejoin finds no room (e.g. host left while we were away)
    socket.on('room:session-expired', () => {
      clearSession();
    });

    return () => socket.removeAllListeners();
  }, []);

  // ─── Timer tick ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!state.timer) return;
    const interval = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.timer]);

  // Auto-clear notices after 3s
  useEffect(() => {
    if (!state.notice) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_NOTICE' }), 3000);
    return () => clearTimeout(t);
  }, [state.notice]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const actions = {
    goTo:        useCallback(screen => dispatch({ type: 'SET_SCREEN', screen }), []),
    clearError:  useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []),

    createRoom:  useCallback(playerName =>
      socket.emit('room:create', { playerName }), []),

    joinRoom:    useCallback((roomCode, playerName) =>
      socket.emit('room:join', { roomCode, playerName }), []),

    leaveRoom:   useCallback(() => {
      clearSession();
      socket.emit('room:leave');
    }, []),

    startGame:   useCallback(() =>
      socket.emit('game:start'), []),

    drawFromPile:    useCallback(() => socket.emit('game:draw-pile'),    []),
    drawFromDiscard: useCallback(() => socket.emit('game:draw-discard'), []),

    layDownSet:  useCallback((cardIds, beanieOverrides = {}) =>
      socket.emit('game:lay-set', { cardIds, beanieOverrides }), []),

    addToSet:    useCallback((setIndex, cardIds) =>
      socket.emit('game:add-to-set', { setIndex, cardIds }), []),

    addBeanieToSet: useCallback((setIndex, beanieCardId) =>
      socket.emit('game:add-beanie-to-set', { setIndex, beanieCardId }), []),

    stealBeanie: useCallback((setIndex, replacementCardId, beanieCardId = null) =>
      socket.emit('game:steal-beanie', { setIndex, replacementCardId, beanieCardId }), []),

    discard:     useCallback(cardId =>
      socket.emit('game:discard', { cardId }), []),

    nextRound:   useCallback(() =>
      socket.emit('game:next-round'), []),

    exitGame:    useCallback(() => {
      clearSession();
      socket.emit('game:exit');
    }, []),
  };

  // Convenience helpers derived from state
  const myPlayer = state.game?.players.find(p => p.id === state.myId) || null;
  const isMyTurn = state.game
    ? state.game.players[state.game.currentPlayerIndex]?.id === state.myId
    : false;

  return { state, actions, myPlayer, isMyTurn };
}
