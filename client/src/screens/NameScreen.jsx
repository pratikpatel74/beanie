import { useState } from 'react';

export default function NameScreen({ actions, isEditing }) {
  const [name, setName] = useState('');

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    actions.saveName(trimmed);
  }

  return (
    <div className="screen">
      <div className="name-screen-inner">

        {isEditing && (
          <div className="topnav" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <div className="back-btn" onClick={() => actions.goTo('home')}>‹</div>
            <h2 style={{ flex: 1 }}>Edit name</h2>
          </div>
        )}

        <div className="name-screen-logo">
          <div className="logo-title">BEANIE</div>
          <div className="logo-sub">Wild card rummy · 2–4 players</div>
        </div>

        <div className="name-screen-form">
          <div className="name-screen-heading">
            {isEditing ? 'Change your name' : 'Who\'s playing?'}
          </div>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            maxLength={20}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isEditing ? 'Save' : "Let's play →"}
          </button>
        </div>

      </div>
    </div>
  );
}
