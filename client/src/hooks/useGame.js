// useGame.js — Central game state + socket event wiring
//
// Exposes:
//   state        — { screen, roomCode, myId, game, error, timer, notice }
//   actions      — all game and room actions as simple functions

import { useEffect, useReducer, useCallback, useRef } from 'react';
import socket from '../socket';

// ─── Session persistence ──────────────────────────────────────────────────────
// Stores { roomCode, playerId } in localStorage so we can rejoin after a
// server restart. Cleared when the player leaves or the game is cancelled.

const SESSION_KEY     = 'beanie_session';
const PLAYER_NAME_KEY = 'beanie_player_name';

function loadPlayerName() {
  try { return localStorage.getItem(PLAYER_NAME_KEY) || ''; }
  catch { return ''; }
}

function savePlayerName(name) {
  try { localStorage.setItem(PLAYER_NAME_KEY, name); }
  catch {}
}

// Read ?join=XXXX from URL and immediately clean the URL so it doesn't persist
function getInviteCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code && /^[A-Z0-9]{4}$/i.test(code)) {
      window.history.replaceState({}, '', window.location.pathname);
      return code.toUpperCase();
    }
  } catch {}
  return null;
}

// Module-level: tracks last game status so we can detect missed broadcasts
let _lastKnownStatus = null;

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
  screen:        'home',  // name | home | create | join | lobby | game | round-end | game-end
  playerName:    '',
  inviteCode:    null,    // set from ?join=XXXX URL param; cleared once used
  connected:     false,
  everConnected: false,
  gameCancelled:     false,  // true when host ended game — shows "host ended" modal for other players
  roomExpired:       false,  // true when lobby 15-min expiry fires
  roomExpiredAsHost: false,  // true if the expired player was the host (different modal copy)
  roomCode:      null,
  myId:          null,    // player's persistent ID within the game (may differ from socket.id after reconnect)
  game:          null,
  error:         null,
  timer:         null,    // { seconds, playerName }
  notice:        null,    // transient notification (disconnect, timer expired, etc.)
};

