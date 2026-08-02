// engine.test.js — Beanie game logic tests
// Run with: npm test  (from the server/ directory)

const { createDeck, getBeanieRank }                          = require('../cards');
const { validateSet }                                        = require('../validator');
const {
  STATUS, PHASE,
  createGame, addPlayer, startGame, nextRound,
  drawFromPile, drawFromDiscard,
  layDownSet, addCardsToSet, stealBeanie, discard,
} = require('../engine');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(rank, suit) {
  const value = ['J','Q','K'].includes(rank) ? 10 : rank === 'A' ? 1 : parseInt(rank);
  return { id: `${rank}${suit}`, rank, suit, value };
}

/** Build a two-player game that is already in PLAYING state, with a known hand. */
function buildGame(overrides = {}) {
  let g = createGame('TEST');
  g = addPlayer(g, 'p1', 'Alice');
  g = addPlayer(g, 'p2', 'Bob');
  g = startGame(g);

  // Force round 3 so beanieRank = '3' (easy to work with in tests)
  g = { ...g, round: 3, beanieRank: '3', roundFirstTurnDone: false };

  // Put p1 first
  g = { ...g, currentPlayerIndex: 0, players: g.players.map((p, i) => ({ ...p })) };
  g.players[0] = g.players.find(p => p.id === 'p1') || g.players[0];
  g.players[1] = g.players.find(p => p.id === 'p2') || g.players[1];

  return { ...g, ...overrides };
}

/** Give a player a specific hand (overrides dealt hand). */
function setHand(game, playerId, cards) {
  return {
    ...game,
    players: game.players.map(p => p.id === playerId ? { ...p, hand: cards } : p),
  };
}

// ─── cards.js ────────────────────────────────────────────────────────────────

describe('createDeck', () => {
  test('produces 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = deck.map(c => c.id);
    expect(new Set(ids).size).toBe(52);
  });
});

describe('getBeanieRank', () => {
  test('round 1 → A', () => expect(getBeanieRank(1)).toBe('A'));
  test('round 13 → K', () => expect(getBeanieRank(13)).toBe('K'));
  test('round 7 → 7', () => expect(getBeanieRank(7)).toBe('7'));
});

// ─── validator.js ────────────────────────────────────────────────────────────

describe('validateSet — set of a kind', () => {
  const br = '3'; // beanieRank

  test('three of the same rank → valid', () => {
    const cards = [makeCard('Q','♠'), makeCard('Q','♥'), makeCard('Q','♦')];
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'SET' });
  });

  test('four of the same rank → valid', () => {
    const cards = ['♠','♥','♦','♣'].map(s => makeCard('Q', s));
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'SET' });
  });

  test('five of same rank → invalid (max 4)', () => {
    const cards = ['♠','♥','♦','♣','♠'].map(s => makeCard('Q', s));
    expect(validateSet(cards, br).valid).toBe(false);
  });

  test('two of same rank → invalid (min 3)', () => {
    const cards = [makeCard('Q','♠'), makeCard('Q','♥')];
    expect(validateSet(cards, br).valid).toBe(false);
  });

  test('duplicate suits → invalid', () => {
    const cards = [makeCard('Q','♠'), makeCard('Q','♠'), makeCard('Q','♦')];
    expect(validateSet(cards, br).valid).toBe(false);
  });

  test('beanie fills missing suit slot', () => {
    const cards = [makeCard('Q','♠'), makeCard('Q','♥'), makeCard('3','♦')]; // 3 is Beanie
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'SET' });
  });
});

