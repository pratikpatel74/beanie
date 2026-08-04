import { useState } from 'react';
import Card, { EmptyCard } from '../components/Card';

const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];
const RANK_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// ─── Run / Beanie analysis helpers ───────────────────────────────────────────

/**
 * For a potential RUN set with Beanies, compute every valid run arrangement.
 * Gap Beanies are auto-placed; end Beanies generate N+1 options (0..N at the low end).
 *
 * Returns null if no Beanies are end-ambiguous (can lay immediately).
 * Returns { options: [{ label, overrides }] } otherwise, where label is e.g. "3-4-5-6♦".
 */
function buildRunOptions(cards, beanieRank) {
  const beanies    = cards.filter(c => c.rank === beanieRank);
  const nonBeanies = cards.filter(c => c.rank !== beanieRank);
  if (!beanies.length || !nonBeanies.length) return null;

  const sorted  = [...nonBeanies].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
  const suit    = sorted[0].suit;
  const lowIdx  = RANK_ORDER.indexOf(sorted[0].rank);
  const highIdx = RANK_ORDER.indexOf(sorted[sorted.length - 1].rank);

  // Auto-place gap Beanies
  const gapIdxs = [];
  for (let i = 1; i < sorted.length; i++) {
    const f = RANK_ORDER.indexOf(sorted[i - 1].rank);
    const t = RANK_ORDER.indexOf(sorted[i].rank);
    for (let g = f + 1; g < t; g++) gapIdxs.push(g);
  }
  const gapBeanies = beanies.slice(0, gapIdxs.length);
  const endBeanies = beanies.slice(gapIdxs.length);

  const gapOverrides = {};
  gapBeanies.forEach((b, i) => { gapOverrides[b.id] = { rank: RANK_ORDER[gapIdxs[i]], suit }; });

  if (!endBeanies.length) return { gapOverrides, options: null }; // no ambiguity

  // Base rank indices (non-beanies + gap-placed beanies)
  const baseIdxs = [
    ...sorted.map(c => RANK_ORDER.indexOf(c.rank)),
    ...gapIdxs,
  ];

  const n = endBeanies.length;
  const options = [];

  for (let lo = 0; lo <= n; lo++) {
    const hi = n - lo;
    if (lowIdx - lo < 0 || highIdx + hi > 12) continue;

    const overrides = { ...gapOverrides };
    endBeanies.forEach((b, i) => {
      overrides[b.id] = i < lo
        ? { rank: RANK_ORDER[lowIdx - lo + i],      suit }
        : { rank: RANK_ORDER[highIdx + (i - lo) + 1], suit };
    });

    // Build a readable run label e.g. "3-4-5-6♦"
    const allIdxs = [
      ...baseIdxs,
      ...Object.values(overrides).map(o => RANK_ORDER.indexOf(o.rank)),
    ];
    const seqIdxs = [...new Set(allIdxs)].sort((a, b) => a - b);
    const label   = seqIdxs.map(i => RANK_ORDER[i]).join('-') + suit;

    options.push({ label, overrides });
  }

  return { gapOverrides, options: options.length > 1 ? options : null, solo: options[0] };
}

/**
 * Given a Beanie card in a laid RUN set (no server override stored),
 * compute what rank it represents from context.
 */
function computeGapLabel(card, setCards, beanieRank) {
  const nonBeanies = setCards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return null;

  const sorted = [...nonBeanies].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );
  const suit = sorted[0].suit;

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const from = RANK_ORDER.indexOf(sorted[i - 1].rank);
    const to   = RANK_ORDER.indexOf(sorted[i].rank);
    for (let g = from + 1; g < to; g++) gaps.push(RANK_ORDER[g]);
  }

  const beanieCards = setCards.filter(c => c.rank === beanieRank);
  const idx = beanieCards.findIndex(c => c.id === card.id);
  if (idx < gaps.length) return `${gaps[idx]}${suit}`;
  return null;
}

// ─── Steal Beanie validation ──────────────────────────────────────────────────

/**
 * Returns true if replacementCard can validly swap in for beanieCard in set.
 * SET: replacement must match the set rank, different suit.
 * RUN: replacement must match the Beanie's fixed effective rank and run suit.
 */
