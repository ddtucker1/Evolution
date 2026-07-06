import { useMemo, useState } from 'react';
import GameCard from './GameCard';
import { getTimerPreview } from '../offlineEngine';
import { getCardLevel, getLevelDigit } from '../combineEngine';
import { canCombineWithLibrarySize } from '../../../shared/combineRules.js';
import {
  PLAY_DECK_SIZE,
  getCatalogCard,
  getCollectionCount,
  countInPlayDeck,
  togglePlayDeckCard,
  clearPlayDeck,
  combineCards,
  getLibraryCardCount,
} from '../api';

export default function Library({ profile, onProfileChange, onMainMenu }) {
  const [mode, setMode] = useState('deck');
  const [sortBy, setSortBy] = useState('level');
  const [combineSelection, setCombineSelection] = useState([]);
  const [combineMessage, setCombineMessage] = useState('');
  const [showCombineBlockedPopup, setShowCombineBlockedPopup] = useState(false);

  const libraryCardCount = getLibraryCardCount(profile);
  const combineBlocked = !canCombineWithLibrarySize(libraryCardCount);
  const playDeck = profile.playDeck || [];
  const deckComplete = playDeck.length === PLAY_DECK_SIZE;

  const expandedCollection = [];
  for (const { card_id, quantity } of profile.collection || []) {
    for (let i = 0; i < quantity; i++) {
      expandedCollection.push({ card_id, key: `${card_id}_${i}` });
    }
  }

  const uniqueCatalogCards = expandedCollection.filter(({ card_id }) => getCatalogCard(card_id, profile));

  const sortedCatalogCards = useMemo(() => {
    const getSortValue = (cardId) => {
      const catalog = getCatalogCard(cardId, profile);
      if (!catalog) return 0;
      switch (sortBy) {
        case 'attack':
          return catalog.attack ?? 0;
        case 'defense':
          return catalog.defense ?? 0;
        case 'hp':
          return catalog.hp ?? 0;
        case 'timer':
          return catalog.timer != null
            ? Math.round(catalog.timer)
            : getTimerPreview(catalog.attack ?? 0);
        case 'level':
        default:
          return getCardLevel(catalog);
      }
    };

    const ascending = sortBy === 'timer';

    return [...uniqueCatalogCards].sort((a, b) => {
      const diff = getSortValue(a.card_id) - getSortValue(b.card_id);
      if (diff !== 0) return ascending ? diff : -diff;
      return a.key.localeCompare(b.key);
    });
  }, [uniqueCatalogCards, profile, sortBy]);

  const handleToggle = (cardId) => {
    onProfileChange(togglePlayDeckCard(profile, cardId));
  };

  const handleClear = () => {
    onProfileChange(clearPlayDeck(profile));
  };

  const toggleCombineSelection = (entry) => {
    setCombineMessage('');
    const catalog = getCatalogCard(entry.card_id, profile);
    const level = getCardLevel(catalog);

    setCombineSelection((prev) => {
      if (prev.some((s) => s.key === entry.key)) {
        return prev.filter((s) => s.key !== entry.key);
      }
      if (prev.length === 0) return [entry];
      if (prev.length === 1) {
        const firstCatalog = getCatalogCard(prev[0].card_id, profile);
        const firstLevel = getCardLevel(firstCatalog);
        if (firstLevel !== level) {
          setCombineMessage('Cards must be the same level. Selection cleared — pick two matching cards.');
          return [];
        }
        return [...prev, entry];
      }
      return prev;
    });
  };

  const finalizeCombine = () => {
    if (combineSelection.length < 2) return;
    const [first, second] = combineSelection;
    const result = combineCards(profile, first.card_id, second.card_id);
    if (result.error) {
      if (result.error === 'Less than 10 cards not allowed') {
        setShowCombineBlockedPopup(true);
      } else {
        setCombineMessage(result.error);
      }
      return;
    }
    onProfileChange(result.profile);
    setCombineSelection([]);
    setCombineMessage(`Combined into ${result.combined.name}!`);
  };

  const handleCombineConfirm = () => {
    finalizeCombine();
  };

  const cancelCombine = () => {
    setCombineSelection([]);
  };

  const enterCombineMode = () => {
    if (combineBlocked) {
      setShowCombineBlockedPopup(true);
      return;
    }
    setMode('combine');
  };

  const exitCombineMode = () => {
    setMode('deck');
    setCombineSelection([]);
    setCombineMessage('');
  };

  const showCombineConfirm = mode === 'combine' && combineSelection.length === 2;

  return (
    <div>
      <div className="library-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 4 }}>
            Library
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'deck' && (
              <>
                You have {uniqueCatalogCards.length} unique cards. Tap cards to add or remove them from your play deck (choose {PLAY_DECK_SIZE}).
                {' '}Each card&apos;s attack timer is <strong>attack × 2 seconds</strong> (±2s random variance in battle).
              </>
            )}
          </p>
        </div>
        <div className="library-actions">
          {mode === 'deck' ? (
            <>
              <span className={`deck-counter${deckComplete ? ' complete' : ''}`}>
                Play deck: {playDeck.length}/{PLAY_DECK_SIZE}
              </span>
              <button className="btn-secondary" onClick={handleClear} disabled={!playDeck.length}>
                Clear deck
              </button>
              <button className="btn-gold" onClick={enterCombineMode}>
                Combine
              </button>
            </>
          ) : (
            <>
              <span className="deck-counter evolve-counter">
                Selected: {combineSelection.length}/2
              </span>
              <button className="btn-secondary" onClick={exitCombineMode}>
                Back to deck
              </button>
            </>
          )}
          <button className="btn-primary" onClick={onMainMenu}>
            Main Menu
          </button>
        </div>
      </div>

      {deckComplete && mode === 'deck' && (
        <div className="toast success-toast">
          Play deck complete! Return to Main Menu and start Battle.
        </div>
      )}

      {combineMessage && (
        <div className={`toast${combineMessage.startsWith('Combined') ? ' success-toast' : ''}`}>
          {combineMessage}
        </div>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', margin: '20px 0 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span>{mode === 'deck' ? `Your Cards (${uniqueCatalogCards.length})` : 'Choose Cards to Combine'}</span>
        <label className="library-sort-control">
          <span className="library-sort-label">Sort by</span>
          <select
            className="library-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="level">Level</option>
            <option value="attack">Attack</option>
            <option value="defense">Defense</option>
            <option value="hp">HP</option>
            <option value="timer">Timer</option>
          </select>
        </label>
      </h3>
      <div className="collection-grid">
        {sortedCatalogCards.map((entry) => {
          const { card_id, key } = entry;
          const catalog = getCatalogCard(card_id, profile);
          const inDeck = countInPlayDeck(playDeck, card_id);
          const owned = getCollectionCount(profile, card_id);
          const selected = mode === 'deck'
            ? inDeck > 0
            : combineSelection.some((s) => s.key === key);
          const canAdd = playDeck.length < PLAY_DECK_SIZE && inDeck < owned;
          const canSelectCombine = mode === 'combine'
            && !combineBlocked
            && (selected || combineSelection.length < 2);
          const isCombined = card_id.startsWith('evo_');
          const levelDigit = catalog ? getLevelDigit(catalog) : '0';
          const timerPreview = catalog?.timer != null
            ? Math.round(catalog.timer)
            : getTimerPreview(catalog?.attack ?? 0);

          return (
            <div
              key={key}
              className={[
                'library-card-wrap',
                selected ? 'selected' : '',
                mode === 'deck' && !canAdd && !selected ? 'full' : '',
                mode === 'combine' && !canSelectCombine && !selected ? 'full' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (mode === 'deck' && (selected || canAdd)) handleToggle(card_id);
                if (mode === 'combine' && canSelectCombine) toggleCombineSelection(entry);
              }}
            >
              {mode === 'deck' && inDeck > 0 && <span className="deck-badge">{inDeck} in deck</span>}
              {mode === 'combine' && selected && <span className="deck-badge evolve-badge">Combine</span>}
              <GameCard
                card={{
                  name: catalog?.name || card_id,
                  type: 'unique',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
                  timer: catalog?.timer,
                  alive: true,
                  isBase: !isCombined,
                }}
                showCooldown={false}
                cooldownPreview={timerPreview}
                levelDigit={levelDigit}
              />
            </div>
          );
        })}
      </div>

      {showCombineConfirm && (
        <div className="target-overlay" onClick={cancelCombine}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Combine Cards?</h3>
            <p className="confirm-dialog-text">
              Sacrifice these two cards to combine them into a new card?
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn-primary" onClick={handleCombineConfirm}>
                Confirm
              </button>
              <button type="button" className="btn-secondary" onClick={cancelCombine}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showCombineBlockedPopup && (
        <div className="target-overlay" onClick={() => setShowCombineBlockedPopup(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-dialog-text">Less than 10 cards not allowed</p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowCombineBlockedPopup(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
