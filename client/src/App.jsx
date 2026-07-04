import { useState, useEffect, useRef } from 'react';
import Lobby from './components/Lobby';
import BattleView from './components/BattleView';
import { getOrCreateOfflineProfile, getDeckCardIds } from './api';
import {
  createOfflineGame, offlineSetup, offlineAttack, offlineUseStandard,
  getOfflineState, stopTicks, clearAttackAnimation, CARD_DATA,
} from './offlineEngine';

export default function App() {
  const [user] = useState(() => getOrCreateOfflineProfile());
  const [screen, setScreen] = useState('lobby');
  const [gameState, setGameState] = useState(null);
  const offlineGameRef = useRef(null);

  useEffect(() => {
    return () => stopTicks();
  }, []);

  const handleStartNPC = () => {
    stopTicks();
    const deck = getDeckCardIds(user);
    const game = createOfflineGame(deck);
    game.onUpdate = (state) => setGameState(state);
    offlineGameRef.current = game;
    setGameState(getOfflineState(game));
    setScreen('battle');
  };

  const handleSetup = (bossId, fieldIds) => {
    if (!offlineGameRef.current) return;
    offlineSetup(offlineGameRef.current, bossId, fieldIds);
    setGameState(getOfflineState(offlineGameRef.current));
  };

  const handleAttack = (attackerId, defenderId) => {
    if (!offlineGameRef.current) return;
    offlineAttack(offlineGameRef.current, attackerId, defenderId);
    // State updates via game.onUpdate during attack animation
    if (!offlineGameRef.current.attackAnimation) {
      setGameState(getOfflineState(offlineGameRef.current));
    }
  };

  const handleUseStandard = (cardId, targetId, targetPlayerId) => {
    if (!offlineGameRef.current) return;
    offlineUseStandard(offlineGameRef.current, cardId, targetId, targetPlayerId);
    setGameState(getOfflineState(offlineGameRef.current));
  };

  const handleLeaveGame = () => {
    if (offlineGameRef.current) clearAttackAnimation(offlineGameRef.current);
    stopTicks();
    offlineGameRef.current = null;
    setGameState(null);
    setScreen('lobby');
  };

  return (
    <>
      <div className="offline-banner">Prototype — NPC battles only. Unique card stats are randomized each battle.</div>

      <div className="app-container">
        <div className="header-bar">
          <h1>Card Fusion Battle</h1>
          <span className="user-info">{user.username}</span>
        </div>

        {screen === 'lobby' && (
          <Lobby onStartNPC={handleStartNPC} cardCount={CARD_DATA.unique.length} />
        )}

        {screen === 'battle' && (
          <BattleView
            gameState={gameState}
            onSetup={handleSetup}
            onAttack={handleAttack}
            onUseStandard={handleUseStandard}
            onLeave={handleLeaveGame}
            isOffline
          />
        )}
      </div>
    </>
  );
}