describe('validateSet — run', () => {
  const br = '3';

  test('three consecutive same suit → valid', () => {
    const cards = [makeCard('5','♥'), makeCard('6','♥'), makeCard('7','♥')];
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'RUN' });
  });

  test('five consecutive same suit → valid', () => {
    const cards = ['4','5','6','7','8'].map(r => makeCard(r,'♥'));
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'RUN' });
  });

  test('non-consecutive without beanie → invalid', () => {
    const cards = [makeCard('5','♥'), makeCard('7','♥'), makeCard('9','♥')];
    expect(validateSet(cards, br).valid).toBe(false);
  });

  test('beanie fills gap in run', () => {
    // 5♥ [Beanie/3♦] 7♥ — Beanie stands in for 6♥
    const cards = [makeCard('5','♥'), makeCard('3','♦'), makeCard('7','♥')];
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'RUN' });
  });

  test('beanie extends run at the end', () => {
    const cards = [makeCard('5','♥'), makeCard('6','♥'), makeCard('3','♣')];
    expect(validateSet(cards, br)).toMatchObject({ valid: true, type: 'RUN' });
  });

  test('mixed suits → invalid', () => {
    const cards = [makeCard('5','♥'), makeCard('6','♠'), makeCard('7','♥')];
    expect(validateSet(cards, br).valid).toBe(false);
  });

  test('all beanies → invalid', () => {
    const cards = [makeCard('3','♠'), makeCard('3','♥'), makeCard('3','♦')];
    expect(validateSet(cards, br).valid).toBe(false);
  });
});

// ─── engine.js ───────────────────────────────────────────────────────────────

describe('createGame / addPlayer / startGame', () => {
  test('creates a waiting game', () => {
    const g = createGame('ROOM1');
    expect(g.status).toBe(STATUS.WAITING);
    expect(g.players).toHaveLength(0);
  });

  test('cannot start with 1 player', () => {
    let g = createGame('R');
    g = addPlayer(g, 'p1', 'Alice');
    g = startGame(g);
    expect(g.error).toBeTruthy();
  });

  test('starts correctly with 2 players', () => {
    let g = createGame('R');
    g = addPlayer(g, 'p1', 'Alice');
    g = addPlayer(g, 'p2', 'Bob');
    g = startGame(g);
    expect(g.status).toBe(STATUS.PLAYING);
    expect(g.round).toBe(1);
    expect(g.beanieRank).toBe('A');
    // First player gets 8 cards, other gets 7
    const hands = g.players.map(p => p.hand.length).sort((a,b) => a-b);
    expect(hands).toEqual([7, 8]);
    // draw + discard together should be 52 - (7+8) = 37
    expect(g.drawPile.length + g.discardPile.length).toBe(37);
  });

  test('cannot add more than 4 players', () => {
    let g = createGame('R');
    ['p1','p2','p3','p4'].forEach((id, i) => { g = addPlayer(g, id, `P${i}`); });
    g = addPlayer(g, 'p5', 'Extra');
    expect(g.error).toBeTruthy();
    expect(g.players).toHaveLength(4);
  });
});

describe('draw actions', () => {
  test('drawFromPile adds card to hand and moves to ACTION phase', () => {
    let g = buildGame();
    const p1 = g.players.find(p => p.id === 'p1');
    const handSize = p1.hand.length;
    const deckSize = g.drawPile.length;
    g = drawFromPile(g, 'p1');
    expect(g.error).toBeNull();
    expect(g.phase).toBe(PHASE.ACTION);
    expect(g.players.find(p => p.id === 'p1').hand).toHaveLength(handSize + 1);
    expect(g.drawPile).toHaveLength(deckSize - 1);
  });

  test('cannot draw if not your turn', () => {
    const g = buildGame();
    const result = drawFromPile(g, 'p2'); // p1 is current
    expect(result.error).toBeTruthy();
  });

  test('drawFromDiscard takes the top discard', () => {
    let g = buildGame();
    const topDiscard = g.discardPile[g.discardPile.length - 1];
    g = drawFromDiscard(g, 'p1');
    expect(g.error).toBeNull();
    expect(g.players.find(p => p.id === 'p1').hand).toContainEqual(topDiscard);
    expect(g.discardPile).not.toContainEqual(topDiscard);
  });

  test('cannot draw twice in one turn', () => {
    let g = buildGame();
    g = drawFromPile(g, 'p1');
    g = drawFromPile(g, 'p1'); // second draw
    expect(g.error).toBeTruthy();
  });
});

