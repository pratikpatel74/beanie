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
const { validateSet, validateAddToSet }       = require('./validator');

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
    roundFirstTurnDone:  false, // prevents winning on very first turn of a round
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
    return { ...p, hand, hasLaidSet: false };
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
    // Player 1 already holds 8 cards (their "draw"), so start in ACTION phase
    phase:               PHASE.ACTION,
  });
}

// ─── Turn actions ────────────────────────────────────────────────────────────

function drawFromPile(game, playerId) {
  const check = _requirePhase(game, playerId, PHASE.DRAW);
  if (check) return err(game, check);

  if (game.drawPile.length === 0) {
    return err(game, 'Draw pile is empty — wait for discard pile to flip');
  }

  const [card, ...drawPile] = game.drawPile;
  const players = _addCardToHand(game.players, playerId, card);

  return ok({ ...game, drawPile, players, phase: PHASE.ACTION });
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

  // Block going out on the very first turn of the round
  const playerSetsAfter = publicSets.filter(s => s.playerId === playerId);
  if (!game.roundFirstTurnDone && playerSetsAfter.length >= 2 && newHand.length === 0) {
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

  // Block going out on the very first turn of the round
  const playerSetsAfter = publicSets.filter(s => s.playerId === playerId);
  if (!game.roundFirstTurnDone && playerSetsAfter.length >= 2 && newHand.length === 0) {
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

  // If draw pile is empty, flip the discard pile (minus top card) without reshuffling
  if (drawPile.length === 0 && discardPile.length > 1) {
    const top  = discardPile[discardPile.length - 1];
    drawPile   = discardPile.slice(0, -1).reverse(); // flip order, do not shuffle
    discardPile = [top];
  }

  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  // Check win using the original roundFirstTurnDone value.
  // This ensures player 1 cannot win on their very first discard (first turn of the round).
  const gameForWinCheck = { ...game, players, drawPile, discardPile };
  const winCheck = _checkWin(gameForWinCheck, playerId);
  if (winCheck.status === STATUS.ROUND_END || winCheck.status === STATUS.GAME_END) {
    return { ...winCheck, roundFirstTurnDone: true };
  }

  const nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;

  return ok({
    ...game,
    players,
    drawPile,
    discardPile,
    currentPlayerIndex:  nextPlayerIndex,
    phase:               PHASE.DRAW,
    roundFirstTurnDone:  true,
  });
}

// ─── Add Beanie to any set ────────────────────────────────────────────────────
// New rule: a player who has already laid a set may place a Beanie card from
// their hand onto ANY set on the table, to get rid of it. No validation needed
// beyond "you have laid a set" and "the card is a Beanie in your hand".

function addBeanieToSet(game, playerId, setIndex, beanieCardId) {
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

  const newHand    = player.hand.filter(c => c.id !== beanieCardId);
  const publicSets = game.publicSets.map((s, i) =>
    i === setIndex ? { ...s, cards: [...s.cards, beanieCard] } : s
  );
  const players = game.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  return _checkWin({ ...game, players, publicSets }, playerId);
}

// ─── Win / round end ─────────────────────────────────────────────────────────

function _checkWin(game, playerId) {
  const player     = _getPlayer(game, playerId);
  const playerSets = game.publicSets.filter(s => s.playerId === playerId);

  const twoSetsDown  = playerSets.length >= 2;
  const handEmpty    = player.hand.length === 0;
  const notFirstTurn = game.roundFirstTurnDone;

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
};
