import { useState } from 'react';
import GameCard from './GameCard';

export default function BattleView({ gameState, onSetup, onAttack, onUseStandard, onLeave, isOffline }) {
  const [bossId, setBossId] = useState(null);
  const [fieldIds, setFieldIds] = useState([]);
  const [targetMode, setTargetMode] = useState(null);

  if (!gameState) return null;

  const { phase, myHand, mySupportHand, myBoss, myField, opponent, log, winnerId, players } = gameState;
  const me = players?.find(p => p.id !== opponent?.id && p.username !== 'CPU Opponent') || players?.[0];

  const toggleField = (id) => {
    if (bossId === id) return;
    setFieldIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSetupConfirm = () => {
    if (!bossId || fieldIds.length !== 3) return;
    onSetup(bossId, fieldIds);
  };

  const handleAttackClick = (attacker) => {
    if (attacker.cooldownRemaining > 0 || !attacker.alive) return;
    setTargetMode({ type: 'attack', attacker });
  };

  const handleStandardClick = (card) => {
    if (card.used) return;
    setTargetMode({ type: 'standard', card });
  };

  const handleTargetSelect = (target, targetPlayerId) => {
    if (!targetMode) return;
    if (targetMode.type === 'attack') {
      onAttack(targetMode.attacker.instanceId, target.instanceId);
    } else {
      onUseStandard(targetMode.card.instanceId, target.instanceId, targetPlayerId);
    }
    setTargetMode(null);
  };

  if (phase === 'setup') {
    return (
      <div>
        <div className="setup-instructions">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 12 }}>
            Deployment Phase
          </h2>
          <p>Select 1 card as your <strong>Boss</strong> (if killed, you lose) and 3 cards for the battlefield.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>Your opponent cannot see your choices.</p>
        </div>

        <div className="hand-cards" style={{ justifyContent: 'center', margin: '20px 0' }}>
          {myHand?.map(card => (
            <div key={card.instanceId} style={{ textAlign: 'center' }}>
              <GameCard
                card={card}
                selected={bossId === card.instanceId || fieldIds.includes(card.instanceId)}
                onClick={() => {
                  if (bossId === card.instanceId) setBossId(null);
                  else if (fieldIds.includes(card.instanceId)) toggleField(card.instanceId);
                }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                <button
                  className={bossId === card.instanceId ? 'btn-gold' : 'btn-secondary'}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    setFieldIds(prev => prev.filter(id => id !== card.instanceId));
                    setBossId(card.instanceId);
                  }}
                >
                  Boss
                </button>
                <button
                  className={fieldIds.includes(card.instanceId) ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    if (bossId === card.instanceId) setBossId(null);
                    toggleField(card.instanceId);
                  }}
                  disabled={bossId === card.instanceId}
                >
                  Field
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Boss: {bossId ? '✓' : '—'} | Field: {fieldIds.length}/3
          </p>
          <button className="btn-primary" onClick={handleSetupConfirm} disabled={!bossId || fieldIds.length !== 3}>
            Confirm Deployment
          </button>
        </div>
      </div>
    );
  }

  const myPlayer = { boss: myBoss || me?.boss, field: myField?.length ? myField : (me?.field || []) };
  const oppPlayer = opponent || players?.find(p => p.id !== me?.id);

  return (
    <div>
      {winnerId && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16, borderColor: 'var(--accent-gold)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>
            {winnerId === me?.id || winnerId === 'player' ? 'Victory!' : 'Defeat'}
          </h2>
          <button className="btn-secondary" onClick={onLeave} style={{ marginTop: 12 }}>Return to Lobby</button>
        </div>
      )}

      <div className="battlefield">
        <div className="player-zone">
          <h3>Your Battlefield</h3>
          <div className="field-cards">
            {myPlayer.boss && (
              <GameCard
                card={myPlayer.boss}
                showCooldown
                onClick={() => phase === 'battle' && !winnerId && handleAttackClick(myPlayer.boss)}
              />
            )}
            {(myPlayer.field || []).map(card => (
              <GameCard
                key={card.instanceId}
                card={card}
                showCooldown
                onClick={() => phase === 'battle' && !winnerId && handleAttackClick(card)}
              />
            ))}
          </div>
        </div>

        <div className="player-zone">
          <h3>{oppPlayer?.username || 'Opponent'}</h3>
          <div className="field-cards">
            {oppPlayer?.boss && <GameCard card={oppPlayer.boss} showCooldown />}
            {(oppPlayer?.field || []).map(card => (
              <GameCard key={card.instanceId || card.hidden} card={card} showCooldown />
            ))}
          </div>
        </div>
      </div>

      {mySupportHand?.length > 0 && phase === 'battle' && !winnerId && (
        <div className="hand-area">
          <h4>Support Cards — tap to use</h4>
          <div className="hand-cards">
            {mySupportHand.map(card => (
              <GameCard
                key={card.instanceId}
                card={card}
                disabled={card.used}
                onClick={() => !card.used && handleStandardClick(card)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="battle-log">
        {log?.map((entry, i) => <p key={i}>{entry}</p>)}
      </div>

      {!winnerId && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn-danger" onClick={onLeave}>Forfeit</button>
        </div>
      )}

      {targetMode && (
        <div className="target-overlay" onClick={() => setTargetMode(null)}>
          <div className="target-panel" onClick={e => e.stopPropagation()}>
            <h3>
              {targetMode.type === 'attack' ? 'Choose target to attack' : 'Choose target for ' + targetMode.card.name}
            </h3>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {targetMode.type === 'attack' ? (
                (oppPlayer?.field || []).concat(oppPlayer?.boss ? [oppPlayer.boss] : [])
                  .filter(c => c && !c.hidden && c.alive !== false)
                  .map(card => (
                    <GameCard key={card.instanceId} card={card} onClick={() => handleTargetSelect(card, oppPlayer.id)} />
                  ))
              ) : (
                <>
                  <p style={{ width: '100%', fontSize: 12, color: 'var(--text-secondary)' }}>Your cards:</p>
                  {[myPlayer.boss, ...(myPlayer.field || [])].filter(c => c?.alive !== false).map(card => (
                    <GameCard key={card.instanceId} card={card} onClick={() => handleTargetSelect(card, me?.id || 'player')} />
                  ))}
                  <p style={{ width: '100%', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>Enemy cards:</p>
                  {[oppPlayer?.boss, ...(oppPlayer?.field || [])].filter(c => c && !c.hidden && c.alive !== false).map(card => (
                    <GameCard key={card.instanceId} card={card} onClick={() => handleTargetSelect(card, oppPlayer.id)} />
                  ))}
                </>
              )}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
