import { useState, useEffect, useRef } from 'react';
import Card, { EmptyCard } from '../components/Card';

const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];
const RANK_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_ORDER = ['♠','♥','♦','♣'];

// ─── Audio engine (module-level, lazy AudioContext) ───────────────────────────

let _actx = null;
function _audio() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}

/** Card slap + low pitch-drop thud on discard */
function playThwack(muted) {
  if (muted) return;
  try {
    const ctx = _audio(); const now = ctx.currentTime;
    // Noise burst
    const n = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(lpf); lpf.connect(g); g.connect(ctx.destination); src.start(now);
    // Pitch-drop thud
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.28, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(og); og.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);
  } catch {}
}

/** Ascending shimmer chord when a set is laid */
function playShimmer(muted) {
  if (muted) return;
  try {
    const ctx = _audio(); const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.45);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.5);
    });
  } catch {}
}

/** Soft tick on turn change */
function playTick(muted) {
  if (muted) return;
  try {
    const ctx = _audio(); const now = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now); osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g); g.connect(ctx.destination); osc.start(now); osc.stop(now + 0.07);
  } catch {}
}

/** Soft descending two-note interval on round draw — neutral, conclusive */
function playDraw(muted) {
  if (muted) return;
  try {
    const ctx = _audio(); const now = ctx.currentTime;
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

/** Rising 3-note fanfare + sustained chord on round win */
function playFanfare(muted) {
  if (muted) return;
  try {
    const ctx = _audio(); const now = ctx.currentTime;
    // Three quick rising notes: C5 → E5 → G5
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.07 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.2);
    });
    // Sustained C major chord
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain();
      const t = now + 0.21;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.22 : 0.16, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.75);
    });
  } catch {}
}

/** Short whoosh per card dealt */
function playWhoosh(muted, delay = 0) {
  if (muted) return;
  try {
    const ctx = _audio();
    const now = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(lpf); lpf.connect(g); g.connect(ctx.destination); src.start(now);
  } catch {}
}

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

// ─── Can selected cards be added to a set? ───────────────────────────────────

/**
 * Quick client-side check: do the selected cards fit the given set?
 * Prevents the + button appearing on mismatched sets.
 * The server still does full validation — this just hides obviously wrong buttons.
 *
 * SET type: every non-Beanie selected card must match the set's rank.
 * RUN type: every non-Beanie selected card must match the run's suit.
 */
function canAddCardsToSet(cardIds, set, hand, beanieRank) {
  const cards = cardIds.map(id => hand.find(c => c.id === id)).filter(Boolean);
  if (cards.length === 0) return false;

  const setNonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (setNonBeanies.length === 0) return true; // all-Beanie set — let server decide

  if (set.type === 'SET') {
    const setRank = setNonBeanies[0].rank;
    // All selected cards must be Beanies or share the set's rank
    return cards.every(c => c.rank === beanieRank || c.rank === setRank);
  }

  if (set.type === 'RUN') {
    const runSuit = setNonBeanies[0].suit;
    // All selected cards must be Beanies or share the run's suit
    return cards.every(c => c.rank === beanieRank || c.suit === runSuit);
  }

  return true;
}

// ─── Add Beanie to RUN: compute valid extension directions ───────────────────

/**
 * For a RUN set, returns which ends can be extended with a new Beanie.
 * Returns { options: [{ label, override }] } — 1 or 2 options.
 * Returns null for SET type (no direction needed).
 * Returns { error: 'full' } if neither end can be extended.
 */
