// gameHelpers.js — Client-side game logic helpers extracted from GameScreen
// These functions handle run/Beanie analysis and set validation for the UI.
// The server still does full authoritative validation — these just drive the UI.

import { RANK_ORDER } from './constants';

/**
 * For a potential RUN set with Beanies, compute every valid run arrangement.
 * Returns null if no Beanies are end-ambiguous (can lay immediately).
 * Returns { gapOverrides, options, solo } otherwise.
 */
export function buildRunOptions(cards, beanieRank) {
  const beanies    = cards.filter(c => c.rank === beanieRank);
  const nonBeanies = cards.filter(c => c.rank !== beanieRank);
  if (!beanies.length || !nonBeanies.length) return null;

  const sorted  = [...nonBeanies].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
  const suit    = sorted[0].suit;
  const lowIdx  = RANK_ORDER.indexOf(sorted[0].rank);
  const highIdx = RANK_ORDER.indexOf(sorted[sorted.length - 1].rank);

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

  if (!endBeanies.length) return { gapOverrides, options: null };

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
 * Given a Beanie card in a laid RUN set, compute what rank it represents from context.
 */
export function computeGapLabel(card, setCards, beanieRank) {
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

/**
 * Returns true if replacementCard can validly swap in for beanieCard in set.
 */
export function canStealBeanie(replacementCard, set, beanieCard, beanieRank) {
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

    let effectiveRank = null;
    if (set.beanieOverrides?.[beanieCard.id]) {
      effectiveRank = set.beanieOverrides[beanieCard.id].rank;
    } else {
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

/**
 * For a RUN publicSet, return cards sorted by their effective rank for display.
 */
export function sortedRunCards(set, beanieRank) {
  if (set.type !== 'RUN') return set.cards;

  const nonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return set.cards;

  const sortedNB = [...nonBeanies].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  );

  const gapIdxs = [];
  for (let i = 1; i < sortedNB.length; i++) {
    const f = RANK_ORDER.indexOf(sortedNB[i - 1].rank);
    const t = RANK_ORDER.indexOf(sortedNB[i].rank);
    for (let g = f + 1; g < t; g++) gapIdxs.push(g);
  }

  const beanieCards = set.cards.filter(c => c.rank === beanieRank);
  function effectiveIdx(card) {
    if (card.rank !== beanieRank) return RANK_ORDER.indexOf(card.rank);
    if (set.beanieOverrides?.[card.id]) {
      return RANK_ORDER.indexOf(set.beanieOverrides[card.id].rank);
    }
    const pos = beanieCards.findIndex(c => c.id === card.id);
    return pos < gapIdxs.length ? gapIdxs[pos] : 999;
  }

  return [...set.cards].sort((a, b) => effectiveIdx(a) - effectiveIdx(b));
}

/**
 * Quick client-side check: do the selected cards fit the given set?
 * Prevents the + button appearing on mismatched sets.
 */
export function canAddCardsToSet(cardIds, set, hand, beanieRank) {
  const cards = cardIds.map(id => hand.find(c => c.id === id)).filter(Boolean);
  if (cards.length === 0) return false;

  const setNonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (setNonBeanies.length === 0) return true;

  if (set.type === 'SET') {
    const setRank = setNonBeanies[0].rank;
    return cards.every(c => c.rank === beanieRank || c.rank === setRank);
  }

  if (set.type === 'RUN') {
    const runSuit = setNonBeanies[0].suit;
    return cards.every(c => c.rank === beanieRank || c.suit === runSuit);
  }

  return true;
}

/**
 * For a RUN set, returns which ends can be extended with a new Beanie.
 */
export function computeAddBeanieOptions(set, beanieRank) {
  if (set.type === 'SET') {
    return set.cards.length >= 4 ? { error: 'full' } : null;
  }

  const nonBeanies = set.cards.filter(c => c.rank !== beanieRank);
  if (nonBeanies.length === 0) return { error: 'full' };

  const runSuit  = nonBeanies[0].suit;
  const sortedNB = [...nonBeanies].sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

  const gapIdxs = [];
  for (let i = 1; i < sortedNB.length; i++) {
    const lo = RANK_ORDER.indexOf(sortedNB[i - 1].rank);
    const hi = RANK_ORDER.indexOf(sortedNB[i].rank);
    for (let g = lo + 1; g < hi; g++) gapIdxs.push(g);
  }

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
      continue;
    }
    minIdx = Math.min(minIdx, idx);
    maxIdx = Math.max(maxIdx, idx);
  }

  const canExtendHigh = maxIdx < 12;
  const canExtendLow  = minIdx > 0;

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
