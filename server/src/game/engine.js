// engine.js — Beanie game state machine
//
// All action functions are pure: they receive game state and return new state.
// Errors are returned as { ...game, error: 'message' } — never thrown.
// The Socket.io layer calls these functions and broadcasts the resulting state.
//
// Game flow:
//   WAITING → (startGame) → PLAYING → (round ends) → ROUND_END
//   → (nextRound) → PLAYING → ... → GAME_END

const { createDeck, shuffle, getBeanieRank } = require('./cards');
const { validateSet, validateAddToSet, RANK_ORDER } = require('./validator');

// Reverse lookup: numeric rank value → rank string (e.g. 13 → 'K')
const RANK_BY_VAL = Object.fromEntries(Object.entries(RANK_ORDER).map(([r, v]) => [v, r]));

const STATUS = {
  WAITING:   'WAITING',
  PLAYING:   'PLAYING',
  ROUND_END: 'ROUND_END',
  GAME_END:  'GAME_END',
};

const PHASE = {
  DRAW:   'DRAW',    // player must draw before doing anything else
  ACTION: 'ACTION',  // player may lay sets, add cards, steal, then must discard
};

const TOTAL_ROUNDS = 13;

// ─── Game creation ──────────────────────────────────────────────────────────

function createGame(roomCode) {
  return {
    roomCode,
    status:              STATUS.WAITING,
    players:             [],
    round:               0,
    beanieRank:          null,
    drawPile:            [],
    discardPile:         [],
    currentPlayerIndex:  0,
    firstPlayerIndex:    0,
    phase:               PHASE.DRAW,
    publicSets:          [],   // [{ playerId, cards, type }]
    roundFirstTurnDone:  false, // legacy — superseded by per-player firstTurnDone
    roundWinner:         null,
    error:               null,
  };
}

// ─── Lobby ──────────────────────────────────────────────────────────────────

function addPlayer(game, playerId, playerName) {
  if (game.status !== STATUS.WAITING) {
    return err(game, 'Game has already started');
  }
  if (game.players.length >= 4) {
    return err(game, 'Game is full (max 4 players)');
  }
  if (game.players.find(p => p.id === playerId)) {
    return err(game, 'Player is already in the game');
  }

  const player = {
    id:          playerId,
    name:        playerName,
    hand:        [],
    hasLaidSet:  false,   // true once first set is on the table this round
    totalScore:  0,
    roundScores: [],
  };

  return ok({ ...game, players: [...game.players, player] });
}

function removePlayer(game, playerId) {
  if (game.status !== STATUS.WAITING) {
    return err(game, 'Cannot remove a player once the game has started');
  }
  return ok({ ...game, players: game.players.filter(p => p.id !== playerId) });
}

// ─── Starting the game / rounds ─────────────────────────────────────────────

function startGame(game) {
  if (game.players.length < 2) {
    return err(game, 'Need at least 2 players to start');
  }
  if (game.status !== STATUS.WAITING) {
    return err(game, 'Game has already started');
  }
  return _startRound({ ...game, round: 1, status: STATUS.PLAYING });
}

function nextRound(game) {
  if (game.status !== STATUS.ROUND_END) {
    return err(game, 'Round has not ended yet');
  }
  return _startRound({ ...game, round: game.round + 1, status: STATUS.PLAYING });
}

function _startRound(game) {
  const deck       = shuffle(createDeck());
  const beanieRank = getBeanieRank(game.round);

  // Randomly pick the first player each round
  const firstPlayerIndex = Math.floor(Math.random() * game.players.length);

  // Deal: first player gets 8 cards, everyone else gets 7
  let cursor = 0;
  const players = game.players.map((p, i) => {
    const isFirst  = i === firstPlayerIndex;
    const count    = isFirst ? 8 : 7;
    const hand     = deck.slice(cursor, cursor + count);
    cursor        += count;
    return { ...p, hand, hasLaidSet: false, firstTurnDone: false };
  });

  // Remaining cards → draw pile.
  // Discard pile starts empty — player 1's first discard card opens it.
  const drawPile    = deck.slice(cursor);
  const discardPile = [];

  return ok({
    ...game,
    beanieRank,
    firstPlayerIndex,
    currentPlayerIndex:  firstPlayerIndex,
    players,
    drawPile,
    discardPile,
    publicSets:          [],
    roundFirstTurnDone:  false,
    roundWinner:         null,
    drawVotes:           [],  // tracks players who have voted to end the round in a draw
    // Player 1 already holds 8 cards (their "draw"), so start in ACTION phase
    phase:               PHASE.ACTION,
  });
}

