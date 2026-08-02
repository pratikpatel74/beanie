import './index.css';
import { useGame }        from './hooks/useGame';
import HomeScreen        from './screens/HomeScreen';
import CreateScreen      from './screens/CreateScreen';
import JoinScreen        from './screens/JoinScreen';
import LobbyScreen       from './screens/LobbyScreen';
import GameScreen        from './screens/GameScreen';
import RoundEndScreen    from './screens/RoundEndScreen';
import GameEndScreen     from './screens/GameEndScreen';

export default function App() {
  const { state, actions, myPlayer, isMyTurn } = useGame();
  const { screen, roomCode, myId, game, error, timer, notice } = state;

  return (
    <div className="app">
      {screen === 'home' && (
        <HomeScreen actions={actions} />
      )}
      {screen === 'create' && (
        <CreateScreen error={error} actions={actions} />
      )}
      {screen === 'join' && (
        <JoinScreen error={error} actions={actions} />
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
    </div>
  );
}
