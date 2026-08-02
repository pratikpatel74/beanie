const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

export default function RoundEndScreen({ game, myId, actions }) {
  const players = [...game.players].sort((a, b) => a.totalScore - b.totalScore);
  const lastRoundIdx = (game.players[0]?.roundScores?.length || 1) - 1;

  return (
    <div className="screen">
      <div className="topnav">
        <h2>Round {game.round} complete</h2>
      </div>

      <div className="round-end-inner scroll">
        <div className="winner-banner">
          <div className="crown">🏆</div>
          <div className="wins">{game.roundWinner} wins this round!</div>
          <div className="sub">Scored 0 points</div>
        </div>

        <div className="section-label">Scores after round {game.round}</div>

        <table className="score-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>This round</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const origIdx = game.players.indexOf(game.players.find(gp => gp.id === p.id));
              const thisRound = p.roundScores[lastRoundIdx] ?? 0;
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
                    {p.id === myId ? `${p.name} (you)` : p.name}
                  </td>
                  <td className={`score-round-cell${thisRound === 0 ? ' score-this-round' : ''}`}>
                    {thisRound === 0 ? '0 🏆' : `+${thisRound}`}
                  </td>
                  <td className="total-col">{p.totalScore}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {game.round < 13 && (
          <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center' }}>
            Next round: <strong style={{ color: 'var(--gold)' }}>
              {['A','2','3','4','5','6','7','8','9','10','J','Q','K'][game.round]}s
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
