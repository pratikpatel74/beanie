// validator.js — Set validation logic
//
// Two valid set types:
//   SET OF A KIND — min 3, same rank, different suits, max 4
//   RUN           — min 3, consecutive ranks, same suit, no max (but A=1 low only)
//
// Beanies (wild cards) can fill any position in either type.

const RANK_ORDER = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13
};

/**
 * Validate a proposed set of cards.
 * @param {Card[]} cards       — full list of cards in the set
 * @param {string} beanieRank  — e.g. '3'
 * @returns {{ valid: boolean, type: 'SET'|'RUN'|null, error?: string }}
 */
function validateSet(cards, beanieRank) {
  if (!cards || cards.length < 3) {
    return { valid: false, type: null, error: 'Minimum 3 cards required' };
  }

  const beanies    = cards.filter(c => c.rank === beanieRank);
  const nonBeanies = cards.filter(c => c.rank !== beanieRank);

  // Must have at least one non-Beanie to determine set type
  if (nonBeanies.length === 0) {
    return { valid: false, type: null, error: 'A set cannot consist entirely of Beanies' };
  }

  if (_isValidSetOfKind(nonBeanies, beanies.length, cards.length)) {
    return { valid: true, type: 'SET' };
  }

  if (_isValidRun(nonBeanies, beanies.length, cards.length)) {
    return { valid: true, type: 'RUN' };
  }

  return { valid: false, type: null, error: 'Cards do not form a valid set of a kind or run' };
}

/**
 * Validate adding one or more cards to an existing set on the table.
 *
 * For RUN sets the Beanie positions are FIXED by beanieOverrides, so we
 * validate against the actual effective sequence rather than re-running the
 * generic validator (which would incorrectly allow Beanies to be repositioned).
 *
 * @param {Card[]} existingCards      — cards already in the set
 * @param {Card[]} newCards           — cards the player wants to add
 * @param {string} beanieRank
 * @param {Object} beanieOverrides    — { [cardId]: { rank, suit } } from the set
 * @param {string} existingType       — 'SET' | 'RUN' | null
 * @returns {{ valid: boolean, type: 'SET'|'RUN'|null, error?: string }}
 */
function validateAddToSet(existingCards, newCards, beanieRank, beanieOverrides = {}, existingType = null) {
  if (existingType === 'RUN') {
    return _validateAddToRun(existingCards, newCards, beanieRank, beanieOverrides);
  }
  // SET OF A KIND or unknown — generic check on combined cards
  return validateSet([...existingCards, ...newCards], beanieRank);
}

/**
 * For a RUN set, Beanie positions are fixed. New cards must extend the run
 * consecutively at one of the ends — no repositioning of Beanies allowed.
 */
function _validateAddToRun(existingCards, newCards, beanieRank, beanieOverrides) {
  const existingSuit = existingCards.find(c => c.rank !== beanieRank)?.suit;
  if (!existingSuit) return { valid: false, error: 'Cannot determine run suit' };

  // Resolve effective rank value for each existing card
  const effectiveRanks = existingCards.map(c => {
    if (c.rank !== beanieRank) return RANK_ORDER[c.rank];
    const ov = beanieOverrides[c.id];
    return ov ? RANK_ORDER[ov.rank] : null;
  }).filter(r => r !== null);

  if (effectiveRanks.length !== existingCards.length) {
    return { valid: false, error: 'Some Beanie positions are not resolved' };
  }

  effectiveRanks.sort((a, b) => a - b);
  let low  = effectiveRanks[0];
  let high = effectiveRanks[effectiveRanks.length - 1];

  for (const card of newCards) {
    if (card.rank === beanieRank) {
      return { valid: false, error: 'Cannot add a Beanie to a run where positions are already fixed' };
    }
    if (card.suit !== existingSuit) {
      return { valid: false, error: `Card must be ${existingSuit} to extend this run` };
    }
    const rankVal = RANK_ORDER[card.rank];
    if (rankVal === low - 1) {
      low = rankVal;
    } else if (rankVal === high + 1) {
      high = rankVal;
    } else {
      return {
        valid: false,
        error: `${card.rank}${card.suit} does not extend this run consecutively`,
      };
    }
  }

  return { valid: true, type: 'RUN' };
}

// ─── Internal validators ────────────────────────────────────────────────────

function _isValidSetOfKind(nonBeanies, beanieCount, totalCount) {
  // Total cards in a set of a kind: max 4 (one per suit)
  if (totalCount > 4) return false;

  const rank = nonBeanies[0].rank;
  if (!nonBeanies.every(c => c.rank === rank)) return false;

  // No duplicate suits
  const suits = nonBeanies.map(c => c.suit);
  if (new Set(suits).size !== suits.length) return false;

  return true;
}

function _isValidRun(nonBeanies, beanieCount, totalCount) {
  // All non-Beanies must share the same suit
  const suit = nonBeanies[0].suit;
  if (!nonBeanies.every(c => c.suit === suit)) return false;

  // No duplicate ranks among non-Beanies
  const rankVals = nonBeanies.map(c => RANK_ORDER[c.rank]);
  if (new Set(rankVals).size !== rankVals.length) return false;

  rankVals.sort((a, b) => a - b);
  const minR = rankVals[0];
  const maxR = rankVals[rankVals.length - 1];

  // Span covered by non-Beanies (including internal gaps)
  const span          = maxR - minR + 1;
  const internalGaps  = span - nonBeanies.length;

  // Not enough Beanies to fill the internal gaps
  if (internalGaps > beanieCount) return false;

  // Extra Beanies beyond gap-filling must extend the run at the ends
  const extraBeanies       = beanieCount - internalGaps;
  const availableLeft      = minR - 1;          // positions below min rank
  const availableRight     = 13 - maxR;         // positions above max rank
  const availableExtension = availableLeft + availableRight;

  if (extraBeanies > availableExtension) return false;

  return true;
}

module.exports = { validateSet, validateAddToSet, RANK_ORDER };