function canStealBeanie(replacementCard, set, beanieCard, beanieRank) {
  if (!replacementCard || replacementCard.rank === beanieRank) return false;

  const nonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return false;

  if (set.type === 'SET') {
    return replacementCard.rank === nonBeanies[0].rank &&
           !nonBeanies.some(c => c.suit === replacementCard.suit);
  }

  if (set.type === 'RUN') {
    const runSuit = nonBeanies[0].suit;
    if (replacementCard.suit !== runSuit) return false;

    // Resolve this Beanie's effective rank
    let effectiveRank = null;
    if (set.beanieOverrides?.[beanieCard.id]) {
      effectiveRank = set.beanieOverrides[beanieCard.id].rank;
    } else {
      // Gap beanie — compute from non-beanie gaps
      const sorted = [...nonBeanies].sort(
        (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
      );
      const gapRanks = [];
      for (let i = 1; i < sorted.length; i++) {
        const f = RANK_ORDER.indexOf(sorted[i - 1].rank);
        const t = RANK_ORDER.indexOf(sorted[i].rank);
        for (let g = f + 1; g < t; g++) gapRanks.push(RANK_ORDER[g]);
      }
      const beanieCards = set.cards.filter(c => c.rank === beanieRank);
      const pos = beanieCards.findIndex(c => c.id === beanieCard.id);
      effectiveRank = pos < gapRanks.length ? gapRanks[pos] : null;
    }

    return effectiveRank !== null && replacementCard.rank === effectiveRank;
  }

  return false;
}

// ─── Sort run cards by effective rank for display ─────────────────────────────

/**
 * For a RUN publicSet, return cards sorted by their effective rank so they
 * display in sequence (Beanies slotted into their override / computed position).
 */
function sortedRunCards(set, beanieRank) {
  if (set.type !== 'RUN') return set.cards;

  const nonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return set.cards;

  const sortedNB = [...nonBeanies].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );
  const suit = sortedNB[0].suit;

  // Pre-compute gap indices from non-beanies
  const gapIdxs = [];
  for (let i = 1; i < sortedNB.length; i++) {
    const f = RANK_ORDER.indexOf(sortedNB[i - 1].rank);
    const t = RANK_ORDER.indexOf(sortedNB[i].rank);
    for (let g = f + 1; g < t; g++) gapIdxs.push(g);
  }

  // Effective rank index for any card (non-beanie, override beanie, or gap beanie)
  const beanieCards = set.cards.filter(c => c.rank === beanieRank);
  function effectiveIdx(card) {
    if (card.rank !== beanieRank) return RANK_ORDER.indexOf(card.rank);
    if (set.beanieOverrides?.[card.id]) {
      return RANK_ORDER.indexOf(set.beanieOverrides[card.id].rank);
    }
    // Gap beanie: position by order among beanie cards
    const pos = beanieCards.findIndex(c => c.id === card.id);
    return pos < gapIdxs.length ? gapIdxs[pos] : 999;
  }

  return [...set.cards].sort((a, b) => effectiveIdx(a) - effectiveIdx(b));
}

// ─── Beanie count in public sets ─────────────────────────────────────────────

