import { useState } from 'react';

// ─── Segmented selector ───────────────────────────────────────────────────────

function SegmentedSelector({ options, value, onChange }) {
  return (
    <div className="seg-selector">
      {options.map(opt => (
        <button
          key={opt.value}
          className={`seg-btn${value === opt.value ? ' seg-btn-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      className={`settings-toggle${value ? ' settings-toggle-on' : ''}`}
      onClick={() => onChange(!value)}
      aria-label={value ? 'On' : 'Off'}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

// ─── CreateScreen ─────────────────────────────────────────────────────────────

export default function CreateScreen({ error, actions }) {
  const [config, setConfig] = useState({
    turnSeconds:        60,
    lobbyMinutes:       15,
    beanieHandValue:    10,
    allowReclaimBeanie: false,
  });

  function set(key, value) {
    setConfig(c => ({ ...c, [key]: value }));
  }

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

        <div className="settings-panel">
          <div className="settings-title">Game settings</div>
          <div className="settings-note">Settings lock once the game starts — only the host can change them.</div>

          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-label">Turn timer</span>
              <span className="settings-hint">Seconds per turn</span>
            </div>
            <SegmentedSelector
              value={config.turnSeconds}
              options={[
                { value: 30,  label: '30s' },
                { value: 60,  label: '60s' },
                { value: 90,  label: '90s' },
                { value: 120, label: '2m'  },
              ]}
              onChange={v => set('turnSeconds', v)}
            />
          </div>

          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-label">Lobby timer</span>
              <span className="settings-hint">Room expires if game doesn't start</span>
            </div>
            <SegmentedSelector
              value={config.lobbyMinutes}
              options={[
                { value: 5,  label: '5m'  },
                { value: 10, label: '10m' },
                { value: 15, label: '15m' },
              ]}
              onChange={v => set('lobbyMinutes', v)}
            />
          </div>

          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-label">Beanie in-hand value</span>
              <span className="settings-hint">Points if caught holding a Beanie</span>
            </div>
            <SegmentedSelector
              value={config.beanieHandValue}
              options={[
                { value: 10, label: '10pts' },
                { value: 25, label: '25pts' },
              ]}
              onChange={v => set('beanieHandValue', v)}
            />
          </div>

          <div className="settings-row">
            <div className="settings-row-label">
              <span className="settings-label">Reclaim own Beanie</span>
              <span className="settings-hint">Allow picking up your own laid Beanie</span>
            </div>
            <Toggle
              value={config.allowReclaimBeanie}
              onChange={v => set('allowReclaimBeanie', v)}
            />
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => actions.createRoom(config)}>
          Create room
        </button>
      </div>
    </div>
  );
}
