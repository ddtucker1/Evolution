import GameCard from './GameCard';
import { CARD_TIMER_MIN, CARD_TIMER_MAX, getLibraryCooldownSeconds } from '../offlineEngine';
import { PLAY_DECK_SIZE, getCatalogCard, getCollectionCount, countInPlayDeck, togglePlayDeckCard, clearPlayDeck } from '../api';

export default function Library({ profile, onProfileChange, onMainMenu }) {
  const playDeck = profile.playDeck || [];
  const deckComplete = playDeck.length === PLAY_DECK_SIZE;

  const expandedCollection = [];
  for (const { card_id, quantity } of profile.collection || []) {
    for (let i = 0; i < quantity; i++) {
      expandedCollection.push({ card_id, key: `${card_id}_${i}` });
    }
  }

  const handleToggle = (cardId) => {
    onProfileChange(togglePlayDeckCard(profile, cardId));
  };

  const handleClear = () => {
    onProfileChange(clearPlayDeck(profile));
  };

  return (
    <div>
      <div className="library-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 4 }}>
            Library
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Tap fighter, defender, and boss cards to add or remove them from your play deck.
            {' '}Each card shows a sample cooldown between <strong>{CARD_TIMER_MIN}–{CARD_TIMER_MAX} seconds</strong> before it can attack again in battle.
          </p>
        </div>
        <div className="library-actions">
          <span className={`deck-counter${deckComplete ? ' complete' : ''}`}>
            Play deck: {playDeck.length}/{PLAY_DECK_SIZE}
          </span>
          <button className="btn-secondary" onClick={handleClear} disabled={!playDeck.length}>
            Clear deck
          </button>
          <button className="btn-primary" onClick={onMainMenu}>
            Main Menu
          </button>
        </div>
      </div>

      {deckComplete && (
        <div className="toast success-toast">
          Play deck complete! Return to Main Menu and start Battle.
        </div>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', margin: '20px 0 12px' }}>
        Your Cards
      </h3>
      <div className="collection-grid">
        {expandedCollection
          .filter(({ card_id }) => getCatalogCard(card_id))
          .map(({ card_id, key }) => {
          const catalog = getCatalogCard(card_id);
          const inDeck = countInPlayDeck(playDeck, card_id);
          const owned = getCollectionCount(profile, card_id);
          const selected = inDeck > 0;
          const canAdd = playDeck.length < PLAY_DECK_SIZE && inDeck < owned;

          return (
            <div
              key={key}
              className={`library-card-wrap${selected ? ' in-deck' : ''}${!canAdd && !selected ? ' full' : ''}`}
              onClick={() => (selected || canAdd) && handleToggle(card_id)}
            >
              {inDeck > 0 && <span className="deck-badge">{inDeck} in deck</span>}
              <GameCard
                card={{
                  name: catalog?.name || card_id,
                  type: 'unique',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
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
    </div>
  );
}
