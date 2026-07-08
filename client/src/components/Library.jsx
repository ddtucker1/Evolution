import { useMemo, useState } from 'react';
import GameCard from './GameCard';
import { getTimerPreview } from '../offlineEngine';
import {
  getCardLevel,
  getLevelDigit,
} from '../combineEngine';
import {
  FIGHTER_ABILITIES,
  FIGHTER_ABILITY_CONFIG,
} from '../../../shared/fighterAbilities.js';
import {
  PURCHASE_LEVEL_0_COST,
  getSellPoints,
  getUpgradeCost,
  canSellWithLibrarySize,
} from '../../../shared/upgradePoints.js';
import { COMBINE_MAX_LEVEL } from '../../../shared/combineRules.js';
import {
  PLAY_DECK_SIZE,
  getCatalogCard,
  getCollectionCount,
  countInPlayDeck,
  togglePlayDeckCard,
  clearPlayDeck,
  getLibraryCardCount,
  getUpgradePoints,
  sellCardForPoints,
  upgradeCardWithPoints,
  purchaseLevel0Card,
  replaceLibraryWithNewBatch,
} from '../api';
import { needsUpgradeAbilityChoice } from '../upgradeEngine';

export default function Library({ profile, onProfileChange, onMainMenu }) {
  const [mode, setMode] = useState('deck');
  const [sortBy, setSortBy] = useState('level');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [showSellBlockedPopup, setShowSellBlockedPopup] = useState(false);
  const [showReplaceBatchDialog, setShowReplaceBatchDialog] = useState(false);
  const [showAbilityDialog, setShowAbilityDialog] = useState(false);
  const [selectedAbility, setSelectedAbility] = useState(null);

  const libraryCardCount = getLibraryCardCount(profile);
  const upgradePoints = getUpgradePoints(profile);
  const sellBlocked = !canSellWithLibrarySize(libraryCardCount);
  const playDeck = profile.playDeck || [];
  const deckComplete = playDeck.length === PLAY_DECK_SIZE;

  const selectedCard = selectedEntry
    ? getCatalogCard(selectedEntry.card_id, profile)
    : null;
  const selectedLevel = selectedCard ? getCardLevel(selectedCard) : null;
  const sellValue = selectedLevel != null ? getSellPoints(selectedLevel) : 0;
  const upgradeCost = selectedLevel != null ? getUpgradeCost(selectedLevel) : null;
  const canUpgradeSelected = selectedCard
    && upgradeCost != null
    && upgradePoints >= upgradeCost;
  const requiresAbilityChoice = selectedCard
    ? needsUpgradeAbilityChoice(selectedCard)
    : false;

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
          return getTimerPreview(catalog.attack ?? 0);
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

  const handleReplaceBatch = () => {
    onProfileChange(replaceLibraryWithNewBatch(profile));
    setShowReplaceBatchDialog(false);
    exitUpgradeMode();
    setUpgradeMessage('Library replaced with a new batch of cards.');
  };

  const selectCard = (entry) => {
    setUpgradeMessage('');
    setSelectedEntry((prev) => (prev?.key === entry.key ? null : entry));
  };

  const handleSell = () => {
    if (!selectedEntry) return;
    if (sellBlocked) {
      setShowSellBlockedPopup(true);
      return;
    }
    const result = sellCardForPoints(profile, selectedEntry.card_id);
    if (result.error) {
      if (result.error.includes('15 cards')) {
        setShowSellBlockedPopup(true);
      } else {
        setUpgradeMessage(result.error);
      }
      return;
    }
    onProfileChange(result.profile);
    setSelectedEntry(null);
    setUpgradeMessage(`Sold for ${result.pointsEarned} point${result.pointsEarned === 1 ? '' : 's'}!`);
  };

  const finalizeUpgrade = (ability = null) => {
    if (!selectedEntry) return;
    const result = upgradeCardWithPoints(profile, selectedEntry.card_id, {
      specialAbility: ability,
    });
    if (result.error) {
      setUpgradeMessage(result.error);
      return;
    }
    onProfileChange(result.profile);
    setSelectedEntry(null);
    setShowAbilityDialog(false);
    setSelectedAbility(null);
    const abilityNote = result.upgraded.specialAbility
      ? ` (${FIGHTER_ABILITY_CONFIG[result.upgraded.specialAbility]?.label || result.upgraded.specialAbility} ability)`
      : '';
    setUpgradeMessage(`Upgraded to ${result.upgraded.name}!${abilityNote} (-${result.cost} pts)`);
  };

  const handleUpgrade = () => {
    if (!selectedEntry || !canUpgradeSelected) return;
    if (requiresAbilityChoice) {
      setSelectedAbility(null);
      setShowAbilityDialog(true);
      return;
    }
    finalizeUpgrade();
  };

  const handleAbilityConfirm = () => {
    if (!selectedAbility) return;
    finalizeUpgrade(selectedAbility);
  };

  const handlePurchase = () => {
    const result = purchaseLevel0Card(profile);
    if (result.error) {
      setUpgradeMessage(result.error);
      return;
    }
    onProfileChange(result.profile);
    setUpgradeMessage(`Purchased ${result.card.name} for ${PURCHASE_LEVEL_0_COST} point!`);
  };

  const cancelUpgradeAction = () => {
    setSelectedEntry(null);
    setShowAbilityDialog(false);
    setSelectedAbility(null);
  };

  const enterUpgradeMode = () => {
    setMode('upgrade');
  };

  const exitUpgradeMode = () => {
    setMode('deck');
    setSelectedEntry(null);
    setUpgradeMessage('');
    setShowAbilityDialog(false);
    setSelectedAbility(null);
  };

  const showCardActions = mode === 'upgrade' && selectedEntry && selectedCard && !showAbilityDialog;

  return (
    <div>
      <div className="library-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 4 }}>
            Library
          </h2>
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
              <button className="btn-gold" onClick={enterUpgradeMode}>
                Upgrade
              </button>
              <button className="btn-secondary" onClick={() => setShowReplaceBatchDialog(true)}>
                New batch
              </button>
            </>
          ) : (
            <>
              <span className="deck-counter evolve-counter">
                Points: {upgradePoints}
              </span>
              <button
                className="btn-secondary"
                onClick={handlePurchase}
                disabled={upgradePoints < PURCHASE_LEVEL_0_COST}
              >
                Buy card ({PURCHASE_LEVEL_0_COST} pt)
              </button>
              <button className="btn-secondary" onClick={exitUpgradeMode}>
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

      {upgradeMessage && (
        <div className={`toast${upgradeMessage.includes('Upgraded') || upgradeMessage.includes('Sold') || upgradeMessage.includes('Purchased') ? ' success-toast' : ''}`}>
          {upgradeMessage}
        </div>
      )}

      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', margin: '20px 0 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <span>{mode === 'deck' ? `Your Cards (${uniqueCatalogCards.length})` : 'Sell or Upgrade Cards'}</span>
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
      <div className="collection-grid" key={profile.libraryBatchId || 'library-default'}>
        {sortedCatalogCards.map((entry) => {
          const { card_id, key } = entry;
          const catalog = getCatalogCard(card_id, profile);
          const inDeck = countInPlayDeck(playDeck, card_id);
          const owned = getCollectionCount(profile, card_id);
          const selected = mode === 'deck'
            ? inDeck > 0
            : selectedEntry?.key === key;
          const canAdd = playDeck.length < PLAY_DECK_SIZE && inDeck < owned;
          const isCombined = card_id.startsWith('evo_') || card_id.startsWith('test_l');
          const levelDigit = catalog ? getLevelDigit(catalog) : '0';
          const timerPreview = getTimerPreview(catalog?.attack ?? 0);
          const cardLevel = catalog ? getCardLevel(catalog) : 0;
          const atMaxLevel = cardLevel >= COMBINE_MAX_LEVEL;

          return (
            <div
              key={key}
              className={[
                'library-card-wrap',
                selected ? 'selected' : '',
                mode === 'deck' && !canAdd && !selected ? 'full' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (mode === 'deck' && (selected || canAdd)) handleToggle(card_id);
                if (mode === 'upgrade') selectCard(entry);
              }}
            >
              {mode === 'deck' && inDeck > 0 && <span className="deck-badge">{inDeck} in deck</span>}
              {mode === 'upgrade' && selected && (
                <span className="deck-badge evolve-badge">
                  Selected
                </span>
              )}
              {mode === 'upgrade' && !selected && (
                <span className="deck-badge evolve-badge">
                  Sell: {getSellPoints(cardLevel)} | Up: {atMaxLevel ? '—' : getUpgradeCost(cardLevel)}
                </span>
              )}
              <GameCard
                card={{
                  name: catalog?.name || card_id,
                  type: 'unique',
                  attack: catalog?.attack,
                  defense: catalog?.defense,
                  hp: catalog?.hp,
                  maxHp: catalog?.hp,
                  level: catalog?.level,
                  specialAbility: catalog?.specialAbility,
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

      {showCardActions && (
        <div className="target-overlay" onClick={cancelUpgradeAction}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedCard.name}</h3>
            <p className="confirm-dialog-text">
              Level {selectedLevel} card. Sell for {sellValue} point{sellValue === 1 ? '' : 's'}
              {upgradeCost != null
                ? ` or upgrade to Level ${selectedLevel + 1} for ${upgradeCost} point${upgradeCost === 1 ? '' : 's'}.`
                : ' (max level).'}
              {requiresAbilityChoice && upgradeCost != null && ' At Level 5 you will choose a special ability.'}
            </p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSell}
                disabled={sellBlocked}
              >
                Sell ({sellValue} pt{sellValue === 1 ? '' : 's'})
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUpgrade}
                disabled={!canUpgradeSelected}
              >
                {upgradeCost != null ? `Upgrade (${upgradeCost} pt${upgradeCost === 1 ? '' : 's'})` : 'Max level'}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelUpgradeAction}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showAbilityDialog && selectedCard && (
        <div className="target-overlay" onClick={cancelUpgradeAction}>
          <div className="confirm-dialog ability-choice-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Choose Special Ability</h3>
            <p className="confirm-dialog-text">
              Your new Level 5 fighter gains a special ability. It only triggers on solo attacks
              (not chain attacks) and lasts {121} seconds on the target.
            </p>
            <div className="ability-choice-options">
              {FIGHTER_ABILITIES.map((ability) => (
                <button
                  key={ability}
                  type="button"
                  className={`ability-choice-btn${selectedAbility === ability ? ' selected' : ''}`}
                  onClick={() => setSelectedAbility(ability)}
                >
                  <span className="ability-choice-title">
                    {FIGHTER_ABILITY_CONFIG[ability].label}
                  </span>
                  <span className="ability-choice-detail">
                    {FIGHTER_ABILITY_CONFIG[ability].description}
                  </span>
                </button>
              ))}
            </div>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedAbility}
                onClick={handleAbilityConfirm}
              >
                Upgrade
              </button>
              <button type="button" className="btn-secondary" onClick={cancelUpgradeAction}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showReplaceBatchDialog && (
        <div className="target-overlay" onClick={() => setShowReplaceBatchDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Replace all cards?</h3>
            <p className="confirm-dialog-text">
              This removes every card in your library and replaces them with a fresh batch
              of 30 cards (10 base, 10 Level 2, and 10 Level 5). Your play deck and any
              upgraded cards will also be reset.
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn-primary" onClick={handleReplaceBatch}>
                Replace
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowReplaceBatchDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellBlockedPopup && (
        <div className="target-overlay" onClick={() => setShowSellBlockedPopup(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-dialog-text">
              You cannot sell cards when you have fewer than 15 cards in your library.
            </p>
            <div className="confirm-dialog-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowSellBlockedPopup(false)}
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
