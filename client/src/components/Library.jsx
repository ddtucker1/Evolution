import { useState } from 'react';
import GameCard from './GameCard';
import { CARD_TIMER_MIN, CARD_TIMER_MAX, getLibraryCooldownSeconds } from '../offlineEngine';
import { previewEvolve } from '../evolveEngine';
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
                {' '}Each card shows a sample cooldown between <strong>{CARD_TIMER_MIN}–{CARD_TIMER_MAX} seconds</strong> before it can attack again in battle.
              </>
            ) : (
              <>
                Select two cards to sacrifice. They will merge into a new evolved fighter with averaged stats and a special attack ability.
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
              {isEvolved && <span className="deck-badge evolved-badge">Evolved</span>}
              <GameCard
                card={{
                  name: catalog?.name || card_id,
                  type: 'unique',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
                  ability: catalog?.ability,
                  alive: true,
                }}
                selected={selected}
                showCooldown={false}
                cooldownPreview={getLibraryCooldownSeconds(key)}
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
                Preview of the evolved card (stats are averaged; ability is chosen from the fusion):
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
                    ability: evolvePreview.ability,
                    alive: true,
                  }}
                  showCooldown={false}
                />
              </div>
              <p className="ability-text">{evolvePreview.ability.label}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select two cards above. Their attack, defense, and HP will be averaged into a new evolved fighter with a special ability.
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
