import './index.css';
import { useState, useEffect, useRef } from 'react';

// ─── Round-end audio (module-level so AudioContext persists) ──────────────────
let _appActx = null;
async function _appAudio() {
  if (!_appActx) _appActx = new (window.AudioContext || window.webkitAudioContext)();
  if (_appActx.state === 'suspended') await _appActx.resume();
  return _appActx;
}
function _isMuted() {
  try { return localStorage.getItem('beanie_muted') === 'true'; } catch { return false; }
}
async function playRoundFanfare() {
  if (_isMuted()) return;
  try {
    const ctx = await _appAudio(); const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.07 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.2);
    });
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain(); const t = now + 0.21;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.22 : 0.16, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 0.75);
    });
  } catch {}
}
async function playRoundDraw() {
  if (_isMuted()) return;
  try {
    const ctx = await _appAudio(); const now = ctx.currentTime;
    [523, 392].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.2, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.5);
    });
  } catch {}
}
import ErrorBoundary      from './components/ErrorBoundary';
import { useGame }        from './hooks/useGame';
import NameScreen        from './screens/NameScreen';
import HomeScreen        from './screens/HomeScreen';
import CreateScreen      from './screens/CreateScreen';
import JoinScreen        from './screens/JoinScreen';
import LobbyScreen       from './screens/LobbyScreen';
import GameScreen        from './screens/GameScreen';
import RoundEndScreen    from './screens/RoundEndScreen';
import GameEndScreen     from './screens/GameEndScreen';
import HowToPlayScreen   from './screens/HowToPlayScreen';

export default function App() {
  const { state, actions, myPlayer, isMyTurn } = useGame();
  const { screen, roomCode, myId, game, error, timer, notice } = state;

  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const prevScreenRef = useRef(null);

  useEffect(() => {
    const justArrived = screen === 'round-end' && prevScreenRef.current !== 'round-end';
    if (justArrived) {
      if (game?.roundWinner) {
        playRoundFanfare();
        setShowWinCelebration(myPlayer?.name === game.roundWinner);
      } else {
        playRoundDraw();
        setShowWinCelebration(false);
      }
    } else if (screen !== 'round-end') {
      setShowWinCelebration(false);
    }
    prevScreenRef.current = screen;
  }, [screen, game?.roundWinner, myPlayer?.name]);

  return (
    <ErrorBoundary>
    <div className="app">
      {/* Round Won celebration modal */}
      {showWinCelebration && (
        <div className="round-won-overlay" onClick={() => setShowWinCelebration(false)}>
          <div className="round-won-modal" onClick={e => e.stopPropagation()}>
            <div className="burst-ring" />
            <div className="burst-ring" />
            <div className="burst-ring" />
            <div className="rw-trophy">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/>
                <path d="M6 4H2v4a4 4 0 0 0 4 4"/>
                <path d="M18 4h4v4a4 4 0 0 1-4 4"/>
                <path d="M12 14v4"/>
                <path d="M8 22h8"/>
              </svg>
            </div>
            <div className="rw-badge">ROUND {game?.round} OF 13</div>
            <div className="rw-title">You won!</div>
            <div className="rw-sub">{myPlayer?.name} scored 0 points this round</div>
            <button className="rw-btn" onClick={() => setShowWinCelebration(false)}>
              See the scores
            </button>
          </div>
        </div>
      )}

      {/* Lobby expired modal — shown to all players when 15-min room expiry fires */}
      {state.roomExpired && (
        <div className="reconnect-overlay">
          <div className="exit-modal">
            <div className="exit-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="exit-modal-title">Room expired</div>
            <div className="exit-modal-body">
              This room has been open for 15 minutes without starting.<br/>
              {state.roomExpiredAsHost
                ? 'Create a new room to play!'
                : 'Ask the host to create a new room to play!'}
            </div>
            <div className="exit-modal-actions">
              <button className="exit-modal-confirm" style={{ background: 'var(--acc)' }} onClick={actions.dismissExpired}>
                Back to home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host cancelled modal — shown to non-host players when game is ended */}
      {state.gameCancelled && (
        <div className="reconnect-overlay">
          <div className="exit-modal">
            <div className="exit-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div className="exit-modal-title">Game ended</div>
            <div className="exit-modal-body">
              The host has ended the game.<br/>Thanks for playing!
            </div>
            <div className="exit-modal-actions">
              <button className="exit-modal-confirm" style={{ background: 'var(--acc)' }} onClick={actions.dismissCancelled}>
                Back to home
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reconnecting overlay — only shown after first successful connect */}
      {!state.connected && state.everConnected && (
        <div className="reconnect-overlay">
          <div className="reconnect-box">
            <div className="reconnect-spinner" />
            <span>Reconnecting…</span>
          </div>
        </div>
      )}

      {screen === 'name' && (
        <NameScreen actions={actions} isEditing={!!state.playerName} />
      )}
      {screen === 'home' && (
        <HomeScreen actions={actions} playerName={state.playerName} />
      )}
      {screen === 'create' && (
        <CreateScreen error={error} actions={actions} />
      )}
      {screen === 'join' && (
        <JoinScreen error={error} actions={actions} initialCode={state.inviteCode} />
      )}
      {screen === 'lobby' && (
        <LobbyScreen
          game={game} roomCode={roomCode}
          myId={myId} error={error}
          actions={actions}
          lobbyExpiresAt={game?.lobbyExpiresAt}
        />
      )}
      {screen === 'game' && game && (
        <GameScreen
          game={game} myId={myId}
          isMyTurn={isMyTurn} timer={timer}
          error={error} notice={notice}
          actions={actions}
        />
      )}
      {screen === 'round-end' && game && (
        <RoundEndScreen game={game} myId={myId} actions={actions} />
      )}
      {screen === 'game-end' && game && (
        <GameEndScreen game={game} myId={myId} actions={actions} />
      )}
      {screen === 'howtoplay' && (
        <HowToPlayScreen actions={actions} returnTo={state.prevScreen || 'home'} />
      )}
    </div>
    </ErrorBoundary>
  );
}
