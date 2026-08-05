import './index.css';
import ErrorBoundary      from './components/ErrorBoundary';
import { useGame }        from './hooks/useGame';
import NameScreen        from './screens/NameScreen';
import HomeScreen        from './screens/HomeScreen';
import CreateScreen      from './screens/CreateScreen';
import JoinScreen        from './screens/JoinScreen';
import LobbyScreen       from './screens/LobbyScreen';
import GameScreen        from './screens/GameScreen';
import RoundEndScreen    from './screens/RoundEndScreen';
import GameEndScreen     from './screens/GameEndScreen';
import HowToPlayScreen   from './screens/HowToPlayScreen';

export default function App() {
  const { state, actions, myPlayer, isMyTurn } = useGame();
  const { screen, roomCode, myId, game, error, timer, notice } = state;

  return (
    <ErrorBoundary>
    <div className="app">
      {/* Reconnecting overlay — only shown after first successful connect */}
      {!state.connected && state.everConnected && (
        <div className="reconnect-overlay">
          <div className="reconnect-box">
            <div className="reconnect-spinner" />
            <span>Reconnecting…</span>
          </div>
        </div>
      )}

      {screen === 'name' && (
        <NameScreen actions={actions} isEditing={!!state.playerName} />
      )}
      {screen === 'home' && (
        <HomeScreen actions={actions} playerName={state.playerName} />
      )}
      {screen === 'create' && (
        <CreateScreen error={error} actions={actions} />
      )}
      {screen === 'join' && (
        <JoinScreen error={error} actions={actions} initialCode={state.inviteCode} />
      )}
      {screen === 'lobby' && (
        <LobbyScreen
          game={game} roomCode={roomCode}
          myId={myId} error={error}
          actions={actions}
        />
      )}
      {screen === 'game' && game && (
        <GameScreen
          game={game} myId={myId}
          isMyTurn={isMyTurn} timer={timer}
          error={error} notice={notice}
          actions={actions}
        />
      )}
      {screen === 'round-end' && game && (
        <RoundEndScreen game={game} myId={myId} actions={actions} />
      )}
      {screen === 'game-end' && game && (
        <GameEndScreen game={game} myId={myId} actions={actions} />
      )}
      {screen === 'howtoplay' && (
        <HowToPlayScreen actions={actions} />
      )}
    </div>
    </ErrorBoundary>
  );
}
