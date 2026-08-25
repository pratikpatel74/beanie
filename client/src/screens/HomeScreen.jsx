import { pSuit, pSuitColor } from '../constants';

export default function HomeScreen({ actions, playerName }) {
  const initial = playerName ? playerName[0].toUpperCase() : 'P';
  const suit    = pSuit(playerName);
  const pipCol  = pSuitColor(playerName);

  return (
    <div className="screen">
      <div className="home-inner">

        {/* Avatar / greeting */}
        <div className="home-header">
          <div className="avatar">
            {initial}
            <span className="avatar-pip" style={{ color: pipCol }}>{suit}</span>
          </div>
          <div className="greeting">
            <div className="sub">Good to see you,</div>
            <div className="name">{playerName || 'Player'}</div>
          </div>
          <div className="home-edit-name" onClick={() => actions.goTo('name')}>✎ Edit</div>
        </div>

        {/* Hero: 3-card fan + logo */}
        <div className="home-hero">
          <div className="card-fan">
            {/* Left flanking card — Ko-fi style dark card */}
            <div className="side-card side-card-left kofi-card">
              <div className="kofi-suit" style={{ color: 'var(--acc)' }}>♠</div>
            </div>
            {/* Centre Beanie card — wrapper handles positioning so float animation isn't clobbered */}
            <div className="beanie-card-wrap">
              <div className="crd beanie-card">
                <div className="bc-star-sm">★</div>
                <div className="bc-star-lg">★</div>
                <div className="bc-label">BEANIE ★</div>
              </div>
            </div>
            {/* Right flanking card — Ko-fi style dark card */}
            <div className="side-card side-card-right kofi-card">
              <div className="kofi-suit" style={{ color: 'var(--danger)' }}>♥</div>
            </div>
          </div>
          <div className="logo-title">BEANIE</div>
          <div className="logo-sub">Wild card rummy · 2–4 players</div>
          <div className="home-tagline">Can you go out before the Beanie rank changes?</div>
        </div>

        <div className="home-divider" />

        {/* Action cards */}
        <div className="action-card action-card-create" onClick={() => actions.goTo('create')}>
          <div className="ac-inner">
            <div className="ac-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="14" height="17" rx="2"/>
                <path d="M8 5V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-1"/>
              </svg>
            </div>
            <div className="ac-body">
              <div className="ac-badge">NEW ROOM</div>
              <div className="ac-title">Create game</div>
              <div className="ac-desc">Start a room, invite friends via link</div>
            </div>
          </div>
          <div className="ac-arr">›</div>
        </div>

        <div className="action-card action-card-join" onClick={() => actions.goTo('join')}>
          <div className="ac-inner">
            <div className="ac-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="ac-body">
              <div className="ac-title">Join game</div>
              <div className="ac-desc">Enter a 4-letter room code</div>
            </div>
          </div>
          <div className="ac-arr">›</div>
        </div>

        <div className="home-footer">
          <button onClick={() => actions.goTo('howtoplay')}>How to play ›</button>
          <span className="home-footer-divider">·</span>
          <a href="https://www.playbeanie.com/score-tracker.html" target="_blank" rel="noopener noreferrer">Score tracker ›</a>
        </div>

      </div>
    </div>
  );
}