// ─── Turn actions ────────────────────────────────────────────────────────────

function drawFromPile(game, playerId) {
  const check = _requirePhase(game, playerId, PHASE.DRAW);
  if (check) return err(game, check);

  let { drawPile, discardPile } = game;

  // If draw pile is empty, reshuffle the discard pile (keep the top card face-up)
  if (drawPile.length === 0) {
    if (discardPile.length <= 1) {
      return err(game, 'No cards left to draw — consider declaring a draw');
    }
    const top = discardPile[discardPile.length - 1];
    drawPile   = shuffle([...discardPile.slice(0, -1)]);
    discardPile = [top];
    console.log(`[engine] Draw pile empty — reshuffled ${drawPile.length} discard cards`);
  }

  const [card, ...newDrawPile] = drawPile;
  const players = _addCardToHand(game.players, playerId, card);

  return ok({ ...game, drawPile: newDrawPile, discardPile, players, phase: PHASE.ACTION });
}

function drawFromDiscard(game, playerId) {
  const check = _requirePhase(game, playerId, PHASE.DRAW);
  if (check) return err(game, check);

  if (game.discardPile.length === 0) {
    return err(game, 'Discard pile is empty');
  }

  const discardPile = [...game.discardPile];
  const card        = discardPile.pop();
  const players     = _addCardToHand(game.players, playerId, card);

  return ok({ ...game, discardPile, players, phase: PHASE.ACTION });
}

// ─── Set actions (all require ACTION phase + player must be current) ─────────

function layDownSet(game, playerId, cardIds, beanieOverrides = {}) {
  const check = _requirePhase(game, playerId, PHASE.ACTION);
  if (check) return err(game, check);

  const player = _getPlayer(game, playerId);
  const playerSets = game.publicSets.filter(s => s.playerId === playerId);

  if (playerSets.length >= 2) {
    return err(game, 'You already have 2 sets on the table');
  }

  const cards = _cardsFromHand(player.hand, cardIds);
  if (!cards) return err(game, 'One or more cards not in your hand');

  const result = validateSet(cards, game.beanieRank);
  if (!result.valid) return err(game, result.error);

  const newHand    = player.hand.filter(c => !cardIds.includes(c.id));
  const publicSets = [...game.publicSets, { playerId, cards, type: result.type, beanieOverrides }];

  // No player can go out on their very first turn of a round — must discard first
  const playerSetsAfter = publicSets.filter(s => s.playerId === playerId);
  if (!player.firstTurnDone && playerSetsAfter.length >= 2 && newHand.length === 0) {
    return err(game, "You can't go out on your first turn — keep at least one card to discard first");
  }

  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand, hasLaidSet: true } : p
  );

  return _checkWin({ ...game, players, publicSets }, playerId);
}

function addCardsToSet(game, playerId, setIndex, cardIds) {
  const check = _requirePhase(game, playerId, PHASE.ACTION);
  if (check) return err(game, check);

  const player = _getPlayer(game, playerId);
  if (!player.hasLaidSet) {
    return err(game, 'You must have at least one set on the table first');
  }

  const targetSet = game.publicSets[setIndex];
  if (!targetSet) return err(game, 'Set not found');

  const newCards = _cardsFromHand(player.hand, cardIds);
  if (!newCards) return err(game, 'One or more cards not in your hand');

  const result = validateAddToSet(targetSet.cards, newCards, game.beanieRank, targetSet.beanieOverrides || {}, targetSet.type);
  if (!result.valid) return err(game, result.error);

  const newHand    = player.hand.filter(c => !cardIds.includes(c.id));
  const publicSets = game.publicSets.map((s, i) =>
    i === setIndex ? { ...s, cards: [...targetSet.cards, ...newCards] } : s
  );

  // No player can go out on their very first turn of a round — must discard first
  const playerSetsAfter = publicSets.filter(s => s.playerId === playerId);
  if (!player.firstTurnDone && playerSetsAfter.length >= 2 && newHand.length === 0) {
    return err(game, "You can't go out on your first turn — keep at least one card to discard first");
  }

  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  return _checkWin({ ...game, players, publicSets }, playerId);
}