function computeAddBeanieOptions(set, beanieRank) {
  if (set.type === 'SET') {
    // Only 4 suits exist — once all 4 cards are down, no room for another
    return set.cards.length >= 4 ? { error: 'full' } : null;
  }

  const nonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return { error: 'full' };

  const runSuit  = nonBeanies[0].suit;
  const sortedNB = [...nonBeanies].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  // Pre-compute gap positions
  const gapIdxs = [];
  for (let i = 1; i < sortedNB.length; i++) {
    const lo = RANK_ORDER.indexOf(sortedNB[i - 1].rank);
    const hi = RANK_ORDER.indexOf(sortedNB[i].rank);
    for (let g = lo + 1; g < hi; g++) gapIdxs.push(g);
  }

  // Effective range including existing beanies with known positions
  const overrides = set.beanieOverrides || {};
  let gapPos = 0;
  let minIdx  = RANK_ORDER.indexOf(sortedNB[0].rank);
  let maxIdx  = RANK_ORDER.indexOf(sortedNB[sortedNB.length - 1].rank);

  for (const b of set.cards.filter(c => c.rank === beanieRank)) {
    let idx;
    if (overrides[b.id]) {
      idx = RANK_ORDER.indexOf(overrides[b.id].rank);
    } else if (gapPos < gapIdxs.length) {
      idx = gapIdxs[gapPos++];
    } else {
      continue; // legacy end beanie with no override — skip
    }
    minIdx = Math.min(minIdx, idx);
    maxIdx = Math.max(maxIdx, idx);
  }

  const canExtendHigh = maxIdx < 12; // K is index 12
  const canExtendLow  = minIdx > 0;  // A is index 0

  if (!canExtendHigh && !canExtendLow) return { error: 'full' };

  const options = [];
  if (canExtendHigh) {
    const rank = RANK_ORDER[maxIdx + 1];
    options.push({ label: `${rank}${runSuit}`, override: { rank, suit: runSuit } });
  }
  if (canExtendLow) {
    const rank = RANK_ORDER[minIdx - 1];
    options.push({ label: `${rank}${runSuit}`, override: { rank, suit: runSuit } });
  }
  return { options };
}

// ─── Beanie count in public sets ─────────────────────────────────────────────

