import { useState } from 'react';
import GameCard from './GameCard';
import { getTimerPreview } from '../offlineEngine';
import { previewEvolve, getCardLevel, getLevelLabel } from '../evolveEngine';
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

  const exitEvolveMode = () => {
    setMode('deck');
    setEvolveSelection([]);
    setEvolveMessage('');
  };

  const previewCard1 = evolveSelection[0] ? getCatalogCard(evolveSelection[0], profile) : null;
  const previewCard2 = evolveSelection[1] ? getCatalogCard(evolveSelection[1], profile) : null;
  const evolvePreview = previewCard1 && previewCard2 ? previewEvolve(previewCard1, previewCard2) : null;

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

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', margin: '20px 0 12px' }}>
        {mode === 'deck' ? `Your Cards (${uniqueCatalogCards.length})` : 'Choose Cards to Sacrifice'}
      </h3>
      <div className="collection-grid">
        {uniqueCatalogCards.map(({ card_id, key }) => {
          const catalog = getCatalogCard(card_id, profile);
          const inDeck = countInPlayDeck(playDeck, card_id);
          const owned = getCollectionCount(profile, card_id);
          const selected = mode === 'deck' ? inDeck > 0 : evolveSelection.includes(card_id);
          const canAdd = playDeck.length < PLAY_DECK_SIZE && inDeck < owned;
          const canSelectEvolve = mode === 'evolve' && (selected || evolveSelection.length < 2);
          const isEvolved = card_id.startsWith('evo_');
          const cardLevel = catalog ? getCardLevel(catalog) : 0;
          const levelLabel = getLevelLabel(cardLevel);
          const timerPreview = catalog?.timer != null
            ? Math.round(catalog.timer)
            : getTimerPreview(catalog?.attack ?? 0);

          return (
            <div
              key={key}
              className={[
                'library-card-wrap',
                selected ? (mode === 'deck' ? 'in-deck' : 'evolve-selected') : '',
                mode === 'deck' && !canAdd && !selected ? 'full' : '',
                mode === 'evolve' && !canSelectEvolve && !selected ? 'full' : '',
                isEvolved ? 'evolved-card' : '',
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
                selected={selected}
                showCooldown={false}
                cooldownPreview={timerPreview}
                levelLabel={levelLabel}
              />
            </div>
          );
        })}
      </div>

      {mode === 'evolve' && (
        <div className="evolve-panel">
          <h4 style={{ color: 'var(--accent-purple)', marginBottom: 8 }}>
            Evolve ({evolveSelection.length}/2 selected)
          </h4>
          {evolvePreview ? (
            <div className="evolve-preview">
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                Preview of the evolved card (stats are averaged from parents
                {evolvePreview.level === 2 ? '; Level 2 bonus applied' : ''}
                {evolvePreview.level === 3 ? '; Level 3 poison ability unlocked' : ''}):
              </p>
              <div className="evolve-preview-card">
                <GameCard
                  card={{
                    name: evolvePreview.name,
                    type: 'unique',
                    attack: evolvePreview.attack,
                    defense: evolvePreview.defense,
                    hp: evolvePreview.hp,
                    maxHp: evolvePreview.hp,
                    timer: evolvePreview.timer,
                    ability: evolvePreview.ability,
                    alive: true,
                  }}
                  showCooldown={false}
                  cooldownPreview={evolvePreview.timer}
                  levelLabel={getLevelLabel(evolvePreview.level)}
                />
              </div>
              {evolvePreview.level2Bonus && (
                <p className="level-bonus-text">Level 2 bonus: {evolvePreview.level2Bonus.label}</p>
              )}
              <p className="ability-text">{evolvePreview.ability.label}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select two cards above. Basic + basic or basic + Level 1 creates Level 1. Two Level 1 cards create Level 2 with a random stat boost. Two Level 2 cards create Level 3 with poison.
            </p>
          )}
          <button
            className="btn-primary"
            onClick={handleEvolve}
            disabled={evolveSelection.length < 2}
          >
            Evolve Cards
          </button>
        </div>
      )}
    </div>
  );
}
