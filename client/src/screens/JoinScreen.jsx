import { useState } from 'react';

export default function JoinScreen({ error, actions }) {
  const [code, setCode] = useState('');

  function handleJoin() {
    if (code.length < 4) return;
    actions.joinRoom(code.trim());
  }

  return (
    <div className="screen">
      <div className="topnav">
        <div className="back-btn" onClick={() => actions.goTo('home')}>‹</div>
        <h2>Join game</h2>
      </div>

      {error && <div className="error-toast">{error}</div>}

      <div className="form-screen">
        <div className="form-group">
          <label className="form-label">Room code</label>
          <input
            className="input input-upper"
            placeholder="A B C D"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={4}
            autoFocus
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleJoin}
          disabled={code.length < 4}
        >
          Join room
        </button>
      </div>
    </div>
  );
}