function stealBeanie(game, playerId, setIndex, replacementCardId, beanieCardId = null) {
  const check = _requirePhase(game, playerId, PHASE.ACTION);
  if (check) return err(game, check);

  const player = _getPlayer(game, playerId);
  if (!player.hasLaidSet) {
    return err(game, 'You must have at least one set on the table to steal a Beanie');
  }

  const targetSet = game.publicSets[setIndex];
  if (!targetSet) return err(game, 'Set not found');

  if (targetSet.playerId === playerId) {
    return err(game, 'You cannot steal your own Beanie');
  }

  // Find the specific Beanie to steal (by id if provided, otherwise first found)
  const beanieIndex = beanieCardId
    ? targetSet.cards.findIndex(c => c.id === beanieCardId && c.rank === game.beanieRank)
    : targetSet.cards.findIndex(c => c.rank === game.beanieRank);
  if (beanieIndex === -1) {
    return err(game, 'That set does not contain a Beanie');
  }
  const stolenBeanie = targetSet.cards[beanieIndex];

  // Player must hold the replacement card
  const replacementCard = player.hand.find(c => c.id === replacementCardId);
  if (!replacementCard) return err(game, 'You do not hold that card');

  if (replacementCard.rank === game.beanieRank) {
    return err(game, 'You cannot replace a Beanie with another Beanie');
  }

  // Build new set: remove one Beanie, insert replacement, re-validate
  const newSetCards = [
    ...targetSet.cards.slice(0, beanieIndex),
    replacementCard,
    ...targetSet.cards.slice(beanieIndex + 1),
  ];
  const result = validateSet(newSetCards, game.beanieRank);
  if (!result.valid) {
    return err(game, 'Your card does not make a valid replacement in that set');
  }

  // Apply: swap card out of hand, Beanie into hand
  const newHand = player.hand
    .filter(c => c.id !== replacementCardId)
    .concat(stolenBeanie);

  const players    = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );
  const publicSets = game.publicSets.map((s, i) =>
    i === setIndex ? { ...s, cards: newSetCards } : s
  );

  return _checkWin({ ...game, players, publicSets }, playerId);
}

// ─── Discard — ends the turn ─────────────────────────────────────────────────

function discard(game, playerId, cardId) {
  const check = _requirePhase(game, playerId, PHASE.ACTION);
  if (check) return err(game, check);

  const player = _getPlayer(game, playerId);
  const card   = player.hand.find(c => c.id === cardId);
  if (!card) return err(game, 'Card not in your hand');

  const newHand = player.hand.filter(c => c.id !== cardId);
  let { drawPile, discardPile } = game;

  // Place card on discard pile
  discardPile = [...discardPile, card];

  // If draw pile is empty, reshuffle the discard pile (keep the top card face-up)
  if (drawPile.length === 0 && discardPile.length > 1) {
    const top  = discardPile[discardPile.length - 1];
    drawPile   = shuffle([...discardPile.slice(0, -1)]);
    discardPile = [top];
    console.log(`[engine] Draw pile empty after discard — reshuffled ${drawPile.length} cards`);
  }

  // Mark this player as having completed their first turn — from this point on
  // they are allowed to go out (the "no win on first turn" rule is lifted for them).
  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand, firstTurnDone: true } : p
  );

  const gameForWinCheck = { ...game, players, drawPile, discardPile };
  const winCheck = _checkWin(gameForWinCheck, playerId);
  if (winCheck.status === STATUS.ROUND_END || winCheck.status === STATUS.GAME_END) {
    return winCheck;
  }

  const nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;

  return ok({
    ...game,
    players,
    drawPile,
    discardPile,
    currentPlayerIndex:  nextPlayerIndex,
    phase:               PHASE.DRAW,
  });
}

