// constants.js — Shared client-side constants
// Import from here instead of re-defining in every screen.

export const PLAYER_COLOURS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)'];

export const BEANIE_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export const RANK_ORDER = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export const SUIT_ORDER = ['♠','♥','♦','♣'];

/**
 * Deterministic suit assignment from a player's display name.
 * Used to give each player a consistent suit icon across screens.
 */
export function pSuit(name) {
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ['♠', '♥', '♦', '♣'][h % 4];
}

export function pSuitColor(name) {
  const s = pSuit(name);
  return (s === '♥' || s === '♦') ? '#c0392b' : '#1a1a2e';
}
