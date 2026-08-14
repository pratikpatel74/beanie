import { useState, useEffect, useRef, useCallback } from 'react';
import Card, { EmptyCard } from '../components/Card';
import socket from '../socket';
import { PLAYER_COLOURS, RANK_ORDER, SUIT_ORDER, pSuit, pSuitColor } from '../constants';
import { playThwack, playShimmer, playTick, playWhoosh } from '../audio';
import {
  buildRunOptions,
  computeGapLabel,
  canStealBeanie,
  sortedRunCards,
  canAddCardsToSet,
  computeAddBeanieOptions,
} from '../gameHelpers';

// ─── Reactions — icon C style (large circles) + toast C style (card + border) ─
const REACTIONS = {
  nice:    { color: '#4ec98a', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> },
  fire:    { color: '#f0a500', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> },
  shocked: { color: '#c47be8', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
  skull:   { color: '#e05555', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.69 2 6 4.69 6 8c0 2.1.88 3.98 2.29 5.32L9 22h6l.71-8.68C17.12 11.98 18 10.1 18 8c0-3.31-2.69-6-6-6z"/><line x1="9" y1="17" x2="9" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="15" y1="17" x2="15" y2="22"/></svg> },
  zap:     { color: '#6399e8', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  waiting: { color: '#b0c4ff', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M17 20.5c.5-.3 1-.6 1.4-1" strokeDasharray="1.5 1.5"/><path d="M19.8 16c.1-.5.2-1 .2-1.5" strokeDasharray="1.5 1.5"/></svg> },
  angry:   { color: '#ff8c42', icon: (c, sz=22) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7 9.5 L10 11.5 L14 11.5 L17 9.5"/><circle cx="9.5" cy="13.5" r="1" fill={c} stroke="none"/><circle cx="14.5" cy="13.5" r="1" fill={c} stroke="none"/><path d="M9 17.5 Q12 15.5 15 17.5"/></svg> },
};

export default function GameScreen({ game, myId, isMyTurn, timer, error, notice, timedOut, actions }) {
  const [selectedCards, setSelectedCards]     = useState([]);
  const [mode, setMode]                       = useState('normal');
  const [beanieChoice, setBeanieChoice]       = useState(null);
  const [addBeanieChoice, setAddBeanieChoice] = useState(null);
  const [sortMode, setSortMode]               = useState('deal');
  const [showExitModal, setShowExitModal]     = useState(false);
  const [newCardId, setNewCardId]             = useState(null);
  const prevHandRef                           = useRef([]);

  // ─── Reactions ─────────────────────────────────────────────────────────────
  const [reactions, setReactions]       = useState([]);   // [{id, playerName, playerIndex, reaction}]
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [cooldown, setCooldown]         = useState(false); // 5s lockout after sending
  const reactionIdRef                   = useRef(0);

  useEffect(() => {
    function onReaction({ playerId, playerName, playerIndex, reaction }) {
      const id = ++reactionIdRef.current;
      setReactions(prev => [...prev, { id, playerName, playerIndex, reaction }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800);
    }
    socket.on('game:reaction', onReaction);
    return () => socket.off('game:reaction', onReaction);
  }, []);

  const sendReaction = useCallback((reaction) => {
    if (cooldown) return;
    actions.sendReaction(reaction);
    setPickerOpen(false);
    setCooldown(true);
    setTimeout(() => setCooldown(false), 5000);
  }, [cooldown, actions]);
  // beanieChoice shape:    { cardIds, options: [{ label, overrides }] }
  // addBeanieChoice shape: { setIndex, cardId, options: [{ label, override }] }

  // ─── Animation + audio state ───────────────────────────────────────────────
  const [muted, setMuted]                       = useState(() => {
    try { return localStorage.getItem('beanie_muted') === 'true'; } catch { return false; }
  });
  const [discardingCardId, setDiscardingCardId] = useState(null);  // card flying to discard pile
  const [layingCardIds, setLayingCardIds]       = useState([]);    // cards lifting to table
  const [dealAnim, setDealAnim]                 = useState(false); // deal-in animation active
  const [newOpponentSetIds, setNewOpponentSetIds] = useState(new Set()); // shimmer on new opponent sets

  const prevSetsCountRef = useRef(game.publicSets.length);

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
    : sortMode === 'suit'
    ? [...myHand].sort((a, b) => {
        const si = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
        if (si !== 0) return si;
        return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
      })
    : myHand;
  const myHasSet    = myPlayer?.hasLaidSet || false;
  // The 8-card first player starts in ACTION phase — they don't need to draw.
  // If the server's stored phase is ever DRAW for them (e.g. stale state after
  // a server restart), we still show them the ACTION UI so they can play normally.
  const is8CardStart = myHand.length >= 8 && myPlayer && !myPlayer.firstTurnDone;
  const inDraw      = game.phase === 'DRAW' && !is8CardStart;
  const inAction    = game.phase === 'ACTION' || is8CardStart;
  const isHost      = game.players[0]?.id === myId;

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem('beanie_muted', String(next)); } catch {}
  }

  /** Animate selected cards lifting to table, then fire server action */
  function animateThenLay(cardIds, overrides) {
    playShimmer(muted);
    try { navigator.vibrate?.([8, 30, 10]); } catch {}
    setLayingCardIds(cardIds);
    const snap = [...cardIds];
    setTimeout(() => {
      actions.layDownSet(snap, overrides);
      setLayingCardIds([]);
    }, 380);
  }

  // Round end haptic only — sound is handled in App.jsx (GameScreen unmounts before ROUND_END renders)
  useEffect(() => {
    if (game.status === 'ROUND_END' && prevStatusRef.current === 'PLAYING') {
      if (game.roundWinner) {
        try { navigator.vibrate?.([50, 40, 80]); } catch {}
      } else {
        try { navigator.vibrate?.(30); } catch {}
      }
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

  // New card indicator: detect when exactly 1 card is added to hand (a draw)
  useEffect(() => {
    const prev = prevHandRef.current;
    const curr = myHand;
    if (curr.length === prev.length + 1) {
      const prevIds = new Set(prev.map(c => c.id));
      const added = curr.find(c => !prevIds.has(c.id));
      if (added) setNewCardId(added.id);
    } else if (curr.length < prev.length) {
      // Cards left hand (discard or lay set) — clear indicator
      setNewCardId(null);
    } else if (curr.length !== prev.length) {
      // Round reset / bulk change — clear
      setNewCardId(null);
    }
    prevHandRef.current = curr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myHand.length, myHand.map(c => c.id).join(',')]);

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

  // Opponent set laid: shimmer + sound when publicSets grows with a non-my set
  useEffect(() => {
    const prev = prevSetsCountRef.current;
    const curr = game.publicSets.length;
    if (curr > prev && game.status === 'PLAYING') {
      const newSets = game.publicSets.slice(prev);
      const opponentNewIds = newSets
        .map((s, i) => ({ s, idx: prev + i }))
        .filter(({ s }) => s.playerId !== myId)
        .map(({ idx }) => idx);
      if (opponentNewIds.length > 0) {
        playShimmer(muted);
        setNewOpponentSetIds(new Set(opponentNewIds));
        setTimeout(() => setNewOpponentSetIds(new Set()), 700);
      }
    }
    prevSetsCountRef.current = curr;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.publicSets.length]);

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

    const allSameSuit = nonBeanies.length > 0 && nonBeanies.every(c => c.suit === nonBeanies[0].suit);
    const allSameRank = nonBeanies.length > 0 && nonBeanies.every(c => c.rank === nonBeanies[0].rank);

    if (beanies.length > 0 && allSameSuit) {
      const result = buildRunOptions(cards, game.beanieRank);
      if (result) {
        const { gapOverrides, options, solo } = result;

        // If non-Beanies are also all the same rank → ambiguous (valid SET *and* RUN) → ask player
        if (allSameRank) {
          const runOpts = options ? options : (solo ? [{ label: solo.label, overrides: solo.overrides }] : []);
          const setRank = nonBeanies[0].rank;
          const RANK_NAME = { A:'Aces', '2':'2s', '3':'3s', '4':'4s', '5':'5s', '6':'6s',
                              '7':'7s', '8':'8s', '9':'9s', '10':'10s', J:'Jacks', Q:'Queens', K:'Kings' };
          const setOpt = { label: `Set of ${RANK_NAME[setRank] || setRank + 's'}`, overrides: {} };
          setBeanieChoice({ cardIds, options: [...runOpts, setOpt] });
          return;
        }

        if (!options) {
          // Only one valid run arrangement — animate then lay
          animateThenLay(cardIds, solo ? solo.overrides : gapOverrides);
          clearSelection();
        } else {
          // Multiple run arrangements — show picker
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

  const allowReclaim = !!game.config?.allowReclaimBeanie;

  // True in steal mode: selected card can swap with at least one eligible Beanie
  // (opponent sets always; own sets only when allowReclaimBeanie is on)
  const hasAnyStealableBeanie = mode === 'steal' && selectedCards.length === 1 &&
    game.publicSets.some(s => {
      if (s.playerId === myId && !allowReclaim) return false;
      return s.cards.some(c => c.rank === game.beanieRank && isStealable(s, c));
    });

  // Returns true if handCard can steal/reclaim ANY eligible Beanie
  function cardCanStealAnyBeanie(handCard) {
    return game.publicSets.some(s => {
      if (s.playerId === myId && !allowReclaim) return false;
      return s.cards.some(
        c => c.rank === game.beanieRank && canStealBeanie(handCard, s, c, game.beanieRank)
      );
    });
  }

  // In steal mode: used to add gold ring to eligible hand cards
  function cardCanStealSomething(handCard) {
    return mode === 'steal' && cardCanStealAnyBeanie(handCard);
  }

  // True when at least one hand card can steal/reclaim an eligible Beanie.
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
    // Thwack + haptic at 120ms (lands as the card "hits" the pile)
    setTimeout(() => { playThwack(muted); try { navigator.vibrate?.(18); } catch {} }, 120);
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

      {/* Paused overlay — shown to all players while game is paused */}
      {game.isPaused && (
        <div className="pause-overlay">
          <div className="pause-box">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
            <div className="pause-title">Game paused</div>
            <div className="pause-sub">{isHost ? 'Tap Resume to continue' : 'Waiting for host to resume…'}</div>
            {isHost && (
              <button className="pause-resume-btn" onClick={actions.resumeGame}>
                ▶ Resume
              </button>
            )}
          </div>
        </div>
      )}

      {/* Exit / pause modal — host only */}
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
            <div className="exit-modal-title">Host options</div>
            <div className="exit-modal-actions" style={{ flexDirection: 'column', gap: 10 }}>
              {!game.isPaused && (
                <button className="exit-modal-cancel" style={{ background: 'rgba(240,180,41,0.12)', border: '1px solid rgba(240,180,41,0.3)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => { actions.pauseGame(); setShowExitModal(false); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                  </svg>
                  Pause game
                </button>
              )}
              <button className="exit-modal-confirm" onClick={actions.exitGame}>
                End game for all
              </button>
              <button className="exit-modal-cancel" onClick={() => setShowExitModal(false)}>
                Keep playing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Turn timed-out modal — shown only to the player whose turn expired */}
      {timedOut && (
        <div className="timeout-overlay">
          <div className="timeout-modal">
            <div className="timeout-modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="timeout-modal-title">Turn timed out</div>
            <div className="timeout-modal-sub">A card was discarded for you — the game has moved on.</div>
            <button className="timeout-modal-btn" onClick={actions.dismissTimeout}>Got it</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <div className="round-badge">Rd {game.round}/13</div>
        <div className="beanie-pill">★ {game.beanieRank}</div>
        {!game.isPaused && timer && isMyTurn ? (
          <div className={`timer-badge${timerUrgent ? ' urgent' : ''}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {timer.seconds}s
          </div>
        ) : !game.isPaused && timer ? (
          <div className="timer-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {timer.seconds}s
          </div>
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
        {/* How to play info */}
        <button className="btn-info" onClick={() => actions.goTo('howtoplay')} title="How to play">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </button>
        {/* React button */}
        <button
          className={`btn-info${cooldown ? ' muted' : ''}`}
          title={cooldown ? 'Reacting too fast…' : 'React'}
          onClick={() => setPickerOpen(p => !p)}
          style={{ position: 'relative' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>
        {isHost && (
          <button className="btn-exit" onClick={() => setShowExitModal(true)}>
            Exit
          </button>
        )}
      </div>

      {/* Reaction picker — shown when pickerOpen, closes on outside tap */}
      {pickerOpen && (
        <div
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="reaction-picker"
            onClick={e => e.stopPropagation()}
          >
            {Object.entries(REACTIONS).map(([key, { color, icon }]) => (
              <button
                key={key}
                className="reaction-opt"
                onClick={() => sendReaction(key)}
                title={key}
                style={{
                  background: `${color}22`,
                  border: `0.5px solid ${color}55`,
                  borderRadius: 11,
                  width: 46, height: 46,
                }}
              >
                {icon(color)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reaction toasts — Toast C: card with coloured left border + icon square */}
      {reactions.length > 0 && (
        <div className="reaction-toasts">
          {reactions.map(r => {
            const playerColour   = PLAYER_COLOURS[r.playerIndex] || 'var(--text2)';
            const { color, icon } = REACTIONS[r.reaction] || {};
            return (
              <div
                key={r.id}
                className="reaction-toast"
                style={{ borderLeftColor: playerColour }}
              >
                {color && (
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${color}22`, border: `0.5px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {icon(color, 22)}
                  </div>
                )}
                <div>
                  <div style={{ color: playerColour, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                    {r.playerName}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    reacted
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            <div className="pchip-left">
              <div className="pchip-dot" style={{ background: PLAYER_COLOURS[i] }} />
              <div className="pchip-name">{p.id === myId ? 'You' : p.name}</div>
            </div>
            <div className="pchip-right">
              <div className="pchip-score">{p.totalScore}</div>
              {p.id !== myId && game.status === 'PLAYING' && (
                <div className="pchip-cards">{p.handCount ?? '?'}c</div>
              )}
            </div>
          </div>
        ))}
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
                      const isStealTarget   = mode === 'steal' && !isOwnSet && isMyTurn && inAction;
                      const isReclaimTarget = mode === 'steal' && isOwnSet && allowReclaim && isMyTurn && inAction;
                      const isNewOpponent   = newOpponentSetIds.has(si);
                      const boxClass = `set-box${isAddable ? ' addable' : ''}${isStealTarget ? ' steal-target' : ''}${isReclaimTarget ? ' reclaim-target' : ''}${isNewOpponent ? ' set-new' : ''}`;
                      return (
                        <div key={si} className={boxClass}>
                          {sortedRunCards(set, game.beanieRank).map(c => {
                            let beanieLabel = null;
                            if (c.rank === game.beanieRank) {
                              if (set.type === 'RUN') {
                                if (set.beanieOverrides?.[c.id]) {
                                  const o = set.beanieOverrides[c.id];
                                  beanieLabel = `${o.rank}${o.suit}`;
                                } else {
                                  beanieLabel = computeGapLabel(c, set.cards, game.beanieRank);
                                }
                              } else if (set.type === 'SET') {
                                // Show which copy of the rank this Beanie stands in for
                                const setNBs = set.cards.filter(x => x.rank !== game.beanieRank);
                                const setRank = setNBs[0]?.rank;
                                if (setRank) {
                                  const usedSuits = setNBs.map(x => x.suit);
                                  const freeSuits = ['♠', '♥', '♦', '♣'].filter(s => !usedSuits.includes(s));
                                  const bIdx = set.cards.filter(x => x.rank === game.beanieRank).findIndex(x => x.id === c.id);
                                  if (bIdx < freeSuits.length) beanieLabel = `${setRank}${freeSuits[bIdx]}`;
                                }
                              }
                            }
                            const isBeanie = c.rank === game.beanieRank;
                            const isStealableBeanie  = isStealTarget   && isBeanie && isStealable(set, c);
                            const isReclaimableBeanie = isReclaimTarget && isBeanie && isStealable(set, c);
                            return (
                              <div key={c.id} style={{ position: 'relative', display: 'inline-block' }}>
                                <Card
                                  card={c}
                                  beanieRank={game.beanieRank}
                                  size="sm"
                                  onClick={(isStealableBeanie || isReclaimableBeanie) ? () => handleStealBeanie(si, c.id) : undefined}
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
        <div className="pile-compact">
          <div className="pile-compact-half">
            <div className="pile-compact-back" />
            <div className="pile-compact-info">
              <div className="pile-compact-num">{game.drawPileCount}</div>
              <div className="pile-compact-sub">Draw pile</div>
            </div>
          </div>
          <div className="pile-compact-sep" />
          <div className="pile-compact-half">
            {game.discardTop
              ? <Card card={game.discardTop} beanieRank={game.beanieRank} size="sm" disabled />
              : <EmptyCard size="sm" />}
            <div className="pile-compact-info">
              <div className="pile-compact-sub">Top of discard</div>
            </div>
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
            <span
              className={`sort-seg${sortMode === 'suit' ? ' sort-seg-active' : ''}`}
              onClick={() => setSortMode('suit')}
            >♠♥♦♣</span>
          </div>
        </div>
        <div className="hand-scroll">
          {sortedHand.map((c, ci) => (
            <div key={c.id} className="hand-card-wrap">
              <Card
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
              {newCardId === c.id && <span className="new-card-badge">NEW</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar — in landscape this spans full width below the hand */}
      <div className="ls-bottom">

      {/* Draw vote bar — shown to all when a vote is pending */}
      {(game.drawVotes || []).length > 0 && (
        <div className="draw-vote-bar">
          <div>
            <div className="vote-text">
              {(game.drawVotes || [])
                .map(id => game.players.find(p => p.id === id)?.name || '?')
                .join(', ')} proposed ending this round
            </div>
            <div className="vote-sub">
              {game.drawVotes.length} of {game.players.length} players agreed
            </div>
          </div>
          {!(game.drawVotes || []).includes(myId) && (
            <button className="vote-agree-btn" onClick={actions.declareDraw}>Agree</button>
          )}
        </div>
      )}

      {isMyTurn ? (
        <div className="action-area">
          {inAction && (
            mode === 'steal' ? (
              <div className="action-bar">
                <div className="steal-instruction">
                  {selectedCards.length === 0
                    ? hasSomeStealableHandCard
                      ? '✦ Tap a gold card from your hand to use as replacement'
                      : "None of your current cards can replace a Beanie"
                    : hasAnyStealableBeanie
                      ? allowReclaim
                        ? 'Tap a pulsing ★ to steal — or reclaim from your own sets'
                        : 'Tap a pulsing ★ Beanie on the table to steal it'
                      : "That card can't replace any Beanie — try another"}
                </div>
                <button className="action-steal" onClick={clearSelection}>Cancel steal</button>
              </div>
            ) : (
              <div className="action-bar">
                {selectedCards.length === 0 && (
                  <div className="turn-banner">
                    {myHand.length === 8 && !myPlayer?.firstTurnDone
                      ? 'You have 8 cards — lay a set or discard one to start the pile'
                      : <>Select cards from your hand to <strong>play</strong> or <strong>discard</strong></>}
                  </div>
                )}
                {selectedCards.length > 0 && (
                  <div className="action-primary-row">
                    {selectedCards.length === 1 && (
                      <button className="action-primary action-discard" onClick={handleDiscard}>Discard</button>
                    )}
                    {selectedCards.length >= 3 && (
                      <button className="action-primary action-lay" onClick={handleLaySet}>
                        Lay set <span className="action-count">({selectedCards.length})</span>
                      </button>
                    )}
                    <button className="action-clear" onClick={clearSelection}>Clear</button>
                  </div>
                )}
                {myHasSet && hasSomeStealableHandCard && (
                  <button className="action-steal" onClick={() => { clearSelection(); setMode('steal'); }}>
                    {allowReclaim ? 'Steal / Reclaim Beanie ★' : 'Steal Beanie ★'}
                  </button>
                )}
              </div>
            )
          )}
          {game.players.some(p => p.firstTurnDone) && (
            <>
              <div className="action-bar-divider" />
              <div className="action-end-round-row">
                <button className="action-end-round-btn" onClick={actions.declareDraw}>
                  {(game.drawVotes || []).includes(myId) ? 'Cancel End Round vote' : 'End Round'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="not-your-turn" style={{ borderLeftColor: PLAYER_COLOURS[game.currentPlayerIndex] }}>
          <div className="nmt-dot" style={{ background: PLAYER_COLOURS[game.currentPlayerIndex] }} />
          <div>
            <div className="nmt-name">{currentPlayer?.name}'s turn</div>
            <div className="nmt-sub">{game.phase === 'DRAW' ? 'Drawing a card…' : 'Playing…'}</div>
          </div>
        </div>
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

      {/* Beanie arrangement picker */}
      {beanieChoice && (
        <div className="beanie-choice-backdrop">
          <div className="beanie-choice-sheet">
            <div className="beanie-choice-title">How to play these cards?</div>
            <div className="beanie-choice-sub">Choose an arrangement</div>
            <div className="beanie-choice-btns">
              {beanieChoice.options.map((opt, i) => (
                <button
                  key={i}
                  className="btn-sm btn-sm-secondary"
                  onClick={() => {
                    animateThenLay(beanieChoice.cardIds, opt.overrides);
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
