export default function HomeScreen({ actions }) {
  const initials = 'ME'; // replaced with real name once multiplayer profile added

  return (
    <div className="screen">
      <div className="home-inner">
        <div className="home-header">
          <div className="avatar">{initials}</div>
          <div className="greeting">
            <div className="sub">Good to see you,</div>
            <div className="name">Player</div>
          </div>
        </div>

        <div className="logo-wrap">
          <div className="logo-title">BEANIE</div>
          <div className="logo-sub">Wild card rummy · 2–4 players</div>
        </div>

        <div className="action-card action-card-create" onClick={() => actions.goTo('create')}>
          <div className="ac-inner">
            <div className="ac-icon">🃏</div>
            <div className="ac-text">
              <h3>Create game</h3>
              <p>Start a new room and invite friends via WhatsApp or iMessage</p>
            </div>
          </div>
          <div className="ac-arrow">›</div>
        </div>

        <div className="action-card action-card-join" onClick={() => actions.goTo('join')}>
          <div className="ac-inner">
            <div className="ac-icon">👥</div>
            <div className="ac-text">
              <h3>Join game</h3>
              <p>Enter a room code or tap an invite link to join</p>
            </div>
          </div>
          <div className="ac-arrow">›</div>
        </div>

        <div className="home-footer">
          <button onClick={() => actions.goTo('howtoplay')}>How to play ›</button>
        </div>
      </div>
    </div>
  );
}
