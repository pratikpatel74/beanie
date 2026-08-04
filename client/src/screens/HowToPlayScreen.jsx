// HowToPlayScreen.jsx — Full in-app rules guide

export default function HowToPlayScreen({ actions }) {
  return (
    <div className="screen">
      <div className="topnav" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="back-btn" onClick={() => actions.goTo('home')}>‹</button>
        <h2 style={{ flex: 1 }}>How to Play</h2>
      </div>

      <div className="htp-scroll scroll">

        {/* ── Overview ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🃏</span>
            <h3>Overview</h3>
          </div>
          <p className="htp-body">
            Beanie is a wild-card card game, similar to Rummy, for <strong>2–4 players</strong> played over
            <strong> 13 rounds</strong>. Each round a different rank becomes the wild card —
            the <em>Beanie</em>. Play sets, steal Beanies, and get rid of your cards. The
            player with the <strong>lowest score after 13 rounds wins</strong>.
          </p>
        </section>

        <div className="htp-divider" />

        {/* ── The Beanie ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">★</span>
            <h3>The Beanie (Wild Card)</h3>
          </div>
          <p className="htp-body">
            The Beanie rank changes every round — Aces in round 1, 2s in round 2, all the
            way to Kings in round 13. Any card of that rank acts as a wild and can substitute
            for any card in a set.
          </p>
          <div className="htp-round-table">
            <div className="htp-rt-row htp-rt-head">
              <span>Rounds</span><span>Beanie</span>
            </div>
            {[
              ['1', 'Aces ★'],
              ['2', '2s ★'],
              ['3', '3s ★'],
              ['4–9', '4s – 9s ★'],
              ['10', '10s ★'],
              ['11', 'Jacks ★'],
              ['12', 'Queens ★'],
              ['13', 'Kings ★'],
            ].map(([r, b]) => (
              <div className="htp-rt-row" key={r}>
                <span>Round {r}</span>
                <span className="htp-gold">{b}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Your Turn ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🔄</span>
            <h3>Your Turn</h3>
          </div>
          <div className="htp-steps">
            <div className="htp-step">
              <div className="htp-step-num">1</div>
              <div>
                <div className="htp-step-title">Draw</div>
                <div className="htp-step-body">Take the top card from the <strong>draw pile</strong>, or take the top card from the <strong>discard pile</strong> if you want it.</div>
              </div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">2</div>
              <div>
                <div className="htp-step-title">Play (optional)</div>
                <div className="htp-step-body">Lay sets from your hand, add cards to sets on the table, or steal a Beanie from another player's set.</div>
              </div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">3</div>
              <div>
                <div className="htp-step-title">Discard</div>
                <div className="htp-step-body">End your turn by placing one card face-up on the discard pile. If you've emptied your hand, the round ends.</div>
              </div>
            </div>
          </div>
          <div className="htp-tip">
            💡 A random player is chosen to go first each round. That player starts with <strong>8 cards</strong>; everyone else starts with <strong>7</strong>. The extra card counts as their draw for that turn, so they go straight to the Play/Discard step.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Sets ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">📋</span>
            <h3>Laying Sets</h3>
          </div>
          <p className="htp-body">Select 3 or more cards from your hand and tap <strong>Lay Set</strong>. Two types are valid:</p>

          <div className="htp-set-type">
            <div className="htp-set-type-label">Match</div>
            <p className="htp-set-type-body">
              3 or more cards of the <strong>same rank</strong>, each a <strong>different suit</strong>.
            </p>
            <div className="htp-set-pill">
              <div className="htp-card face">Q<span className="htp-suit">♠</span></div>
              <div className="htp-card face red">Q<span className="htp-suit">♥</span></div>
              <div className="htp-card face red">Q<span className="htp-suit">♦</span></div>
            </div>
          </div>

          <div className="htp-set-type">
            <div className="htp-set-type-label">Run</div>
            <p className="htp-set-type-body">
              3 or more <strong>consecutive cards of the same suit</strong>. Ace is always lowest (A–2–3…), King is highest.
            </p>
            <div className="htp-set-pill">
              <div className="htp-card face red">5<span className="htp-suit">♦</span></div>
              <div className="htp-card face red">6<span className="htp-suit">♦</span></div>
              <div className="htp-card face red">7<span className="htp-suit">♦</span></div>
              <div className="htp-card face red">8<span className="htp-suit">♦</span></div>
            </div>
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Beanies in Sets ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">✦</span>
            <h3>Beanies in Sets</h3>
          </div>

          <div className="htp-rule-block">
            <div className="htp-rule-title">In a Match</div>
            <p className="htp-rule-body">
              A Beanie fills in for the missing suit. Include it like any other card — the set is still valid.
            </p>
            <div className="htp-set-pill">
              <div className="htp-card face">J<span className="htp-suit">♣</span></div>
              <div className="htp-card face">J<span className="htp-suit">♠</span></div>
              <div className="htp-card beanie">★<span className="htp-suit">★</span></div>
            </div>
          </div>

          <div className="htp-rule-block">
            <div className="htp-rule-title">In a Run — gap Beanies</div>
            <p className="htp-rule-body">
              A Beanie filling a gap in the middle is automatically placed. Its position is shown with a badge below it and is <strong>fixed permanently</strong>.
            </p>
            <div className="htp-set-pill">
              <div className="htp-card face red">3<span className="htp-suit">♦</span></div>
              <div className="htp-card beanie" style={{ position:'relative' }}>
                ★<span className="htp-suit">★</span>
                <span className="htp-beanie-badge">4♦</span>
              </div>
              <div className="htp-card face red">5<span className="htp-suit">♦</span></div>
            </div>
          </div>

          <div className="htp-rule-block">
            <div className="htp-rule-title">In a Run — end Beanies</div>
            <p className="htp-rule-body">
              A Beanie at the end of a run can extend it in either direction. When you lay the set, you'll be asked to choose where it sits.
            </p>
            <div className="htp-example-row" style={{ gap: 8, alignItems: 'center' }}>
              <div className="htp-set-pill" style={{ marginBottom: 0 }}>
                <div className="htp-card beanie" style={{ position:'relative' }}>
                  ★<span className="htp-suit">★</span>
                  <span className="htp-beanie-badge">4♦</span>
                </div>
                <div className="htp-card face red">5<span className="htp-suit">♦</span></div>
                <div className="htp-card face red">6<span className="htp-suit">♦</span></div>
              </div>
              <span style={{ fontSize:11, color:'var(--text3)' }}>or</span>
              <div className="htp-set-pill" style={{ marginBottom: 0 }}>
                <div className="htp-card face red">5<span className="htp-suit">♦</span></div>
                <div className="htp-card face red">6<span className="htp-suit">♦</span></div>
                <div className="htp-card beanie" style={{ position:'relative' }}>
                  ★<span className="htp-suit">★</span>
                  <span className="htp-beanie-badge">7♦</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Adding to Sets ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">➕</span>
            <h3>Adding to Sets</h3>
          </div>
          <p className="htp-body">
            Once you've laid at least one set of your own, you can add cards to <strong>any set on the table</strong> — yours or other players'.
          </p>
          <div className="htp-steps">
            <div className="htp-step">
              <div className="htp-step-num">1</div>
              <div className="htp-step-body">Select a card (or cards) from your hand.</div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">2</div>
              <div className="htp-step-body">Tap the <span className="htp-btn-inline">+</span> button on an eligible set to add your card(s) to it.</div>
            </div>
          </div>
          <div className="htp-set-pill htp-set-pill-addable">
            <div className="htp-card face red">5<span className="htp-suit">♦</span></div>
            <div className="htp-card face red">6<span className="htp-suit">♦</span></div>
            <div className="htp-card face red">7<span className="htp-suit">♦</span></div>
            <div className="htp-add-btn">+</div>
          </div>
          <div className="htp-tip">
            💡 For Runs: your card must continue the sequence at either end. A Match can hold at most 4 cards (one per suit) — the ★ button is hidden when a set is full.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Adding a Beanie to a Set ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">★</span>
            <h3>Adding a Beanie to a Set</h3>
          </div>
          <p className="htp-body">
            Once you've laid a set, you can place a Beanie from your hand onto <strong>any set on the table</strong> — yours or an opponent's — to extend it. Select just the Beanie card and tap the <span className="htp-btn-inline" style={{ background: 'var(--gold)', color: '#1a1200' }}>★</span> button on a set.
          </p>
          <div className="htp-steps">
            <div className="htp-step">
              <div className="htp-step-num">M</div>
              <div>
                <div className="htp-step-title">Match</div>
                <div className="htp-step-body">The Beanie is added as another card of that rank. A Match can hold at most 4 cards — one per suit — so the ★ button is hidden when all 4 are down.</div>
              </div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">R</div>
              <div>
                <div className="htp-step-title">Run</div>
                <div className="htp-step-body">The Beanie extends the run by one card. If only one end is open you're placed automatically. If both ends are open, you'll be asked which rank the Beanie becomes.</div>
              </div>
            </div>
          </div>
          <div className="htp-tip">
            💡 Placing a Beanie on an opponent's run locks it in and makes their set harder to complete — a useful tactical move.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Stealing a Beanie ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🎯</span>
            <h3>Stealing a Beanie</h3>
          </div>
          <p className="htp-body">
            If you hold the real card that a Beanie is substituting for, you can steal the Beanie and use it yourself. The <strong>Steal Beanie ★</strong> button only appears when you actually have a card capable of making a valid swap.
          </p>
          <div className="htp-steps">
            <div className="htp-step">
              <div className="htp-step-num">1</div>
              <div className="htp-step-body">Tap <strong>Steal Beanie ★</strong> — your eligible hand cards will glow with a <span style={{ color: 'var(--gold)' }}>gold ring</span>.</div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">2</div>
              <div className="htp-step-body">Tap a gold card from your hand to select it as the replacement.</div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">3</div>
              <div className="htp-step-body">Tap a pulsing ★ Beanie on the table to complete the swap. The Beanie comes to your hand; your card takes its place.</div>
            </div>
          </div>
          <div className="htp-set-pill htp-set-pill-steal">
            <div className="htp-card face">J<span className="htp-suit">♣</span></div>
            <div className="htp-card face">J<span className="htp-suit">♠</span></div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="htp-card beanie">★<span className="htp-suit">★</span></div>
              <span className="htp-steal-pulse" />
            </div>
          </div>
          <div className="htp-tip">
            💡 You must have already laid a set of your own before you can steal.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Draw Pile Empty ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🔀</span>
            <h3>Draw Pile Runs Out</h3>
          </div>
          <p className="htp-body">
            If the draw pile is empty when it's your turn to draw, the discard pile is automatically <strong>reshuffled</strong> (keeping the top card face-up) and becomes the new draw pile. The game continues without interruption.
          </p>
        </section>

        <div className="htp-divider" />

        {/* ── Declare Draw ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🤝</span>
            <h3>Ending a Stalemate</h3>
          </div>
          <p className="htp-body">
            If no one can make progress — no one can lay sets or get rid of their cards — any player can propose ending the round early.
          </p>
          <div className="htp-steps">
            <div className="htp-step">
              <div className="htp-step-num">1</div>
              <div className="htp-step-body">During your action phase, tap <strong>End Round</strong> at the bottom of the screen to cast your vote.</div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">2</div>
              <div className="htp-step-body">Other players see a notice and can agree on their own turn by tapping <strong>Agree to End Round</strong>.</div>
            </div>
            <div className="htp-step">
              <div className="htp-step-num">3</div>
              <div className="htp-step-body">When <strong>all players agree</strong>, the round ends as a draw — every player scores penalty points for their remaining hand. Nobody scores 0.</div>
            </div>
          </div>
          <div className="htp-tip">
            💡 Changed your mind? Tap <strong>Cancel End Round vote</strong> to withdraw before everyone agrees.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Scoring ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">🏆</span>
            <h3>Scoring</h3>
          </div>
          <p className="htp-body">
            When a round ends, every player scores penalty points for cards still in their hand. The round winner scores 0. In a <strong>drawn round</strong> (all players agreed to end early), everyone scores their hand — nobody gets 0.
          </p>
          <div className="htp-score-table">
            <div className="htp-score-row htp-score-head">
              <span>Card</span><span>Points</span>
            </div>
            <div className="htp-score-row">
              <span>2 – 9</span><span>Face value</span>
            </div>
            <div className="htp-score-row">
              <span>10, J, Q, K</span><span>10 pts each</span>
            </div>
            <div className="htp-score-row">
              <span>Ace</span><span>1 pt</span>
            </div>
            <div className="htp-score-row htp-score-beanie">
              <span>★ Beanie (held)</span><span>10 pts</span>
            </div>
            <div className="htp-score-row htp-score-winner">
              <span>🏆 Round winner</span><span>0 pts</span>
            </div>
          </div>
          <div className="htp-tip">
            After all 13 rounds, the player with the <strong>lowest total score wins</strong>.
          </div>
        </section>

        <div className="htp-divider" />

        {/* ── Quick tips ── */}
        <section className="htp-section">
          <div className="htp-section-header">
            <span className="htp-icon">💬</span>
            <h3>Quick Tips</h3>
          </div>
          <ul className="htp-tips-list">
            <li>Lay sets early so you can add to the table and steal Beanies.</li>
            <li>Watch what others are building — steal a Beanie before they extend the run.</li>
            <li>Holding a Beanie is expensive (10 pts). Use it, place it on a set, or steal something with it.</li>
            <li>You can discard a Beanie if you really need to — but it's usually costly.</li>
            <li>Taking from the discard pile gives everyone a clue to what you're building — pick carefully.</li>
            <li>In later rounds (J, Q, K) the Beanies are high-value cards, so stealing pays off even more.</li>
            <li>If you're stuck and can't win, propose End Round to limit everyone's penalty points — don't let the round drag on forever.</li>
          </ul>
        </section>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
