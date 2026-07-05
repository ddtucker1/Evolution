import { useMemo, useState } from 'react';
import GameCard from './GameCard';
import { getTimerPreview } from '../offlineEngine';
import { getCardLevel, getLevelDigit } from '../evolveEngine';
import {
  PLAY_DECK_SIZE,
  getCatalogCard,
  getCollectionCount,
  countInPlayDeck,
  togglePlayDeckCard,
  clearPlayDeck,
  evolveCards,
} from '../api';

export default function Library({ profile, onProfileChange, onMainMenu }) {
  const [mode, setMode] = useState('deck');
  const [sortBy, setSortBy] = useState('level');
  const [evolveSelection, setEvolveSelection] = useState([]);
  const [evolveMessage, setEvolveMessage] = useState('');

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
      return a.card_id.localeCompare(b.card_id);
    });
  }, [uniqueCatalogCards, profile, sortBy]);

  const handleToggle = (cardId) => {
    onProfileChange(togglePlayDeckCard(profile, cardId));
  };

  const handleClear = () => {
    onProfileChange(clearPlayDeck(profile));
  };

  const toggleEvolveSelection = (cardId) => {
    setEvolveMessage('');
    setEvolveSelection((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 2) return prev;
      return [...prev, cardId];
    });
  };

  const handleEvolve = () => {
    if (evolveSelection.length < 2) return;
    const [cardId1, cardId2] = evolveSelection;
    const result = evolveCards(profile, cardId1, cardId2);
    if (result.error) {
      setEvolveMessage(result.error);
      return;
    }
    onProfileChange(result.profile);
    setEvolveSelection([]);
    setEvolveMessage(`Evolved ${result.evolved.name}!`);
  };

  const cancelEvolve = () => {
    setEvolveSelection([]);
  };

  const exitEvolveMode = () => {
    setMode('deck');
    setEvolveSelection([]);
    setEvolveMessage('');
  };

  const showEvolveConfirm = mode === 'evolve' && evolveSelection.length === 2;

  return (
    <div>
      <div className="library-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 4 }}>
            Library
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'deck' ? (
              <>
                You have {uniqueCatalogCards.length} unique cards. Tap cards to add or remove them from your play deck (choose {PLAY_DECK_SIZE}).
                {' '}Each card&apos;s attack timer is <strong>attack × 2 seconds</strong> (±2s random variance in battle).
              </>
            ) : (
              <>
                Select two cards to sacrifice. Two basic cards or a basic plus Level 1 card produce a Level 1 fighter.
                Two Level 1 cards evolve into Level 2, gaining a random +2 stat boost or a 2-second timer reduction.
                Two Level 2 cards evolve into Level 3, unlocking a poison attack that drains 1 HP every 5 seconds.
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
              <button className="btn-gold" onClick={() => setMode('evolve')}>
                Evolve
              </button>
            </>
          ) : (
            <>
              <span className="deck-counter evolve-counter">
                Sacrifice: {evolveSelection.length}/2
              </span>
              <button className="btn-secondary" onClick={exitEvolveMode}>
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

      {evolveMessage && (
        <div className={`toast${evolveMessage.startsWith('Evolved') ? ' success-toast' : ''}`}>
          {evolveMessage}
        </div>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', margin: '20px 0 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span>{mode === 'deck' ? `Your Cards (${uniqueCatalogCards.length})` : 'Choose Cards to Sacrifice'}</span>
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
        {sortedCatalogCards.map(({ card_id, key }) => {
          const catalog = getCatalogCard(card_id, profile);
          const inDeck = countInPlayDeck(playDeck, card_id);
          const owned = getCollectionCount(profile, card_id);
          const selected = mode === 'deck' ? inDeck > 0 : evolveSelection.includes(card_id);
          const canAdd = playDeck.length < PLAY_DECK_SIZE && inDeck < owned;
          const canSelectEvolve = mode === 'evolve' && (selected || evolveSelection.length < 2);
          const isEvolved = card_id.startsWith('evo_');
          const cardLevel = catalog ? getCardLevel(catalog) : 0;
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
                mode === 'evolve' && !canSelectEvolve && !selected ? 'full' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (mode === 'deck' && (selected || canAdd)) handleToggle(card_id);
                if (mode === 'evolve' && canSelectEvolve) toggleEvolveSelection(card_id);
              }}
            >
              {mode === 'deck' && inDeck > 0 && <span className="deck-badge">{inDeck} in deck</span>}
              {mode === 'evolve' && selected && <span className="deck-badge evolve-badge">Sacrifice</span>}
              <GameCard
                card={{
                  name: catalog?.name || card_id,
                  type: 'unique',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
                  timer: catalog?.timer,
                  ability: catalog?.ability,
                  alive: true,
                  isBase: !isEvolved,
                }}
                showCooldown={false}
                cooldownPreview={timerPreview}
                levelDigit={levelDigit}
              />
            </div>
          );
        })}
      </div>

      {showEvolveConfirm && (
        <div className="target-overlay" onClick={cancelEvolve}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Evolve Cards?</h3>
            <p className="confirm-dialog-text">
              Sacrifice these two cards to evolve them into a new card?
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn-primary" onClick={handleEvolve}>
                Confirm
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEvolve}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
