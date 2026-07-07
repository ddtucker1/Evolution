import { useState, useEffect, useRef } from 'react';
import MainMenu from './components/MainMenu';
import Library from './components/Library';
import BattleView from './components/BattleView';
import AbilityHelp from './components/AbilityHelp';
import useBattleMusic from './hooks/useBattleMusic';
import { resumeBattleMusicIfPaused } from './audio/gameAudio';
import {
  getOrCreateOfflineProfile,
  getPlayDeckIds,
  isPlayDeckComplete,
} from './api';
import useBattleBackground from './hooks/useBattleBackground';
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
  offlineBossAttack2x,
  offlineBossDefenseHalved,
  getOfflineState,
  stopTicks,
  clearBattleAnimations,
  toggleOfflinePause,
  toggleGameSpeed,
} from './offlineEngine';

export default function App() {
  const [profile, setProfile] = useState(() => getOrCreateOfflineProfile());
  const [screen, setScreen] = useState('menu');
  const [gameState, setGameState] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const offlineGameRef = useRef(null);

  const playDeckCount = profile.playDeck?.length || 0;
  const battleReady = isPlayDeckComplete(profile);
  const battleBackgroundUrl = useBattleBackground(screen === 'battle');

  useEffect(() => () => stopTicks(), []);
  useBattleMusic(screen, gameState);

  const resumeMusicOnInteraction = () => {
    if (screen === 'battle' && !gameState?.gamePaused) resumeBattleMusicIfPaused();
  };

  const handleStartBattle = () => {
    if (!battleReady) return;
    if (offlineGameRef.current) clearBattleAnimations(offlineGameRef.current);
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

  const handleBossHeal = () => {
    if (!offlineGameRef.current) return;
    offlineBossHeal(offlineGameRef.current);
  };

  const handleBossHaste = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossHaste(offlineGameRef.current, targetId);
  };

  const handleBossAttack2x = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossAttack2x(offlineGameRef.current, targetId);
  };

  const handleBossDefenseHalved = (targetId) => {
    if (!offlineGameRef.current) return;
    offlineBossDefenseHalved(offlineGameRef.current, targetId);
  };

  const handleTogglePause = () => {
    if (!offlineGameRef.current) return;
    toggleOfflinePause(offlineGameRef.current);
  };

  const handleToggleSpeed = () => {
    if (!offlineGameRef.current) return;
    toggleGameSpeed(offlineGameRef.current);
  };

  const handleLeaveBattle = () => {
    if (offlineGameRef.current) clearBattleAnimations(offlineGameRef.current);
    stopTicks();
    offlineGameRef.current = null;
    setGameState(null);
    setScreen('menu');
  };

  return (
    <div
      className={`app-container${screen === 'battle' ? ' battle-active' : ''}`}
      onClick={resumeMusicOnInteraction}
    >
      {screen === 'battle' && battleBackgroundUrl && (
        <div
          className="battle-background-layer"
          style={{ backgroundImage: `url(${battleBackgroundUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="header-bar">
        <h1>Card Fusion Battle</h1>
        <div className="header-actions">
          {screen !== 'battle' && (
            <button type="button" className="btn-secondary" onClick={() => setShowHelp(true)}>
              Help
            </button>
          )}
          {screen !== 'battle' && (
            <span className="user-info">{profile.username}</span>
          )}
        </div>
      </div>

      <AbilityHelp open={showHelp} onClose={() => setShowHelp(false)} />

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
          onBossAttack2x={handleBossAttack2x}
          onBossDefenseHalved={handleBossDefenseHalved}
          onMainMenu={handleLeaveBattle}
          onTogglePause={handleTogglePause}
          onToggleSpeed={handleToggleSpeed}
          onShowHelp={() => setShowHelp(true)}
        />
      )}
    </div>
  );
}
