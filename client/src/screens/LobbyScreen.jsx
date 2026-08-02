const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

export default function LobbyScreen({ game, roomCode, myId, error, actions }) {
  const players  = game?.players || [];
  const isHost   = players[0]?.id === myId;
  const canStart = players.length >= 2;

  function copyCode() {
    navigator.clipboard?.writeText(roomCode).catch(() => {});
  }

  return (
    <div className="screen">
      <div className="topnav">
        <div className="back-btn" onClick={actions.leaveRoom}>‹</div>
        <h2>Lobby</h2>
      </div>

      {error && <div className="error-toast">{error}</div>}

      <div className="lobby-inner scroll">
        <div className="room-code-box" onClick={copyCode} title="Tap to copy">
          <div className="room-code-label">Room code</div>
          <div className="room-code">{roomCode}</div>
          <div className="room-code-hint">Share with friends · tap to copy</div>
        </div>

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