function beaniesInPlay(publicSets, beanieRank) {
  let count = 0;
  publicSets.forEach(s => s.cards.forEach(c => { if (c.rank === beanieRank) count++; }));
  return count;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GameScreen({ game, myId, isMyTurn, timer, error, notice, actions }) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [mode, setMode]                   = useState('normal');
  const [beanieChoice, setBeanieChoice]   = useState(null);
  // beanieChoice shape: { cardIds, options: [{ label, overrides }] }

  const myPlayer    = game.players.find(p => p.id === myId);
  const myHand      = myPlayer?.hand || [];
  const myHasSet    = myPlayer?.hasLaidSet || false;
  const inDraw      = game.phase === 'DRAW';
  const inAction    = game.phase === 'ACTION';
  const beanieCount = beaniesInPlay(game.publicSets, game.beanieRank);
  const isHost      = game.players[0]?.id === myId;

  function toggleCard(cardId) {
    if (mode === 'steal') {
      // In steal mode only one replacement card can be selected at a time
      setSelectedCards(prev => prev.includes(cardId) ? [] : [cardId]);
    } else {
      setSelectedCards(prev =>
        prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
      );
    }
  }

  function clearSelection() {
    setSelectedCards([]);
    setMode('normal');
  }

  // ─── Lay set ───────────────────────────────────────────────────────────────

  function handleLaySet() {
    if (selectedCards.length < 3) return;

    const cards      = selectedCards.map(id => myHand.find(c => c.id === id)).filter(Boolean);
    const beanies    = cards.filter(c => c.rank === game.beanieRank);
    const nonBeanies = cards.filter(c => c.rank !== game.beanieRank);

    // If there are Beanies and all non-Beanies share a suit → could be a run
    const allSameSuit = nonBeanies.length > 0 &&
      nonBeanies.every(c => c.suit === nonBeanies[0].suit);

    if (beanies.length > 0 && allSameSuit) {
      const result = buildRunOptions(cards, game.beanieRank);
      if (result) {
        const { gapOverrides, options, solo } = result;
        if (!options) {
          // Only one valid arrangement (or all gap Beanies) — lay immediately
          actions.layDownSet(selectedCards, solo ? solo.overrides : gapOverrides);
          clearSelection();
        } else {
          // Multiple valid arrangements — ask the user to pick
          setBeanieChoice({ cardIds: selectedCards, options });
        }
        return;
      }
    }

    // Set of kind or no Beanies
    actions.layDownSet(selectedCards, {});
    clearSelection();
  }

  // ─── Steal Beanie ──────────────────────────────────────────────────────────

  function handleStealBeanie(setIndex, beanieCardId) {
    if (selectedCards.length !== 1) return;
    actions.stealBeanie(setIndex, selectedCards[0], beanieCardId);
    clearSelection();
    setMode('normal');
  }

  // Pre-compute which (setIndex, beanieCard) pairs are stealable with the selected card
  const selectedCard = selectedCards.length === 1
    ? myHand.find(c => c.id === selectedCards[0]) : null;

  function isStealable(set, beanieCard) {
    return !!selectedCard && canStealBeanie(selectedCard, set, beanieCard, game.beanieRank);
  }

  // True if any opponent set has a Beanie (determines whether Steal button appears —
  // acts as an alert so players don't miss a steal opportunity, even if their hand
  // can't currently complete it)
  const hasOpponentBeanies = game.publicSets.some(
    s => s.playerId !== myId && s.cards.some(c => c.rank === game.beanieRank)
  );

  // True in steal mode: the currently selected hand card can swap with at least one Beanie
  const hasAnyStealableBeanie = mode === 'steal' && selectedCards.length === 1 &&
    game.publicSets.some(
      s => s.playerId !== myId && s.cards.some(c => c.rank === game.beanieRank && isStealable(s, c))
    );

  // In steal mode: which hand cards can steal ANY Beanie (used to highlight them)
  function cardCanStealSomething(handCard) {
    return mode === 'steal' && game.publicSets.some(
      s => s.playerId !== myId && s.cards.some(
        c => c.rank === game.beanieRank && canStealBeanie(handCard, s, c, game.beanieRank)
      )
    );
  }

  // True in steal mode: at least one hand card can steal (used to tailor instructions)
  const hasSomeStealableHandCard = mode === 'steal' && myHand.some(cardCanStealSomething);

  // True when a single Beanie card from hand is selected — triggers addBeanieToSet UX
  const isAddingBeanie = selectedCards.length === 1 &&
    myHand.find(c => c.id === selectedCards[0])?.rank === game.beanieRank;

  // ─── Discard ───────────────────────────────────────────────────────────────

  function handleDiscard() {
    if (selectedCards.length !== 1) return;
    actions.discard(selectedCards[0]);
    clearSelection();
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const timerUrgent   = timer && timer.seconds <= 10;

  return (
    <div className="game-screen">

      {/* Top bar */}
      <div className="game-topbar">
        <div className="round-badge">Round {game.round} of 13</div>
        {timer && isMyTurn ? (
          <div className={`timer-badge${timerUrgent ? ' urgent' : ''}`}>⏱ {timer.seconds}s</div>
        ) : timer ? (
          <div className="timer-badge">⏱ {timer.seconds}s</div>
        ) : null}
        {isHost && (
          <button
            className="btn-exit"
            onClick={() => {
              if (window.confirm('Cancel the game? Scores will not be saved.')) actions.exitGame();
            }}
          >
            Exit
          </button>
        )}
      </div>

      {/* Player chips */}
      <div className="player-chips">
        {game.players.map((p, i) => (
          <div
            key={p.id}
            className={`pchip${game.currentPlayerIndex === i ? ' active' : ''}`}
            style={game.currentPlayerIndex === i ? { borderColor: PLAYER_COLOURS[i] } : {}}
          >
            <div className="pchip-name">{p.id === myId ? 'You' : p.name}</div>
            <div className="pchip-score">{p.totalScore}</div>
            <div className="pchip-dot" style={{ background: PLAYER_COLOURS[i] }} />
          </div>
        ))}
      </div>

      {/* Beanie banner */}
      <div className="beanie-bar">
        <div>
          <div className="beanie-bar-label">Beanie this round</div>
          <div className="beanie-bar-val">{game.beanieRank}s are wild</div>
        </div>
        <div className="beanie-bar-cards">
          {Array.from({ length: 4 }).map((_, i) => (
            i < beanieCount
              ? <Card key={i} card={{ id: `b${i}`, rank: game.beanieRank, suit: '★' }} beanieRank={game.beanieRank} size="sm" />
              : <EmptyCard key={i} size="sm" />
          ))}
        </div>
      </div>

      {/* Notices */}
      {notice && <div className="notice-toast">{notice}</div>}
      {error  && <div className="error-toast" style={{ margin: 0 }}>{error}</div>}

      {/* Public sets — grouped per player, each row scrolls horizontally */}
      <div className="public-area">
        <div className="public-area-label">Sets on table</div>
        {game.publicSets.length === 0 ? (
          <div className="set-empty">No sets yet</div>
        ) : (() => {
          // Group sets by player, preserving original indices for server calls
          const indexed = game.publicSets.map((set, si) => ({ set, si }));
          const groups = game.players
            .map((p, pi) => ({
              player: p, playerIdx: pi,
              entries: indexed.filter(({ set }) => set.playerId === p.id),
            }))
            .filter(g => g.entries.length > 0);

          return groups.map((group, gi) => {
            const isOwnGroup = group.player.id === myId;
            return (
              <div key={group.player.id}>
                {gi > 0 && <div className="player-sets-divider" />}
                <div className="player-sets-group">
                  <div className="player-sets-header">
                    <span className="player-sets-dot" style={{ background: PLAYER_COLOURS[group.playerIdx] }} />
                    {isOwnGroup ? 'You' : group.player.name}
                  </div>
                  <div className="player-sets-scroll">
                    {group.entries.map(({ set, si }) => {
                      const isOwnSet      = set.playerId === myId;
                      const isAddable     = myHasSet && isMyTurn && inAction && mode !== 'steal' && selectedCards.length > 0;
                      const isStealTarget = mode === 'steal' && !isOwnSet && isMyTurn && inAction;
                      const boxClass = `set-box${isAddable ? ' addable' : ''}${isStealTarget ? ' steal-target' : ''}`;
                      return (
                        <div key={si} className={boxClass}>
                          {sortedRunCards(set, game.beanieRank).map(c => {
                            let beanieLabel = null;
                            if (c.rank === game.beanieRank && set.type === 'RUN') {
                              if (set.beanieOverrides?.[c.id]) {
                                const o = set.beanieOverrides[c.id];
                                beanieLabel = `${o.rank}${o.suit}`;
                              } else {
                                beanieLabel = computeGapLabel(c, set.cards, game.beanieRank);
                              }
                            }
                            const isBeanie = c.rank === game.beanieRank;
                            const isStealableBeanie = isStealTarget && isBeanie && isStealable(set, c);
                            return (
                              <div key={c.id} style={{ position: 'relative', display: 'inline-block' }}>
                                <Card
                                  card={c}
                                  beanieRank={game.beanieRank}
                                  size="sm"
                                  onClick={isStealableBeanie ? () => handleStealBeanie(si, c.id) : undefined}
                                />
                                {beanieLabel && <span className="beanie-badge">{beanieLabel}</span>}
                                {isStealableBeanie && <span className="steal-pulse" />}
                              </div>
                            );
                          })}
                          {isAddable && (
                            <button
                              className="set-add-btn"
                              style={isAddingBeanie ? { background: 'var(--gold)', color: '#1a1200' } : {}}
                              onClick={() => {
                                if (isAddingBeanie) {
                                  actions.addBeanieToSet(si, selectedCards[0]);
                                } else {
                                  actions.addToSet(si, selectedCards);
                                }
                                clearSelection();
                              }}
                            >{isAddingBeanie ? '★' : '+'}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Draw / Discard piles — highlighted draw zone when it's your turn to draw */}
      {isMyTurn && inDraw ? (
        <div className="draw-zone">
          <div className="draw-zone-label">✦ Draw a card to begin your turn</div>
          <div className="pile-row">
            <div className="pile-wrap">
              <Card
                card={{ id: 'back', rank: 'back', suit: '' }}
                beanieRank={null}
                size="md"
                onClick={actions.drawFromPile}
              />
              <div className="pile-label">Draw ({game.drawPileCount})</div>
            </div>
            <div className="pile-arrow">or</div>
            <div className="pile-wrap">
              {game.discardTop
                ? <Card
                    card={game.discardTop}
                    beanieRank={game.beanieRank}
                    size="md"
                    onClick={actions.drawFromDiscard}
                  />
                : <EmptyCard size="md" />
              }
              <div className="pile-label">Discard</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pile-row">
          <div className="pile-wrap">
            <Card
              card={{ id: 'back', rank: 'back', suit: '' }}
              beanieRank={null}
              size="md"
              disabled
            />
            <div className="pile-label">Draw ({game.drawPileCount})</div>
          </div>
          <div className="pile-arrow">→</div>
          <div className="pile-wrap">
            {game.discardTop
              ? <Card
                  card={game.discardTop}
                  beanieRank={game.beanieRank}
                  size="md"
                  onClick={isMyTurn && inDraw ? actions.drawFromDiscard : undefined}
                  disabled={!isMyTurn || !inDraw}
                />
              : <EmptyCard size="md" />
            }
            <div className="pile-label">Discard</div>
          </div>
        </div>
      )}

      {/* Your hand */}
      <div className="hand-area">
        <div className="hand-label">
          Your hand ({myHand.length} card{myHand.length !== 1 ? 's' : ''})
          {selectedCards.length > 0 && ` · ${selectedCards.length} selected`}
        </div>
        <div className="hand-scroll">
          {myHand.map(c => (
            <Card
              key={c.id}
              card={c}
              beanieRank={game.beanieRank}
              size="xl"
              selected={selectedCards.includes(c.id)}
              onClick={isMyTurn && inAction ? () => toggleCard(c.id) : undefined}
              disabled={!isMyTurn || !inAction}
              className={cardCanStealSomething(c) ? 'steal-capable-card' : ''}
            />
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {isMyTurn ? (
        <div className="action-area">
          {inAction && (
            mode === 'steal' ? (
              /* Steal mode: select replacement card first, then tap pulsing Beanie */
              <div className="action-row" style={{ flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'center' }}>
                  {selectedCards.length === 0
                    ? hasSomeStealableHandCard
                      ? '✦ Tap a gold card from your hand to use as replacement'
                      : "None of your current cards can replace a Beanie"
                    : hasAnyStealableBeanie
                      ? 'Tap a pulsing ★ Beanie on the table to steal it'
                      : "That card can't replace any Beanie — try another"}
                </div>
                <button className="btn-sm btn-sm-secondary" onClick={clearSelection}>
                  Cancel
                </button>
              </div>
            ) : (
              /* Normal action mode */
              <>
                {selectedCards.length === 0 && (
                  <div className="turn-banner">
                    {!game.roundFirstTurnDone
                      ? 'You have 8 cards — lay a set or discard one to start the pile'
                      : 'Select cards from your hand to play or discard'}
                  </div>
                )}
                {selectedCards.length > 0 && (
                  <div className="action-row">
                    {selectedCards.length >= 3 && (
                      <button className="btn-sm btn-sm-primary" onClick={handleLaySet}>
                        Lay set ({selectedCards.length})
                      </button>
                    )}
                    {selectedCards.length === 1 && !isAddingBeanie && (
                      <button className="btn-sm btn-sm-danger" onClick={handleDiscard}>
                        Discard
                      </button>
                    )}
                    <button className="btn-sm btn-sm-secondary" onClick={clearSelection}>
                      Clear
                    </button>
                  </div>
                )}
                {/* Steal Beanie — visible whenever opponent has beanies and player has laid a set */}
                {myHasSet && hasOpponentBeanies && (
                  <div style={{ textAlign: 'center', marginTop: selectedCards.length > 0 ? 6 : 0 }}>
                    <button
                      className="btn-sm btn-sm-gold"
                      onClick={() => { clearSelection(); setMode('steal'); }}
                    >
                      Steal Beanie ★
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      ) : (
        <div className="not-your-turn">{currentPlayer?.name}'s turn</div>
      )}

      {/* Beanie run-arrangement picker */}
      {beanieChoice && (
        <div className="beanie-choice-backdrop">
          <div className="beanie-choice-sheet">
            <div className="beanie-choice-title">Where does the Beanie go?</div>
            <div className="beanie-choice-sub">Choose the run arrangement</div>
            <div className="beanie-choice-btns">
              {beanieChoice.options.map((opt, i) => (
                <button
                  key={i}
                  className="btn-sm btn-sm-secondary"
                  onClick={() => {
                    actions.layDownSet(beanieChoice.cardIds, opt.overrides);
                    setBeanieChoice(null);
                    clearSelection();
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              className="btn-sm btn-sm-secondary"
              style={{ opacity: 0.5, marginTop: 4 }}
              onClick={() => setBeanieChoice(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
