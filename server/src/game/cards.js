// cards.js — Card representation, deck creation, dealing

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Round 1 → Ace wild, Round 2 → 2 wild, ... Round 13 → King wild
const BEANIE_BY_ROUND = RANKS;

function cardValue(rank) {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 1;
  return parseInt(rank, 10);
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit, value: cardValue(rank) });
    }
  }
  return deck; // 52 cards
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// round is 1-indexed (1–13)
function getBeanieRank(round) {
  return BEANIE_BY_ROUND[round - 1];
}

function isBeanie(card, round) {
  return card.rank === getBeanieRank(round);
}

module.exports = { SUITS, RANKS, createDeck, shuffle, getBeanieRank, isBeanie, cardValue };
