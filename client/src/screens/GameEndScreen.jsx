const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

export default function GameEndScreen({ game, myId, actions }) {
  const sorted  = [...game.players].sort((a, b) => a.totalScore - b.totalScore);
  const winner  = sorted[0];
  const iWon    = winner?.id === myId;

  return (
    <div className="screen">
      <div className="topnav"><h2>Game over</h2></div>

      <div className="game-end-inner scroll">
        <div className="game-end-banner">
          <div className="trophy">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/>
              <path d="M6 4H2v4a4 4 0 0 0 4 4"/>
              <path d="M18 4h4v4a4 4 0 0 1-4 4"/>
              <path d="M12 14v4"/>
              <path d="M8 22h8"/>
            </svg>
          </div>
          <div className="winner">{iWon ? 'You win!' : `${winner?.name} wins!`}</div>
          <div className="sub">
            {iWon
              ? `Lowest score — ${winner.totalScore} points across 13 rounds`
              : `${winner?.name} finished with ${winner?.totalScore} points`
            }
          </div>
        </div>

        <div className="section-label">Final standings</div>

        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              {game.players[0]?.roundScores.map((_, i) => (
                <th key={i} style={{ fontSize: 9 }}>R{i + 1}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, rank) => {
              const origIdx = game.players.findIndex(gp => gp.id === p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: PLAYER_COLOURS[origIdx],
                        flexShrink: 0,
                      }}
                    />
                    {rank === 0 ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:3}}><path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/><path d="M6 4H2v4a4 4 0 0 0 4 4"/><path d="M18 4h4v4a4 4 0 0 1-4 4"/><path d="M12 14v4"/><path d="M8 22h8"/></svg> : null}{p.id === myId ? `${p.name} (you)` : p.name}
                  </td>
                  {p.roundScores.map((s, i) => (
                    <td key={i} className="score-round-cell">{s}</td>
                  ))}
                  <td className="total-col">{p.totalScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button className="btn btn-primary" onClick={() => actions.goTo('home')}>
          Back to home
        </button>
      </div>
    </div>
  );
}
