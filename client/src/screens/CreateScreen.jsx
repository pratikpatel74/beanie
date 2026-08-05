export default function CreateScreen({ error, actions }) {
  return (
    <div className="screen">
      <div className="topnav">
        <div className="back-btn" onClick={() => actions.goTo('home')}>‹</div>
        <h2>Create game</h2>
      </div>

      {error && <div className="error-toast">{error}</div>}

      <div className="form-screen">
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          A 4-letter room code will be generated. Share it with friends to invite them.
        </div>

        <button className="btn btn-primary" onClick={() => actions.createRoom()}>
          Create room
        </button>
      </div>
    </div>
  );
}
