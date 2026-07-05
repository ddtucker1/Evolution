import { useState } from 'react';
import GameCard from './GameCard';

const CARD_NAMES = {
  uni_knight: 'Steel Knight', uni_archer: 'Shadow Archer', uni_mage: 'Flame Mage',
  uni_golem: 'Stone Golem', uni_rogue: 'Night Rogue', uni_paladin: 'Holy Paladin',
  uni_berserker: 'Blood Berserker', uni_druid: 'Forest Druid', uni_wraith: 'Soul Wraith',
  uni_titan: 'Storm Titan', uni_phoenix: 'Ember Phoenix', uni_serpent: 'Viper Serpent',
  std_shield: 'Iron Shield', std_sword: 'Sharpening Stone', std_poison: 'Venom Vial',
  std_curse: 'Weakening Curse', std_heal: 'Healing Potion', std_bolt: 'Lightning Bolt',
  std_haste: 'Haste Charm', std_fortify: 'Fortify',
};

export default function Collection({ user, cardCatalog, onUpgrade, isOnline }) {
  const [message, setMessage] = useState('');

  const handleUpgrade = async () => {
    try {
      await onUpgrade();
      setMessage('Deck cap upgraded to 60 cards!');
    } catch (err) {
      setMessage(err.message);
    }
  };

  const expandedCards = [];
  for (const { card_id, quantity } of user?.cards || []) {
    for (let i = 0; i < quantity; i++) {
      expandedCards.push({ card_id, key: `${card_id}_${i}` });
    }
  }

  const isUnique = (id) => id.startsWith('uni_') || id.startsWith('evo_');

  return (
    <div>
      <div className="deck-info">
        <span>Deck: {user?.deckCount || 0} / {user?.deckCap || 50} cards</span>
        {user?.premium && <span style={{ color: 'var(--accent-gold)' }}>★ Premium</span>}
      </div>

      {!user?.premium && isOnline && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, marginBottom: 12 }}>Expand your deck cap from 50 to 60 cards</p>
          <button className="btn-gold" onClick={handleUpgrade}>Upgrade for $1.00</button>
        </div>
      )}

      {message && <div className="toast">{message}</div>}

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 12 }}>
        Your Collection
      </h3>
      <div className="collection-grid">
        {expandedCards.map(({ card_id, key }) => {
          const catalog = [...(cardCatalog?.unique || []), ...(cardCatalog?.standard || [])].find(c => c.id === card_id);
          return (
            <div key={key}>
              <GameCard
                card={{
                  name: catalog?.name || CARD_NAMES[card_id] || card_id,
                  type: isUnique(card_id) ? 'unique' : 'standard',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
                  effect: catalog?.effect,
                  value: catalog?.value,
                  alive: true,
                }}
                showCooldown={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
