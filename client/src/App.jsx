import { useState, useEffect, useRef } from 'react';
import MainMenu from './components/MainMenu';
import Library from './components/Library';
import BattleView from './components/BattleView';
import {
  getOrCreateOfflineProfile,
  getPlayDeckIds,
  isPlayDeckComplete,
} from './api';
import {
  createOfflineGame,
  registerEvolvedCards,
  offlineSetup,
  offlineAttack,
  offlineChainAttack,
  offlineDrawCard,
  offlineReplace,
  offlineDismissReplacement,
  offlineBossSlow,
  offlineBossHeal,
  offlineBossHaste,
  getOfflineState,
  stopTicks,
  clearBattleAnimations,
} from './offlineEngine';

export default function App() {
  const [profile, setProfile] = useState(() => getOrCreateOfflineProfile());
  const [screen, setScreen] = useState('menu');
  const [gameState, setGameState] = useState(null);
  const offlineGameRef = useRef(null);

  const playDeckCount = profile.playDeck?.length || 0;
  const battleReady = isPlayDeckComplete(profile);

  useEffect(() => () => stopTicks(), []);

  const handleStartBattle = () => {
    if (!battleReady) return;
    stopTicks();
    const deck = getPlayDeckIds(profile);
    registerEvolvedCards(profile.evolvedCards || []);
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
  };

  const handleChainAttack = (attackerIds, defenderId) => {
    if (!offlineGameRef.current) return;
    offlineChainAttack(offlineGameRef.current, attackerIds, defenderId);
  };

  const handleDraw = () => {
    if (!offlineGameRef.current) return;
    offlineDrawCard(offlineGameRef.current);
  };

  const handleReplace = (handCardId, slotIndex) => {
    if (!offlineGameRef.current) return;
    offlineReplace(offlineGameRef.current, handCardId, slotIndex);
  };

  const handleDismissReplacement = () => {
    if (!offlineGameRef.current) return;
    offlineDismissReplacement(offlineGameRef.current);
  };

  const handleBossSlow = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossSlow(offlineGameRef.current, targetId);
  };

  const handleBossHeal = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossHeal(offlineGameRef.current, targetId);
  };

  const handleBossHaste = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossHaste(offlineGameRef.current, targetId);
  };

  const handleLeaveBattle = () => {
    if (offlineGameRef.current) clearBattleAnimations(offlineGameRef.current);
    stopTicks();
    offlineGameRef.current = null;
    setGameState(null);
    setScreen('menu');
  };

  return (
    <div className="app-container">
      <div className="header-bar">
        <h1>Card Fusion Battle</h1>
        <span className="user-info">{profile.username}</span>
      </div>

      {screen === 'menu' && (
        <MainMenu
          onLibrary={() => setScreen('library')}
          onBattle={handleStartBattle}
          playDeckCount={playDeckCount}
          battleReady={battleReady}
        />
      )}

      {screen === 'library' && (
        <Library
          profile={profile}
          onProfileChange={setProfile}
          onMainMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'battle' && (
        <BattleView
          gameState={gameState}
          onSetup={handleSetup}
          onAttack={handleAttack}
          onChainAttack={handleChainAttack}
          onDraw={handleDraw}
          onReplace={handleReplace}
          onDismissReplacement={handleDismissReplacement}
          onBossSlow={handleBossSlow}
          onBossHeal={handleBossHeal}
          onBossHaste={handleBossHaste}
          onMainMenu={handleLeaveBattle}
        />
      )}
    </div>
  );
}
