export default function HomeScreen({ actions, playerName }) {
  const initial = playerName ? playerName[0].toUpperCase() : 'P';

  return (
    <div className="screen">
      <div className="home-inner">

        {/* Avatar / greeting */}
        <div className="home-header">
          <div className="avatar">{initial}</div>
          <div className="greeting">
            <div className="sub">Good to see you,</div>
            <div className="name">{playerName || 'Player'}</div>
          </div>
          <div className="home-edit-name" onClick={() => actions.goTo('name')}>✎ Edit</div>
        </div>

        {/* Hero: animated card fan + logo */}
        <div className="home-hero">
          <div className="card-fan">
            {/* Left — dark green card */}
            <div className="crd crd-l card-dark">
              <div className="ci cd">A</div>
              <div className="cp cd">★</div>
              <div className="ci cd bot">A</div>
            </div>
            {/* Centre — Beanie wild card */}
            <div className="crd crd-m beanie-card">
              <div className="bc-star-sm">★</div>
              <div className="bc-star-lg">★</div>
              <div className="bc-label">BEANIE ★</div>
            </div>
            {/* Right — white regular card */}
            <div className="crd crd-r">
              <div className="ci r">7<br/>♦</div>
              <div className="cp r">♦</div>
              <div className="ci r bot">7<br/>♦</div>
            </div>
          </div>
          <div className="logo-title">BEANIE</div>
          <div className="logo-sub">Wild card rummy · 2–4 players</div>
        </div>

        <div className="home-divider" />

        {/* Action cards */}
        <div className="action-card action-card-create" onClick={() => actions.goTo('create')}>
          <div className="ac-inner">
            <div className="ac-icon">🃏</div>
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
            <div className="ac-icon">👥</div>
            <div className="ac-body">
              <div className="ac-title">Join game</div>
              <div className="ac-desc">Enter a 4-letter room code</div>
            </div>
          </div>
          <div className="ac-arr">›</div>
        </div>

        <div className="home-footer">
          <button onClick={() => actions.goTo('howtoplay')}>How to play ›</button>
        </div>

      </div>
    </div>
  );
}
