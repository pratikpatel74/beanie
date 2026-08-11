import { useState, useEffect } from 'react';

const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

function playerSuit(name) {
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['♠', '♥', '♦', '♣'][h % 4];
}
function suitColor(s) { return (s === '♥' || s === '♦') ? '#c0392b' : '#1a1a2e'; }
// Always show lobby countdown so players know the room has a time limit

function useExpiryCountdown(lobbyExpiresAt) {
  const [secsLeft, setSecsLeft] = useState(null);

  useEffect(() => {
    if (!lobbyExpiresAt) return;
    function update() {
      const ms = lobbyExpiresAt - Date.now();
      setSecsLeft(ms > 0 ? Math.ceil(ms / 1000) : 0);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lobbyExpiresAt]);

  return secsLeft;
}

function formatExpiry(secs) {
  if (secs === null || secs < 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ConfigSummary({ config }) {
  if (!config) return null;
  const pills = [
    `${config.turnSeconds}s turns`,
    `${config.lobbyMinutes}m lobby`,
    `★ = ${config.beanieHandValue}pts`,
    config.allowReclaimBeanie ? 'Reclaim on' : null,
  ].filter(Boolean);
  return (
    <div className="lobby-config-summary">
      {pills.map(p => <span key={p} className="lobby-config-pill">{p}</span>)}
    </div>
  );
}

export default function LobbyScreen({ game, roomCode, myId, error, actions, lobbyExpiresAt }) {
  const players  = game?.players || [];
  const isHost   = players[0]?.id === myId;
  const canStart = players.length >= 2;
  const [copied, setCopied]         = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const secsLeft     = useExpiryCountdown(lobbyExpiresAt);
  const showCountdown = secsLeft !== null && secsLeft > 0;
  const expiryUrgent  = secsLeft !== null && secsLeft <= 60;

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  }

  async function handleShare() {
    const url  = `${window.location.origin}?join=${roomCode}`;
    const text = `Join my Beanie game! Room code: ${roomCode}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Beanie', text, url });
      } catch {}
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }

  return (
    <div className="screen">
      <div className="topnav">
        <div className="back-btn" onClick={actions.leaveRoom}>‹</div>
        <h2>Lobby</h2>
      </div>

      {error && <div className="error-toast">{error}</div>}

      {showCountdown && (
        <div className={`lobby-expiry-bar${expiryUrgent ? ' urgent' : ''}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Room expires in {formatExpiry(secsLeft)}
        </div>
      )}

      <div className="lobby-inner scroll">
        <div className="room-code-box">
          <div className="room-code-label">Room code</div>
          <div className="room-code" onClick={handleCopyCode} style={{ cursor: 'pointer' }} title="Tap to copy">
            {roomCode}
          </div>
          <div className="room-code-hint">{codeCopied ? '✓ Copied!' : 'Tap to copy'}</div>
          <button className="share-btn" onClick={handleShare}>
            {copied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
                Link copied!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Invite friends
              </>
            )}
          </button>
        </div>

        <ConfigSummary config={game?.config} />

        <div className="section-label">Players ({players.length}/4)</div>

        <div className="players-list">
          {players.map((p, i) => (
            <div className="player-row" key={p.id}>
              <div className="player-dot" style={{ background: PLAYER_COLOURS[i] }} />
              <span className="player-row-name">{p.name}</span>
              {i === 0 && <span className="player-row-host">Host</span>}
              {p.id === myId && <span style={{ fontSize: 11, color: 'var(--text3)' }}>You</span>}
            </div>
          ))}
          {Array.from({ length: 4 - players.length }).map((_, i) => (
            <div className="player-row" key={`empty-${i}`} style={{ opacity: 0.4 }}>
              <div className="player-dot" style={{ background: PLAYER_COLOURS[players.length + i], opacity: 0.4 }} />
              <span className="player-waiting">Waiting for player…</span>
            </div>
          ))}
        </div>

        {isHost ? (
          <>
            <button
              className="btn btn-primary"
              onClick={actions.startGame}
              disabled={!canStart}
            >
              {canStart ? 'Start game' : 'Waiting for more players…'}
            </button>
            {!canStart && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Need at least 2 players to start
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', padding: '8px 0' }}>
            Waiting for the host to start…
          </div>
        )}
      </div>
    </div>
  );
}