// ─── Add Beanie to any set ────────────────────────────────────────────────────
// A player who has already laid a set may place a Beanie from their hand onto
// ANY set on the table.
//
// For SET type: the Beanie is simply appended (acts as another copy of the rank).
// For RUN type: the Beanie extends the run by one card. We validate there is room
// at either end and store a beanieOverride so the card's effective rank is known.
// If both ends are open, we prefer the high end.

function addBeanieToSet(game, playerId, setIndex, beanieCardId, rankOverride = null) {
  const check = _requirePhase(game, playerId, PHASE.ACTION);
  if (check) return err(game, check);

  const player = _getPlayer(game, playerId);
  if (!player.hasLaidSet) {
    return err(game, 'You must have at least one set on the table first');
  }

  const targetSet = game.publicSets[setIndex];
  if (!targetSet) return err(game, 'Set not found');

  const beanieCard = player.hand.find(c => c.id === beanieCardId && c.rank === game.beanieRank);
  if (!beanieCard) return err(game, 'Card is not a Beanie or not in your hand');

  // Carry over existing overrides; may add one for the new card (RUN only)
  let newBeanieOverrides = targetSet.beanieOverrides ? { ...targetSet.beanieOverrides } : {};

  if (targetSet.type === 'SET') {
    // A SET can only hold 4 cards (one per suit) — reject if full
    if (targetSet.cards.length >= 4) {
      return err(game, 'All four cards of that rank are already in this set');
    }
  }

  if (targetSet.type === 'RUN') {
    const nonBeanies = targetSet.cards.filter(c => c.rank !== game.beanieRank);
    if (nonBeanies.length === 0) return err(game, 'Cannot add a Beanie to a Beanie-only run');

    const runSuit = nonBeanies[0].suit;

    // Compute the current effective rank range of the run (accounting for overrides)
    const overrides = targetSet.beanieOverrides || {};
    const sortedNB  = [...nonBeanies].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);

    // Gap positions between non-beanies
    const gapVals = [];
    for (let i = 1; i < sortedNB.length; i++) {
      const lo = RANK_ORDER[sortedNB[i - 1].rank];
      const hi = RANK_ORDER[sortedNB[i].rank];
      for (let g = lo + 1; g < hi; g++) gapVals.push(g);
    }

    // Effective rank for every existing beanie card
    let gapPos = 0;
    let minVal  = Math.min(...sortedNB.map(c => RANK_ORDER[c.rank]));
    let maxVal  = Math.max(...sortedNB.map(c => RANK_ORDER[c.rank]));

    for (const b of targetSet.cards.filter(c => c.rank === game.beanieRank)) {
      let val;
      if (overrides[b.id]) {
        val = RANK_ORDER[overrides[b.id].rank];
      } else if (gapPos < gapVals.length) {
        val = gapVals[gapPos++]; // gap beanie — infer position
      } else {
        continue; // end beanie with no override (legacy) — skip
      }
      minVal = Math.min(minVal, val);
      maxVal = Math.max(maxVal, val);
    }

    const canExtendHigh = maxVal < 13; // K = 13
    const canExtendLow  = minVal > 1;  // A = 1

    if (!canExtendHigh && !canExtendLow) {
      return err(game, 'The run already spans A to K — no room for another Beanie');
    }

    if (rankOverride) {
      // Client told us exactly which rank — store it directly
      newBeanieOverrides[beanieCard.id] = rankOverride;
    } else {
      // Auto-pick: prefer high end, fall back to low
      const newRankVal = canExtendHigh ? maxVal + 1 : minVal - 1;
      newBeanieOverrides[beanieCard.id] = { rank: RANK_BY_VAL[newRankVal], suit: runSuit };
    }
  }

  const newHand    = player.hand.filter(c => c.id !== beanieCardId);
  const publicSets = game.publicSets.map((s, i) =>
    i === setIndex
      ? { ...s, cards: [...s.cards, beanieCard], beanieOverrides: newBeanieOverrides }
      : s
  );
  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  return _checkWin({ ...game, players, publicSets }, playerId);
}