describe('layDownSet', () => {
  test('valid set of a kind is placed on table', () => {
    let g = buildGame();
    g = setHand(g, 'p1', [
      makeCard('Q','♠'), makeCard('Q','♥'), makeCard('Q','♦'),
      makeCard('5','♣'), makeCard('6','♣'),
    ]);
    g = { ...g, phase: PHASE.ACTION, roundFirstTurnDone: true };
    g = layDownSet(g, 'p1', ['Q♠','Q♥','Q♦']);
    expect(g.error).toBeNull();
    expect(g.publicSets).toHaveLength(1);
    expect(g.publicSets[0].type).toBe('SET');
    expect(g.players.find(p => p.id === 'p1').hand).toHaveLength(2);
  });

  test('invalid set returns error', () => {
    let g = buildGame();
    g = setHand(g, 'p1', [makeCard('Q','♠'), makeCard('K','♥'), makeCard('A','♦')]);
    g = { ...g, phase: PHASE.ACTION };
    g = layDownSet(g, 'p1', ['Q♠','K♥','A♦']);
    expect(g.error).toBeTruthy();
    expect(g.publicSets).toHaveLength(0);
  });

  test('cannot lay a third set', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: true,
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
        { playerId: 'p1', cards: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')], type: 'RUN' },
      ],
      players: g.players.map(p => p.id === 'p1' ? { ...p, hasLaidSet: true } : p),
    };
    g = setHand(g, 'p1', [makeCard('A','♠'), makeCard('A','♥'), makeCard('A','♦')]);
    g = layDownSet(g, 'p1', ['A♠','A♥','A♦']);
    expect(g.error).toMatch(/2 sets/);
  });
});

describe('win condition', () => {
  test('player wins when 2 sets down and hand empty (not first turn)', () => {
    let g = buildGame();
    // Give p1 exactly a run: 5♥ 6♥ 7♥ 8♥ — will lay as one set then another
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: true,
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] }
        : p
      ),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    expect(g.error).toBeNull();
    expect(g.status).toBe(STATUS.ROUND_END);
    expect(g.roundWinner).toBe('Alice');
    expect(g.players.find(p => p.id === 'p1').roundScores[0]).toBe(0);
  });

  test('cannot win on the first turn of a round', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: false, // first turn — win blocked
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] }
        : p
      ),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    // Should not win — roundFirstTurnDone is false
    expect(g.status).toBe(STATUS.PLAYING);
  });
});

describe('stealBeanie', () => {
  test('valid steal replaces Beanie with matching card', () => {
    let g = buildGame();
    // Set on table owned by p2 containing a Beanie (3♣)
    g = {
      ...g,
      beanieRank: '3',
      phase: PHASE.ACTION,
      publicSets: [
        { playerId: 'p2', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('3','♣')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('Q','♦'), makeCard('5','♣')] }
        : p
      ),
    };
    g = stealBeanie(g, 'p1', 0, 'Q♦');
    expect(g.error).toBeNull();
    // Beanie should now be in p1's hand
    expect(g.players.find(p => p.id === 'p1').hand).toContainEqual(expect.objectContaining({ rank: '3' }));
    // Q♦ should be in the set
    expect(g.publicSets[0].cards).toContainEqual(expect.objectContaining({ id: 'Q♦' }));
    // 3♣ should not be in the set
    expect(g.publicSets[0].cards).not.toContainEqual(expect.objectContaining({ id: '3♣' }));
  });

  test('cannot steal without a set on the table', () => {
    let g = buildGame();
    g = {
      ...g,
      beanieRank: '3',
      phase: PHASE.ACTION,
      publicSets: [
        { playerId: 'p2', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('3','♣')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: false, hand: [makeCard('Q','♦')] }
        : p
      ),
    };
    g = stealBeanie(g, 'p1', 0, 'Q♦');
    expect(g.error).toMatch(/one set/);
  });

  test('cannot steal own Beanie', () => {
    let g = buildGame();
    g = {
      ...g,
      beanieRank: '3',
      phase: PHASE.ACTION,
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('3','♣')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('Q','♦')] }
        : p
      ),
    };
    g = stealBeanie(g, 'p1', 0, 'Q♦');
    expect(g.error).toMatch(/own Beanie/);
  });
});

