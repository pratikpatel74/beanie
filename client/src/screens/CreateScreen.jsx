import { useState } from 'react';

export default function CreateScreen({ error, actions }) {
  const [name, setName] = useState('');

  function handleCreate() {
    if (!name.trim()) return;
    actions.createRoom(name.trim());
  }

  return (
    <div className="screen">
      <div className="topnav">
        <div className="back-btn" onClick={() => actions.goTo('home')}>‹</div>
        <h2>Create game</h2>
      </div>

      {error && <div className="error-toast">{error}</div>}

      <div className="form-screen">
        <div className="form-group">
          <label className="form-label">Your display name</label>
          <input
            className="input"
            placeholder="e.g. Pratik"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            maxLength={20}
            autoFocus
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
          A 4-letter room code will be generated. Share it with friends to invite them.
        </div>

        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={!name.trim()}
        >
          Create room
        </button>
      </div>
    </div>
  );
}
