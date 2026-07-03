import { useState } from 'react';
import GameCard from './GameCard';

const CARD_NAMES = {
  uni_knight: 'Steel Knight', uni_archer: 'Shadow Archer', uni_mage: 'Flame Mage',
  uni_golem: 'Stone Golem', uni_rogue: 'Night Rogue', uni_paladin: 'Holy Paladin',
  uni_berserker: 'Blood Berserker', uni_druid: 'Forest Druid', uni_wraith: 'Soul Wraith',
  uni_titan: 'Storm Titan', uni_phoenix: 'Ember Phoenix', uni_serpent: 'Viper Serpent',
  fus_guardian: 'Divine Guardian', fus_assassin: 'Phantom Assassin', fus_inferno: 'Inferno Lord',
  fus_colossus: 'Ancient Colossus', fus_reaper: 'Death Reaper', fus_stormlord: 'Stormlord',
  std_shield: 'Iron Shield', std_sword: 'Sharpening Stone', std_poison: 'Venom Vial',
  std_curse: 'Weakening Curse', std_heal: 'Healing Potion', std_bolt: 'Lightning Bolt',
  std_haste: 'Haste Charm', std_fortify: 'Fortify',
};

export default function Collection({ user, cardCatalog, onFuse, onUpgrade, isOnline }) {
  const [fuseSelection, setFuseSelection] = useState([]);
  const [message, setMessage] = useState('');

  const toggleFuse = (cardId) => {
    setFuseSelection(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length >= 3) return prev;
      return [...prev, cardId];
    });
  };

  const handleFuse = async () => {
    if (fuseSelection.length < 2) return;
    try {
      const result = await onFuse(fuseSelection);
      setMessage(`Created: ${result.output?.name || 'new card'}!`);
      setFuseSelection([]);
    } catch (err) {
      setMessage(err.message);
    }
  };

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

  const isUnique = (id) => id.startsWith('uni_') || id.startsWith('fus_');

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
          const selected = fuseSelection.includes(card_id);
          return (
            <div
              key={key}
              onClick={() => isUnique(card_id) && isOnline && toggleFuse(card_id)}
              style={{ cursor: isUnique(card_id) && isOnline ? 'pointer' : 'default' }}
            >
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
                selected={selected}
                showCooldown={false}
              />
            </div>
          );
        })}
      </div>

      {isOnline && fuseSelection.length > 0 && (
        <div className="fusion-panel">
          <h4 style={{ color: 'var(--accent-purple)', marginBottom: 8 }}>Fusion ({fuseSelection.length}/3 selected)</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Select 2 or 3 unique cards to fuse into a new card
          </p>
          <button className="btn-primary" onClick={handleFuse} disabled={fuseSelection.length < 2}>
            Fuse Cards
          </button>
        </div>
      )}
    </div>
  );
}
