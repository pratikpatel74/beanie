import { useState } from 'react';
import { PLAYER_COLOURS, BEANIE_RANKS } from '../constants';

// Small inline trophy icon
const TrophyIcon = ({ size = 11, color = 'var(--gold)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/>
    <path d="M6 4H2v4a4 4 0 0 0 4 4"/>
    <path d="M18 4h4v4a4 4 0 0 1-4 4"/>
    <path d="M12 14v4"/>
    <path d="M8 22h8"/>
  </svg>
);

// Canvas helper: draws a rounded-rect path (no native roundRect on older Safari)
function canvasRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Render the full scorecard to a PNG then share via native sheet (mobile)
// or trigger a download (desktop fallback).
function shareScorecard(sorted, winner, gamePlayers) {
  const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const P_COLS = ['#7C6FFF','#E85480','#2DD4A7','#F5A623'];
  const SANS   = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  const numRounds = sorted[0]?.roundScores?.length || 13;
  const ranks  = RANKS.slice(0, numRounds);

  const W      = 680, PAD = 28;
  const NAME_W = 118, TOT_W = 52;
  const RD_W   = Math.floor((W - PAD * 2 - NAME_W - TOT_W) / ranks.length);
  const TABLE_W = NAME_W + RD_W * ranks.length + TOT_W;
  const HDR_H  = 98, LBL_H = 30, TBL_H = 30, ROW_H = 42, FOOT_H = 44;
  const H      = PAD + HDR_H + 16 + LBL_H + TBL_H + ROW_H * sorted.length + FOOT_H;

  const canvas = document.createElement('canvas');
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#0D1F1A';
  ctx.fillRect(0, 0, W, H);

  // Header card
  ctx.fillStyle = '#1A2E28';
  canvasRoundRect(ctx, PAD, PAD, W - PAD * 2, HDR_H, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 0.5;
  canvasRoundRect(ctx, PAD, PAD, W - PAD * 2, HDR_H, 14); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `600 11px ${SANS}`;
  ctx.fillText('BEANIE', W / 2, PAD + 24);

  ctx.fillStyle = '#F0B429';
  ctx.font = `700 22px ${SANS}`;
  ctx.fillText(`${winner.name} wins!`, W / 2, PAD + 52);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `400 13px ${SANS}`;
  ctx.fillText(`${winner.totalScore} pts — lowest after 13 rounds`, W / 2, PAD + 76);

  // Section label
  const secY = PAD + HDR_H + 20;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `600 10px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('ROUND BY ROUND', PAD, secY + 16);

  // Table header
  const tblY = secY + LBL_H;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `500 10px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('Player', PAD + 12, tblY + 20);
  ranks.forEach((r, i) => {
    ctx.textAlign = 'center';
    ctx.fillText(`★${r}`, PAD + NAME_W + RD_W * i + RD_W / 2, tblY + 20);
  });
  ctx.textAlign = 'center';
  ctx.fillText('Total', PAD + NAME_W + RD_W * ranks.length + TOT_W / 2, tblY + 20);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(PAD, tblY + TBL_H); ctx.lineTo(PAD + TABLE_W, tblY + TBL_H);
  ctx.stroke();

  // Player rows
  sorted.forEach((p, pi) => {
    const rowY    = tblY + TBL_H + ROW_H * pi;
    const origIdx = gamePlayers.findIndex(gp => gp.id === p.id);
    const pCol    = P_COLS[origIdx] || '#7C6FFF';
    const isWin   = p.id === winner.id;

    if (isWin) {
      ctx.fillStyle = 'rgba(240,180,41,0.06)';
      ctx.fillRect(PAD - 4, rowY, TABLE_W + 8, ROW_H);
    }

    ctx.fillStyle = pCol;
    ctx.beginPath();
    ctx.arc(PAD + 7, rowY + ROW_H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    const displayName = p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name;
    ctx.fillStyle = '#ffffff';
    ctx.font = `500 13px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(displayName, PAD + 18, rowY + ROW_H / 2 + 5);

    p.roundScores?.forEach((score, ri) => {
      const cx = PAD + NAME_W + RD_W * ri + RD_W / 2;
      const cy = rowY + ROW_H / 2;
      if (score === 0) {
        const pw = Math.min(RD_W - 4, 28), ph = 18;
        ctx.fillStyle = 'rgba(240,165,0,0.15)';
        canvasRoundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, 4); ctx.fill();
        ctx.fillStyle = '#F0B429';
        ctx.font = `700 11px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText('W', cx, cy + 4);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `400 12px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(score), cx, cy + 4);
      }
    });

    ctx.fillStyle = isWin ? '#2DD4A7' : 'rgba(168,155,255,0.85)';
    ctx.font = `700 14px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(p.totalScore), PAD + NAME_W + RD_W * ranks.length + TOT_W / 2, rowY + ROW_H / 2 + 5);

    if (pi < sorted.length - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY + ROW_H); ctx.lineTo(PAD + TABLE_W, rowY + ROW_H);
      ctx.stroke();
    }
  });

  // Footer
  const footY = tblY + TBL_H + ROW_H * sorted.length;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = `400 12px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('play.playbeanie.com', W / 2, footY + 26);

  // Share or download
  canvas.toBlob(blob => {
    const file = new File([blob], 'beanie-scorecard.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Beanie scorecard' }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'beanie-scorecard.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, 'image/png');
}

// Share the result as plain text via navigator.share or clipboard fallback.
// When includeRounds is true, appends a full round-by-round table.
function shareResult(players, winner, includeRounds) {
  const lines = [`Beanie — ${winner.name} wins! (${winner.totalScore} pts)`, ''];

  if (includeRounds && players[0]?.roundScores) {
    const nameW = Math.max(...players.map(p => p.name.length), 4);
    const header = ' '.repeat(nameW + 2) + BEANIE_RANKS.map(r => `★${r}`.padStart(4)).join('') + '  Total';
    lines.push(header);
    players.forEach(p => {
      const name = p.name.padEnd(nameW);
      const cols = p.roundScores.map(s => (s === 0 ? 'W' : String(s)).padStart(4)).join('');
      lines.push(`${name}  ${cols}  ${String(p.totalScore).padStart(5)}`);
    });
    lines.push('', 'W = round winner (0 pts)');
  } else {
    lines.push(...players.map((p, i) => `${i + 1}. ${p.name} — ${p.totalScore} pts`));
  }

  lines.push('', 'play.playbeanie.com');
  const text = lines.join('\n');
  if (navigator.share) {
    navigator.share({ title: 'Beanie scorecard', text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

export default function GameEndScreen({ game, myId, actions }) {
  const [showScorecard, setShowScorecard] = useState(false);

  const sorted = [...game.players].sort((a, b) => a.totalScore - b.totalScore);
  const winner = sorted[0];
  const iWon   = winner?.id === myId;

  // Derived stats (all computed from existing roundScores — no extra server data needed)
  const roundsWonByPlayer = {};
  if (game.players[0]?.roundScores) {
    const numRounds = game.players[0].roundScores.length;
    for (let r = 0; r < numRounds; r++) {
      const scores = game.players.map(p => ({ id: p.id, score: p.roundScores[r] ?? Infinity }));
      const minScore = Math.min(...scores.map(s => s.score));
      if (minScore === 0) {
        scores.filter(s => s.score === 0).forEach(s => {
          roundsWonByPlayer[s.id] = (roundsWonByPlayer[s.id] || 0) + 1;
        });
      }
    }
  }

  const mostRoundsWon = sorted.reduce((best, p) => {
    const w = roundsWonByPlayer[p.id] || 0;
    return w > (roundsWonByPlayer[best?.id] || 0) ? p : best;
  }, sorted[0]);

  const mostBeaniesStolen = [...sorted].sort((a, b) => (b.beaniesStolen || 0) - (a.beaniesStolen || 0))[0];

  let bestPlayer = null, bestScore = Infinity;
  let worstPlayer = null, worstScore = -Infinity;
  game.players.forEach(p => {
    p.roundScores?.forEach(s => {
      if (s < bestScore)  { bestScore = s;  bestPlayer = p; }
      if (s > worstScore) { worstScore = s; worstPlayer = p; }
    });
  });

  // Last round delta for each player
  const lastRoundIdx = (game.players[0]?.roundScores?.length ?? 0) - 1;

  const maxSteals = Math.max(1, ...game.players.map(p => p.beaniesStolen || 0));

  return (
    <div className="screen">
      <div className="topnav"><h2>Game over</h2></div>

      <div className="game-end-inner scroll">

        {/* Tab bar */}
        <div className="scorecard-tabs">
          <button className={`scorecard-tab${!showScorecard ? ' active' : ''}`} onClick={() => setShowScorecard(false)}>
            Summary
          </button>
          <button className={`scorecard-tab${showScorecard ? ' active' : ''}`} onClick={() => setShowScorecard(true)}>
            Scorecard
          </button>
        </div>

        {/* ── SUMMARY VIEW ───────────────────────────────────────────────────── */}
        {!showScorecard && (
          <>
            {/* Winner banner */}
            <div className="game-end-banner">
              <div className="trophy">
                <TrophyIcon size={52} color="var(--gold)" />
              </div>
              <div className="winner">{iWon ? 'You win!' : `${winner?.name} wins!`}</div>
              <div className="sub">
                {winner?.totalScore} points — lowest after 13 rounds
              </div>
            </div>

            {/* Stat highlight cards */}
            <div>
              <div className="section-label">Highlights</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

                {/* Most rounds won */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(78,201,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                    <TrophyIcon size={13} color="var(--ok)" />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {roundsWonByPlayer[mostRoundsWon?.id] || 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Rounds won</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLOURS[game.players.findIndex(p => p.id === mostRoundsWon?.id)], flexShrink: 0 }} />
                    {mostRoundsWon?.name}
                  </div>
                </div>

                {/* Most Beanies stolen */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(196,123,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {mostBeaniesStolen?.beaniesStolen || 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Beanies stolen</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLOURS[game.players.findIndex(p => p.id === mostBeaniesStolen?.id)], flexShrink: 0 }} />
                    {mostBeaniesStolen?.name}
                  </div>
                </div>

                {/* Best single round */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(240,165,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {bestScore === Infinity ? '—' : `${bestScore} pts`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Best round</div>
                  {bestPlayer && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLOURS[game.players.findIndex(p => p.id === bestPlayer.id)], flexShrink: 0 }} />
                      {bestPlayer.name}
                    </div>
                  )}
                </div>

                {/* Worst single round */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(220,60,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e05555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="2" x2="12" y2="12"/><circle cx="12" cy="17" r="1" fill="#e05555"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
                    {worstScore === -Infinity ? '—' : `${worstScore} pts`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Worst round</div>
                  {worstPlayer && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: PLAYER_COLOURS[game.players.findIndex(p => p.id === worstPlayer.id)], flexShrink: 0 }} />
                      {worstPlayer.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Final standings */}
            <div>
              <div className="section-label">Final standings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sorted.map((p, rank) => {
                  const origIdx = game.players.findIndex(gp => gp.id === p.id);
                  const colour  = PLAYER_COLOURS[origIdx];
                  const lastDelta = lastRoundIdx >= 0 ? p.roundScores[lastRoundIdx] : null;
                  const isRoundWinner = lastDelta === 0;
                  const steals  = p.beaniesStolen || 0;
                  const stealBarWidth = Math.round((steals / maxSteals) * 100);
                  const isWinner = rank === 0;

                  // Round-win pips for the game winner
                  const pips = p.roundScores?.map((s, ri) => {
                    const won = s === 0;
                    return (
                      <div key={ri} style={{
                        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                        background: won ? 'rgba(240,165,0,0.25)' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {won && <TrophyIcon size={7} color="var(--gold)" />}
                      </div>
                    );
                  });

                  return (
                    <div key={p.id} style={{
                      background: isWinner ? 'rgba(240,165,0,0.07)' : 'rgba(255,255,255,0.03)',
                      border: `0.5px solid ${isWinner ? 'rgba(240,165,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 10, padding: '9px 12px',
                      display: 'flex', alignItems: 'center', gap: 9,
                    }}>
                      <span style={{ fontSize: 10, color: isWinner ? 'var(--gold)' : 'var(--text3)', width: 12, textAlign: 'center', flexShrink: 0 }}>
                        {rank + 1}
                      </span>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colour, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                          {p.id === myId && (
                            <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.09)', borderRadius: 4, padding: '1px 5px', color: 'var(--text3)' }}>you</span>
                          )}
                        </div>
                        {isWinner ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 5 }}>
                            {pips}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${stealBarWidth}%`, height: '100%', background: colour, opacity: 0.55, borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{steals} steal{steals !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: isWinner ? 'var(--ok)' : 'var(--text)', lineHeight: 1 }}>
                          {p.totalScore}
                        </span>
                        {lastDelta !== null && (
                          isRoundWinner ? (
                            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(240,180,41,0.7)', background: 'rgba(240,180,41,0.1)', borderRadius: 3, padding: '1px 4px', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                              <TrophyIcon size={7} /> +0
                            </span>
                          ) : (
                            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text3)', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px', lineHeight: 1 }}>
                              +{lastDelta}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── SCORECARD VIEW ─────────────────────────────────────────────────── */}
        {showScorecard && (
          <div>
            <div className="section-label">Round by round</div>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="score-table" style={{ minWidth: `${100 + 13 * 36}px` }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Player</th>
                    {BEANIE_RANKS.map(r => (
                      <th key={r} style={{ textAlign: 'right', fontSize: 10, padding: '4px 5px' }}>
                        ★{r}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => {
                    const origIdx = game.players.findIndex(gp => gp.id === p.id);
                    const isGameWinner = p.id === winner?.id;
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: p.id === myId ? 600 : undefined }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAYER_COLOURS[origIdx], flexShrink: 0 }} />
                          {p.name}
                        </td>
                        {p.roundScores?.map((score, i) => {
                          const isWin = score === 0;
                          return (
                            <td key={i} style={{ padding: '4px 5px', textAlign: 'right' }}>
                              {isWin ? (
                                <span style={{ color: 'var(--gold)', fontWeight: 700, background: 'rgba(240,165,0,0.12)', borderRadius: 3, padding: '1px 4px', fontSize: 11 }}>W</span>
                              ) : (
                                <span style={{ color: 'var(--text2)' }}>{score}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="total-col" style={{ color: isGameWinner ? 'var(--ok)' : undefined }}>{p.totalScore}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ACTIONS (always visible) ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => actions.goTo('home')}>
            Back to home
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => actions.goTo('home')}>
            Play again
          </button>
        </div>

        {/* Share */}
        <button
          onClick={() => showScorecard ? shareScorecard(sorted, winner, game.players) : shareResult(sorted, winner, false)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '4px 0' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {showScorecard ? 'Share scorecard' : 'Share result'}
        </button>

      </div>
    </div>
  );
}