describe('discard', () => {
  test('discard ends turn and advances to next player', () => {
    let g = buildGame();
    g = drawFromPile(g, 'p1');
    const hand = g.players.find(p => p.id === 'p1').hand;
    const cardToDiscard = hand[0];
    g = discard(g, 'p1', cardToDiscard.id);
    expect(g.error).toBeNull();
    expect(g.phase).toBe(PHASE.DRAW);
    expect(g.roundFirstTurnDone).toBe(true);
    // Turn should have passed to p2
    expect(g.players[g.currentPlayerIndex].id).toBe('p2');
  });

  test('cannot discard before drawing', () => {
    const g = buildGame();
    const card = g.players.find(p => p.id === 'p1').hand[0];
    const result = discard(g, 'p1', card.id);
    expect(result.error).toBeTruthy();
  });
});

describe('scoring', () => {
  test('round winner scores 0', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: true,
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] }
        : p
      ),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    const alice = g.players.find(p => p.id === 'p1');
    expect(alice.roundScores[alice.roundScores.length - 1]).toBe(0);
  });

  test('face cards score 10 each', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: true,
      beanieRank: '3',
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => {
        if (p.id === 'p1') return { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] };
        if (p.id === 'p2') return { ...p, hand: [makeCard('J','♠'), makeCard('K','♦'), makeCard('Q','♣')] };
        return p;
      }),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    const bob = g.players.find(p => p.id === 'p2');
    expect(bob.roundScores[0]).toBe(30); // J=10, K=10, Q=10
  });

  test('Beanie held in hand scores 10 regardless of rank', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      roundFirstTurnDone: true,
      beanieRank: 'A', // round 1 — Ace is Beanie
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => {
        if (p.id === 'p1') return { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] };
        if (p.id === 'p2') return { ...p, hand: [makeCard('A','♠'), makeCard('2','♦')] }; // A is Beanie = 10, 2 = 2
        return p;
      }),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    const bob = g.players.find(p => p.id === 'p2');
    expect(bob.roundScores[0]).toBe(12); // 10 (Beanie Ace) + 2
  });
});

describe('nextRound', () => {
  test('advances round and resets state', () => {
    let g = buildGame();
    g = { ...g, status: STATUS.ROUND_END, round: 3 };
    g = nextRound(g);
    expect(g.round).toBe(4);
    expect(g.beanieRank).toBe('4');
    expect(g.status).toBe(STATUS.PLAYING);
    expect(g.publicSets).toHaveLength(0);
  });

  test('game ends after round 13', () => {
    let g = buildGame();
    g = {
      ...g,
      phase: PHASE.ACTION,
      round: 13,
      roundFirstTurnDone: true,
      publicSets: [
        { playerId: 'p1', cards: [makeCard('Q','♠'),makeCard('Q','♥'),makeCard('Q','♦')], type: 'SET' },
      ],
      players: g.players.map(p => p.id === 'p1'
        ? { ...p, hasLaidSet: true, hand: [makeCard('5','♥'),makeCard('6','♥'),makeCard('7','♥')] }
        : p
      ),
    };
    g = layDownSet(g, 'p1', ['5♥','6♥','7♥']);
    expect(g.status).toBe(STATUS.GAME_END);
  });
});
