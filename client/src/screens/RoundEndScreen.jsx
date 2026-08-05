const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];
const BEANIE_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export default function RoundEndScreen({ game, myId, actions }) {
  // Sort by total score ascending (lower = better)
  const players = [...game.players].sort((a, b) => a.totalScore - b.totalScore);
  const roundsPlayed = game.players[0]?.roundScores?.length || 0;

  return (
    <div className="screen">
      <div className="topnav">
        <h2>Round {game.round} complete</h2>
      </div>

      <div className="round-end-inner scroll">
        {game.roundWinner ? (
          <div className="winner-banner">
            <div className="crown">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/>
                <path d="M6 4H2v4a4 4 0 0 0 4 4"/>
                <path d="M18 4h4v4a4 4 0 0 1-4 4"/>
                <path d="M12 14v4"/>
                <path d="M8 22h8"/>
              </svg>
            </div>
            <div className="wins">{game.roundWinner} wins this round!</div>
            <div className="sub">Scored 0 points</div>
          </div>
        ) : (
          <div className="winner-banner">
            <div className="crown">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6l4-4 4 4M12 2v10M8 18l4 4 4-4M12 22V12"/>
              </svg>
            </div>
            <div className="wins">Round drawn</div>
            <div className="sub">All players scored penalty points</div>
          </div>
        )}

        <div className="section-label">Scores after round {game.round}</div>

        {/* Horizontally scrollable so all round columns fit on mobile */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="score-table" style={{ minWidth: roundsPlayed > 4 ? `${180 + roundsPlayed * 36}px` : undefined }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Player</th>
                {Array.from({ length: roundsPlayed }, (_, i) => (
                  <th key={i} style={{ textAlign: 'center', fontSize: 11, padding: '4px 4px' }}>
                    R{i + 1}
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const origIdx = game.players.findIndex(gp => gp.id === p.id);
                return (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: PLAYER_COLOURS[origIdx], flexShrink: 0,
                        }} />
                        {p.id === myId ? `${p.name} (you)` : p.name}
                      </div>
                    </td>
                    {p.roundScores.map((score, i) => {
                      const isWin = score === 0 && game.roundWinner;
                      return (
                        <td
                          key={i}
                          className={isWin && i === roundsPlayed - 1 ? 'score-round-cell score-this-round' : 'score-round-cell'}
                          style={{ textAlign: 'center', fontSize: 12, padding: '4px 4px' }}
                        >
                          {isWin ? <>0<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginLeft:2}}><path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/><path d="M6 4H2v4a4 4 0 0 0 4 4"/><path d="M18 4h4v4a4 4 0 0 1-4 4"/><path d="M12 14v4"/><path d="M8 22h8"/></svg></> : `+${score}`}
                        </td>
                      );
                    })}
                    <td className="total-col">{p.totalScore}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {game.round < 13 && (
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
            Next round: <strong style={{ color: 'var(--gold)' }}>
              {BEANIE_RANKS[game.round]}s
            </strong> are wild
          </div>
        )}

        <button className="btn btn-primary" onClick={actions.nextRound}>
          {game.round < 13 ? `Start round ${game.round + 1}` : 'See final scores'}
        </button>
      </div>
    </div>
  );
}
