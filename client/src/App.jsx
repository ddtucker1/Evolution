import { useState, useEffect, useCallback, useRef } from 'react';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import BattleView from './components/BattleView';
import Collection from './components/Collection';
import {
  api, setToken, clearToken, getToken, checkOnline,
  getOrCreateOfflineProfile, saveOfflineProfile, getDeckCardIds,
} from './api';
import { connectSocket, disconnectSocket, getSocket } from './socket';
import {
  createOfflineGame, offlineSetup, offlineAttack, offlineUseStandard,
  getOfflineState, stopTicks,
} from './offlineEngine';

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState(null);
  const [cardCatalog, setCardCatalog] = useState(null);
  const [screen, setScreen] = useState('auth');
  const [gameState, setGameState] = useState(null);
  const [matchmaking, setMatchmaking] = useState(null);
  const [toast, setToast] = useState('');
  const offlineGameRef = useRef(null);
  const isOfflineMode = useRef(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const checkConnection = useCallback(async () => {
    const online = await checkOnline();
    setIsOnline(online);
    return online;
  }, []);

  useEffect(() => {
    const handleOnline = () => checkConnection();
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkConnection();

    const token = getToken();
    if (token) {
      api('/api/profile')
        .then(profile => { setUser(profile); setScreen('lobby'); })
        .catch(() => clearToken());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      disconnectSocket();
      stopTicks();
    };
  }, [checkConnection]);

  useEffect(() => {
    if (isOnline) {
      api('/api/cards').then(setCardCatalog).catch(() => {});
    } else {
      import('./offlineEngine').then(m => setCardCatalog({ unique: m.CARD_DATA.unique, standard: m.CARD_DATA.standard }));
    }
  }, [isOnline]);

  const setupSocket = useCallback(() => {
    const socket = connectSocket();
    if (!socket) return null;

    socket.off('game_state');
    socket.off('match_found');
    socket.off('matchmaking');
    socket.off('error');
    socket.off('card_won');
    socket.off('card_lost');

    socket.on('game_state', (state) => setGameState(state));
    socket.on('match_found', () => { setMatchmaking(null); setScreen('battle'); });
    socket.on('matchmaking', (data) => setMatchmaking(data));
    socket.on('matchmaking_cancelled', () => setMatchmaking(null));
    socket.on('error', (data) => showToast(data.message));
    socket.on('card_won', (data) => showToast(`You won a card: ${data.cardId}!`));
    socket.on('card_lost', (data) => showToast(`You lost a card: ${data.cardId}`));

    return socket;
  }, []);

  const handleLogin = async (username, password, mode) => {
    if (mode === 'offline') {
      const profile = getOrCreateOfflineProfile();
      setUser(profile);
      isOfflineMode.current = true;
      setScreen('lobby');
      return;
    }

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ username, password }) });
    setToken(data.token);
    setUser(data.user);
    isOfflineMode.current = false;
    setScreen('lobby');
    setupSocket();
  };

  const handleLogout = () => {
    clearToken();
    disconnectSocket();
    stopTicks();
    offlineGameRef.current = null;
    setUser(null);
    setGameState(null);
    setScreen('auth');
    isOfflineMode.current = false;
  };

  const handleStartNPC = () => {
    if (isOfflineMode.current || !isOnline) {
      const deck = getDeckCardIds(user);
      const game = createOfflineGame(deck);
      game.onUpdate = (state) => setGameState(state);
      offlineGameRef.current = game;
      setGameState(getOfflineState(game));
      setScreen('battle');
      return;
    }
    const socket = setupSocket() || getSocket();
    socket?.emit('start_npc_battle');
    setScreen('battle');
  };

  const handleFindMatch = (mode) => {
    const socket = setupSocket() || getSocket();
    socket?.emit('find_match', { mode });
    setMatchmaking({ mode, message: 'Searching for opponent...' });
  };

  const handleCancelMatch = () => {
    const socket = getSocket();
    if (matchmaking?.mode) socket?.emit('cancel_matchmaking', { mode: matchmaking.mode });
    setMatchmaking(null);
  };

  const handleSetup = (bossId, fieldIds) => {
    if (offlineGameRef.current) {
      offlineSetup(offlineGameRef.current, bossId, fieldIds);
      setGameState(getOfflineState(offlineGameRef.current));
      return;
    }
    getSocket()?.emit('setup', { bossInstanceId: bossId, fieldInstanceIds: fieldIds });
  };

  const handleAttack = (attackerId, defenderId) => {
    if (offlineGameRef.current) {
      offlineAttack(offlineGameRef.current, attackerId, defenderId);
      setGameState(getOfflineState(offlineGameRef.current));
      return;
    }
    getSocket()?.emit('attack', { attackerInstanceId: attackerId, defenderInstanceId: defenderId });
  };

  const handleUseStandard = (cardId, targetId, targetPlayerId) => {
    if (offlineGameRef.current) {
      offlineUseStandard(offlineGameRef.current, cardId, targetId, targetPlayerId);
      setGameState(getOfflineState(offlineGameRef.current));
      return;
    }
    getSocket()?.emit('use_standard_card', { cardInstanceId: cardId, targetInstanceId: targetId, targetPlayerId });
  };

  const handleLeaveGame = () => {
    stopTicks();
    offlineGameRef.current = null;
    if (!isOfflineMode.current) getSocket()?.emit('leave_game');
    setGameState(null);
    setScreen('lobby');
  };

  const handleFuse = async (cardIds) => {
    const result = await api('/api/fuse', { method: 'POST', body: JSON.stringify({ cardIds }) });
    setUser(result.user);
    return result;
  };

  const handleUpgrade = async () => {
    const result = await api('/api/upgrade-deck', { method: 'POST', body: JSON.stringify({}) });
    setUser(result.user);
    return result;
  };

  if (screen === 'auth') {
    return (
      <>
        {!isOnline && <div className="offline-banner">Offline — Multiplayer unavailable</div>}
        <Auth onLogin={handleLogin} isOnline={isOnline} />
      </>
    );
  }

  return (
    <>
      {isOnline ? (
        <div className="online-banner">● Online</div>
      ) : (
        <div className="offline-banner">Offline Mode — NPC battles only. Multiplayer requires internet.</div>
      )}

      <div className="app-container">
        <div className="header-bar">
          <h1>Card Fusion Battle</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="user-info">{user?.username}</span>
            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        {screen !== 'battle' && (
          <div className="nav-tabs">
            <button className={`nav-tab ${screen === 'lobby' ? 'active' : ''}`} onClick={() => setScreen('lobby')}>Battle</button>
            <button className={`nav-tab ${screen === 'collection' ? 'active' : ''}`} onClick={() => setScreen('collection')}>Collection</button>
          </div>
        )}

        {screen === 'lobby' && (
          <Lobby
            isOnline={isOnline && !isOfflineMode.current}
            onStartNPC={handleStartNPC}
            onFindMatch={handleFindMatch}
            onCancelMatch={handleCancelMatch}
            matchmaking={matchmaking}
            onPlayOffline={handleStartNPC}
          />
        )}

        {screen === 'collection' && (
          <Collection
            user={user}
            cardCatalog={cardCatalog}
            onFuse={handleFuse}
            onUpgrade={handleUpgrade}
            isOnline={isOnline && !isOfflineMode.current}
          />
        )}

        {screen === 'battle' && (
          <BattleView
            gameState={gameState}
            onSetup={handleSetup}
            onAttack={handleAttack}
            onUseStandard={handleUseStandard}
            onLeave={handleLeaveGame}
            isOffline={isOfflineMode.current || !isOnline}
          />
        )}
      </div>

      <div className="mobile-bottom-nav">
        <button className={screen === 'lobby' ? 'active' : ''} onClick={() => setScreen('lobby')}>⚔ Battle</button>
        <button className={screen === 'collection' ? 'active' : ''} onClick={() => setScreen('collection')}>🃏 Cards</button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
