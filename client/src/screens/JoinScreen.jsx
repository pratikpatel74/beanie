import { useState } from 'react';

export default function JoinScreen({ error, actions }) {
  const [name, setName]     = useState('');
  const [code, setCode]     = useState('');

  function handleJoin() {
    if (!name.trim() || code.length < 4) return;
    actions.joinRoom(code.trim(), name.trim());
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
          <label className="form-label">Your display name</label>
          <input
            className="input"
            placeholder="e.g. Sarah"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label className="form-label">Room code</label>
          <input
            className="input input-upper"
            placeholder="A B C D"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={4}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleJoin}
          disabled={!name.trim() || code.length < 4}
        >
          Join room
        </button>
      </div>
    </div>
  );
}