function beaniesInPlay(publicSets, beanieRank) {
  let count = 0;
  publicSets.forEach(s => s.cards.forEach(c => { if (c.rank === beanieRank) count++; }));
  return count;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GameScreen({ game, myId, isMyTurn, timer, error, notice, actions }) {
  const [selectedCards, setSelectedCards]     = useState([]);
  const [mode, setMode]                       = useState('normal');
  const [beanieChoice, setBeanieChoice]       = useState(null);
  const [addBeanieChoice, setAddBeanieChoice] = useState(null);
  const [sortMode, setSortMode]               = useState('deal');
  const [showExitModal, setShowExitModal]     = useState(false);
  // beanieChoice shape:    { cardIds, options: [{ label, overrides }] }
  // addBeanieChoice shape: { setIndex, cardId, options: [{ label, override }] }

  // ─── Animation + audio state ───────────────────────────────────────────────
  const [muted, setMuted]                       = useState(() => {
    try { return localStorage.getItem('beanie_muted') === 'true'; } catch { return false; }
  });
  const [discardingCardId, setDiscardingCardId] = useState(null);  // card flying to discard pile
  const [layingCardIds, setLayingCardIds]       = useState([]);    // cards lifting to table
  const [dealAnim, setDealAnim]                 = useState(false); // deal-in animation active

  const prevRoundRef     = useRef(null);
  const prevStatusRef    = useRef(null);
  const prevPlayerIdxRef = useRef(null);

  const myPlayer    = game.players.find(p => p.id === myId);
  const myHand      = myPlayer?.hand || [];
  const sortedHand  = sortMode === 'rank'
    ? [...myHand].sort((a, b) => {
        const ri = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
        if (ri !== 0) return ri;
        return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
      })
    : myHand;
  const myHasSet    = myPlayer?.hasLaidSet || false;
  // The 8-card first player starts in ACTION phase — they don't need to draw.
  // If the server's stored phase is ever DRAW for them (e.g. stale state after
  // a server restart), we still show them the ACTION UI so they can play normally.
  const is8CardStart = myHand.length >= 8 && myPlayer && !myPlayer.firstTurnDone;
  const inDraw      = game.phase === 'DRAW' && !is8CardStart;
  const inAction    = game.phase === 'ACTION' || is8CardStart;
  const beanieCount = beaniesInPlay(game.publicSets, game.beanieRank);
  const isHost      = game.players[0]?.id === myId;

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem('beanie_muted', String(next)); } catch {}
  }

  /** Animate selected cards lifting to table, then fire server action */
  function animateThenLay(cardIds, overrides) {
    playShimmer(muted);
    setLayingCardIds(cardIds);
    const snap = [...cardIds];
    setTimeout(() => {
      actions.layDownSet(snap, overrides);
      setLayingCardIds([]);
    }, 380);
  }

  // Round end sound: fanfare for a winner, soft draw tone for a draw
  useEffect(() => {
    if (game.status === 'ROUND_END' && prevStatusRef.current === 'PLAYING') {
      if (game.roundWinner) playFanfare(muted);
      else                  playDraw(muted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status]);

  // Deal animation: fires on round start or game start
  useEffect(() => {
    const roundChanged = game.round !== prevRoundRef.current;
    const justStarted  = game.status === 'PLAYING' && prevStatusRef.current !== 'PLAYING';
    if (game.status === 'PLAYING' && (roundChanged || justStarted)) {
      setDealAnim(true);
      for (let i = 0; i < 7; i++) playWhoosh(muted, (i * 0.085) + 0.06);
      setTimeout(() => setDealAnim(false), 7 * 85 + 260 + 150);
    }
    prevRoundRef.current  = game.round;
    prevStatusRef.current = game.status;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.round, game.status]);

  // Turn-change: play tick when current player rotates
  useEffect(() => {
    if (
      prevPlayerIdxRef.current !== null &&
      prevPlayerIdxRef.current !== game.currentPlayerIndex &&
      game.status === 'PLAYING'
    ) {
      playTick(muted);
    }
    prevPlayerIdxRef.current = game.currentPlayerIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.currentPlayerIndex, game.status]);

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

    const cardIds    = [...selectedCards];
    const cards      = cardIds.map(id => myHand.find(c => c.id === id)).filter(Boolean);
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
          // Only one valid arrangement — animate then lay
          animateThenLay(cardIds, solo ? solo.overrides : gapOverrides);
          clearSelection();
        } else {
          // Multiple arrangements — show picker (modal handles animation)
          setBeanieChoice({ cardIds, options });
        }
        return;
      }
    }

    // Set of kind or no Beanies — animate then lay
    animateThenLay(cardIds, {});
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

  // True in steal mode: the currently selected hand card can swap with at least one Beanie
  const hasAnyStealableBeanie = mode === 'steal' && selectedCards.length === 1 &&
    game.publicSets.some(
      s => s.playerId !== myId && s.cards.some(c => c.rank === game.beanieRank && isStealable(s, c))
    );

  // Returns true if handCard can steal ANY Beanie from any opponent set
  function cardCanStealAnyBeanie(handCard) {
    return game.publicSets.some(
      s => s.playerId !== myId && s.cards.some(
        c => c.rank === game.beanieRank && canStealBeanie(handCard, s, c, game.beanieRank)
      )
    );
  }

  // In steal mode: used to add gold ring to eligible hand cards
  function cardCanStealSomething(handCard) {
    return mode === 'steal' && cardCanStealAnyBeanie(handCard);
  }

  // True when at least one hand card can actually steal an opponent's Beanie.
  // Used for both: button visibility AND steal mode instruction text.
  const hasSomeStealableHandCard = myHand.some(cardCanStealAnyBeanie);

  // True when a single Beanie card from hand is selected — triggers addBeanieToSet UX
  const isAddingBeanie = selectedCards.length === 1 &&
    myHand.find(c => c.id === selectedCards[0])?.rank === game.beanieRank;

  // ─── Discard ───────────────────────────────────────────────────────────────

  function handleDiscard() {
    if (selectedCards.length !== 1) return;
    const cardId = selectedCards[0];
    setDiscardingCardId(cardId);
    clearSelection();
    // Thwack at 120ms (lands as the card "hits" the pile)
    setTimeout(() => playThwack(muted), 120);
    // Fire server after animation completes
    setTimeout(() => {
      actions.discard(cardId);
      setDiscardingCardId(null);
    }, 380);
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const timerUrgent   = timer && timer.seconds <= 10;

  return (
    <div className="game-screen">

      {/* Exit confirmation modal */}
      {showExitModal && (
        <div className="exit-modal-overlay" onClick={() => setShowExitModal(false)}>
          <div className="exit-modal" onClick={e => e.stopPropagation()}>
            <div className="exit-modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"/>
                <polyline points="17 8 21 12 17 16"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div className="exit-modal-title">End the game?</div>
            <div className="exit-modal-body">
              This will cancel the game for all players.<br/>Scores will not be saved.
            </div>
            <div className="exit-modal-actions">
              <button className="exit-modal-confirm" onClick={actions.exitGame}>
                End game
              </button>
              <button className="exit-modal-cancel" onClick={() => setShowExitModal(false)}>
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <div className="round-badge">Round {game.round} of 13</div>
        {timer && isMyTurn ? (
          <div className={`timer-badge${timerUrgent ? ' urgent' : ''}`}>⏱ {timer.seconds}s</div>
        ) : timer ? (
          <div className="timer-badge">⏱ {timer.seconds}s</div>
        ) : null}
        {/* Mute toggle */}
        <button className={`btn-mute${muted ? ' muted' : ''}`} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
          {muted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          )}
        </button>
        {isHost && (
          <button className="btn-exit" onClick={() => setShowExitModal(true)}>
            Exit
          </button>
        )}
      </div>

      {/* Left column — in landscape this becomes the left panel */}
      <div className="ls-left">

      {/* Player chips — key changes when a player becomes active so CSS animation re-fires */}
      <div className="player-chips">
        {game.players.map((p, i) => (
          <div
            key={game.currentPlayerIndex === i ? `active-${game.currentPlayerIndex}` : p.id}
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
                      // For addBeanieToSet: compute whether this set can accept a Beanie
                      const beanieExt     = isAddingBeanie ? computeAddBeanieOptions(set, game.beanieRank) : null;
                      const beanieAddable = !isAddingBeanie || beanieExt === null || (beanieExt.options && beanieExt.options.length > 0);
                      // For regular add: check selected cards actually fit this set
                      const cardsAddable  = isAddingBeanie || canAddCardsToSet(selectedCards, set, myHand, game.beanieRank);
                      const isAddable     = myHasSet && isMyTurn && inAction && mode !== 'steal' && selectedCards.length > 0 && beanieAddable && cardsAddable;
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
                                  if (beanieExt === null) {
                                    // SET type — no direction needed
                                    actions.addBeanieToSet(si, selectedCards[0], null);
                                    clearSelection();
                                  } else if (beanieExt.options.length === 1) {
                                    // Only one valid direction — auto-place
                                    actions.addBeanieToSet(si, selectedCards[0], beanieExt.options[0].override);
                                    clearSelection();
                                  } else {
                                    // Two valid directions — ask player
                                    setAddBeanieChoice({ setIndex: si, cardId: selectedCards[0], options: beanieExt.options });
                                  }
                                } else {
                                  actions.addToSet(si, selectedCards);
                                  clearSelection();
                                }
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

      </div>{/* /ls-left */}

      {/* Right column — in landscape this becomes the piles panel */}
      <div className="ls-right">

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

      </div>{/* /ls-right */}

      {/* Your hand */}
      <div className="hand-area">
        <div className="hand-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            Your hand ({myHand.length} card{myHand.length !== 1 ? 's' : ''})
            {selectedCards.length > 0 && ` · ${selectedCards.length} selected`}
          </span>
          <div className="sort-toggle">
            <span
              className={`sort-seg${sortMode === 'deal' ? ' sort-seg-active' : ''}`}
              onClick={() => setSortMode('deal')}
            >Deal</span>
            <span
              className={`sort-seg${sortMode === 'rank' ? ' sort-seg-active' : ''}`}
              onClick={() => setSortMode('rank')}
            >A→K</span>
          </div>
        </div>
        <div className="hand-scroll">
          {sortedHand.map((c, ci) => (
            <Card
              key={c.id}
              card={c}
              beanieRank={game.beanieRank}
              size="xl"
              selected={selectedCards.includes(c.id)}
              onClick={isMyTurn && inAction ? () => toggleCard(c.id) : undefined}
              disabled={!isMyTurn || !inAction}
              className={[
                cardCanStealSomething(c)      ? 'steal-capable-card' : '',
                discardingCardId === c.id     ? 'card-discarding'    : '',
                layingCardIds.includes(c.id)  ? 'card-laying'        : '',
                dealAnim                      ? 'card-dealing'       : '',
              ].filter(Boolean).join(' ')}
              style={dealAnim ? { animationDelay: `${ci * 80}ms` } : undefined}
            />
          ))}
        </div>
      </div>

      {/* Bottom bar — in landscape this spans full width below the hand */}
      <div className="ls-bottom">

      {/* Draw vote notice — visible to all when someone has proposed ending the round */}
      {(game.drawVotes || []).length > 0 && (
        <div className="draw-vote-bar">
          {(game.drawVotes || [])
            .map(id => game.players.find(p => p.id === id)?.name || '?')
            .join(', ')}{' '}
          {(game.drawVotes || []).length === 1 ? 'has' : 'have'} proposed ending this round
          {(game.drawVotes || []).length < game.players.length &&
            ` (${game.drawVotes.length}/${game.players.length} agreed)`}
        </div>
      )}

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
                    {myHand.length === 8 && !myPlayer?.firstTurnDone
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
                    {selectedCards.length === 1 && (
                      <button className="btn-sm btn-sm-danger" onClick={handleDiscard}>
                        Discard
                      </button>
                    )}
                    <button className="btn-sm btn-sm-secondary" onClick={clearSelection}>
                      Clear
                    </button>
                  </div>
                )}
                {/* Steal Beanie — only visible when player has a card that can actually steal */}
                {myHasSet && hasSomeStealableHandCard && (
                  <div style={{ textAlign: 'center', marginTop: selectedCards.length > 0 ? 6 : 0 }}>
                    <button
                      className="btn-sm btn-sm-gold"
                      onClick={() => { clearSelection(); setMode('steal'); }}
                    >
                      Steal Beanie ★
                    </button>
                  </div>
                )}
                {/* End Round — propose or agree to a draw */}
                {game.players.some(p => p.firstTurnDone) && (
                  <div style={{ textAlign: 'center', marginTop: 6 }}>
                    <button
                      className="btn-sm btn-sm-secondary"
                      style={{ opacity: 0.65, fontSize: 11 }}
                      onClick={actions.declareDraw}
                    >
                      {(game.drawVotes || []).includes(myId)
                        ? 'Cancel End Round vote'
                        : (game.drawVotes || []).length > 0
                          ? `Agree to End Round (${game.drawVotes.length}/${game.players.length})`
                          : 'End Round'}
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

      </div>{/* /ls-bottom */}

      {/* Add Beanie to RUN — direction picker */}
      {addBeanieChoice && (
        <div className="beanie-choice-backdrop">
          <div className="beanie-choice-sheet">
            <div className="beanie-choice-title">Which rank does the Beanie become?</div>
            <div className="beanie-choice-sub">Choose how to extend the run</div>
            <div className="beanie-choice-btns">
              {addBeanieChoice.options.map((opt, i) => (
                <button
                  key={i}
                  className="btn-sm btn-sm-secondary"
                  onClick={() => {
                    actions.addBeanieToSet(addBeanieChoice.setIndex, addBeanieChoice.cardId, opt.override);
                    setAddBeanieChoice(null);
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
              onClick={() => setAddBeanieChoice(null)}
            >
              Cancel
            </button>
          </div>
        </div>
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