// ─── Declare Draw — all players vote to end the round with penalty scoring ────

/**
 * A player votes to end the round as a draw.
 * When every player has voted, _endRoundDraw is called.
 * Players can call this again to withdraw their vote.
 */
function declareDraw(game, playerId) {
  if (game.status !== STATUS.PLAYING) return err(game, 'Game is not in progress');

  const drawVotes = (game.drawVotes || []).includes(playerId)
    ? (game.drawVotes || []).filter(id => id !== playerId)  // toggle off
    : [...(game.drawVotes || []), playerId];                // toggle on

  const updated = { ...game, drawVotes };

  // End the round when every player agrees
  if (drawVotes.length >= game.players.length) {
    return _endRoundDraw(updated);
  }

  return ok(updated);
}

function _endRoundDraw(game) {
  // No winner — every player scores penalty points for their remaining hand cards
  const players = game.players.map(p => {
    const roundScore = _scoreHand(p.hand, game.beanieRank);
    return {
      ...p,
      totalScore:  p.totalScore + roundScore,
      roundScores: [...p.roundScores, roundScore],
    };
  });

  const newStatus = game.round >= TOTAL_ROUNDS ? STATUS.GAME_END : STATUS.ROUND_END;

  return ok({ ...game, players, status: newStatus, roundWinner: null, drawVotes: [] });
}

// ─── Win / round end ─────────────────────────────────────────────────────────

function _checkWin(game, playerId) {
  const player     = _getPlayer(game, playerId);
  const playerSets = game.publicSets.filter(s => s.playerId === playerId);

  const twoSetsDown  = playerSets.length >= 2;
  const handEmpty    = player.hand.length === 0;
  const notFirstTurn = player.firstTurnDone; // per-player: must have discarded at least once this round

  if (twoSetsDown && handEmpty && notFirstTurn) {
    return _endRound(game, playerId);
  }

  return ok(game);
}

function _endRound(game, winnerId) {
  const roundWinner = _getPlayer(game, winnerId).name;

  const players = game.players.map(p => {
    const roundScore = p.id === winnerId
      ? 0
      : _scoreHand(p.hand, game.beanieRank);
    return {
      ...p,
      totalScore:  p.totalScore + roundScore,
      roundScores: [...p.roundScores, roundScore],
    };
  });

  const newStatus = game.round >= TOTAL_ROUNDS ? STATUS.GAME_END : STATUS.ROUND_END;

  return ok({ ...game, players, status: newStatus, roundWinner });
}

function _scoreHand(hand, beanieRank) {
  return hand.reduce((total, card) => {
    if (card.rank === beanieRank)              return total + 10; // any Beanie = 10
    if (['J', 'Q', 'K'].includes(card.rank))  return total + 10;
    if (card.rank === 'A')                     return total + 1;
    return total + parseInt(card.rank, 10);
  }, 0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _requirePhase(game, playerId, expectedPhase) {
  if (game.status !== STATUS.PLAYING) return 'Game is not in progress';
  const current = game.players[game.currentPlayerIndex];
  if (current.id !== playerId)        return 'It is not your turn';
  if (game.phase !== expectedPhase)   return expectedPhase === PHASE.DRAW
    ? 'You must draw a card first'
    : 'You must draw a card before playing';
  return null;
}

function _getPlayer(game, playerId) {
  return game.players.find(p => p.id === playerId);
}

function _addCardToHand(players, playerId, card) {
  return players.map(p =>
    p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
  );
}

function _cardsFromHand(hand, cardIds) {
  const cards = cardIds.map(id => hand.find(c => c.id === id));
  return cards.some(c => !c) ? null : cards;
}

function ok(game)          { return { ...game, error: null }; }
function err(game, msg)    { return { ...game, error: msg }; }

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  STATUS,
  PHASE,
  createGame,
  addPlayer,
  removePlayer,
  startGame,
  nextRound,
  drawFromPile,
  drawFromDiscard,
  layDownSet,
  addCardsToSet,
  addBeanieToSet,
  stealBeanie,
  discard,
  declareDraw,
};