function reducer(state, action) {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, myId: action.id, connected: true, everConnected: true };
    case 'DISCONNECTED':
      return { ...state, connected: false };
    case 'SET_SCREEN':
      return { ...state, prevScreen: state.screen, screen: action.screen, error: null };
    case 'ROOM_CREATED':
      return { ...state, screen: 'lobby', roomCode: action.roomCode };
    case 'ROOM_JOINED':
      return { ...state, screen: 'lobby', roomCode: action.roomCode, inviteCode: null };
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
    case 'SET_NAME':
      return { ...state, playerName: action.name, screen: state.inviteCode ? 'join' : 'home' };
    case 'GAME_CANCELLED':
      return { ...INITIAL, playerName: state.playerName, myId: state.myId, gameCancelled: true };
    case 'ROOM_EXPIRED':
      return { ...INITIAL, playerName: state.playerName, myId: state.myId, roomExpired: true, roomExpiredAsHost: action.isHost || false };
    case 'RESET':
      return { ...INITIAL, playerName: state.playerName, myId: state.myId };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGame() {
  const storedName   = loadPlayerName();
  const inviteCode   = getInviteCode();
  const selfExiting  = useRef(false); // true when this player triggered exitGame
  const stateRef     = useRef(null);  // always points to latest state for use inside socket closures
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL,
    playerName: storedName,
    inviteCode,
    screen: storedName
      ? (inviteCode ? 'join' : 'home')
      : 'name',
  });

  // Keep stateRef always pointing to the latest state (used in stale socket closures)
  stateRef.current = state;

  // ─── Socket connection & event listeners ──────────────────────────────────

  useEffect(() => {
    socket.connect();

    socket.on('disconnect', () => dispatch({ type: 'DISCONNECTED' }));

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
      _lastKnownStatus = game.status || null;
      dispatch({ type: 'GAME_STATE', game });
    });

    // Public state is broadcast to the whole room after every action.
    // If the status has changed but we haven't received our private game:state,
    // we missed a broadcast — trigger a rejoin to auto-sync.
    socket.on('game:state:public', publicGame => {
      if (!publicGame?.status || !_lastKnownStatus) return;
      if (publicGame.status !== _lastKnownStatus) {
        const session = loadSession();
        if (session?.roomCode && session?.playerId) {
          socket.emit('room:rejoin', { roomCode: session.roomCode, playerId: session.playerId });
        }
      }
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

    socket.on('game:draw-vote', ({ playerName, voted }) =>
      dispatch({ type: 'NOTICE', message: voted
        ? `${playerName} voted to end the round`
        : `${playerName} cancelled their End Round vote` }));

    socket.on('game:cancelled', () => {
      clearSession();
      if (selfExiting.current) {
        // This player triggered the exit — reset straight to home
        selfExiting.current = false;
        dispatch({ type: 'RESET' });
      } else {
        // Someone else (the host) ended the game — show the cancelled modal
        dispatch({ type: 'GAME_CANCELLED' });
      }
    });

    // Server sends this when room:rejoin finds no room (e.g. host left while we were away)
    socket.on('room:session-expired', () => {
      clearSession();
    });

    // Lobby 15-min expiry — both host and non-host see a modal, but different copy
    socket.on('room:expired', () => {
      const s = stateRef.current;
      const isHost = s.myId && s.game?.players?.[0]?.id === s.myId;
      clearSession();
      dispatch({ type: 'ROOM_EXPIRED', isHost });
    });

    return () => socket.removeAllListeners();
  }, []);

  // ─── Timer tick ───────────────────────────────────────────────────────────
  // Stop ticking while game is paused (server has already cleared its timer).

  useEffect(() => {
    if (!state.timer || state.game?.isPaused) return;
    const interval = setInterval(() => dispatch({ type: 'TIMER_TICK' }), 1000);
    return () => clearInterval(interval);
  }, [state.timer, state.game?.isPaused]);

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

    saveName: useCallback(name => {
      savePlayerName(name);
      dispatch({ type: 'SET_NAME', name });
    }, []),

    createRoom:  useCallback((config = {}) => {
      const playerName = loadPlayerName() || 'Player';
      socket.emit('room:create', { playerName, config });
    }, []),

    joinRoom:    useCallback(roomCode => {
      const playerName = loadPlayerName() || 'Player';
      socket.emit('room:join', { roomCode, playerName });
    }, []),

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

    addBeanieToSet: useCallback((setIndex, beanieCardId, rankOverride = null) =>
      socket.emit('game:add-beanie-to-set', { setIndex, beanieCardId, rankOverride }), []),

    stealBeanie: useCallback((setIndex, replacementCardId, beanieCardId = null) =>
      socket.emit('game:steal-beanie', { setIndex, replacementCardId, beanieCardId }), []),

    discard:     useCallback(cardId =>
      socket.emit('game:discard', { cardId }), []),

    declareDraw: useCallback(() =>
      socket.emit('game:declare-draw'), []),

    nextRound:   useCallback(() =>
      socket.emit('game:next-round'), []),

    exitGame:    useCallback(() => {
      selfExiting.current = true;
      clearSession();
      socket.emit('game:exit');
    }, []),

    pauseGame:   useCallback(() => socket.emit('game:pause'),  []),
    resumeGame:  useCallback(() => socket.emit('game:resume'), []),

    dismissCancelled: useCallback(() => dispatch({ type: 'RESET' }), []),
    dismissExpired:   useCallback(() => dispatch({ type: 'RESET' }), []),
  };

  // Convenience helpers derived from state
  const myPlayer = state.game?.players.find(p => p.id === state.myId) || null;
  const isMyTurn = state.game
    ? state.game.players[state.game.currentPlayerIndex]?.id === state.myId
    : false;

  return { state, actions, myPlayer, isMyTurn };
}
