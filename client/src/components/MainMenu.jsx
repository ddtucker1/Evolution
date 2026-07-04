import { CARD_TIMER_MIN, CARD_TIMER_MAX } from '../offlineEngine';
import { PLAY_DECK_SIZE } from '../api';

export default function MainMenu({ onLibrary, onBattle, playDeckCount, battleReady }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 8 }}>
        Main Menu
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        Build a {PLAY_DECK_SIZE}-card play deck in the Library, then battle the CPU.
        Each fighter&apos;s attack timer is random: <strong>{CARD_TIMER_MIN}–{CARD_TIMER_MAX} seconds</strong>.
      </p>

      <div className="mode-grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 560 }}>
        <div className="mode-card" onClick={onLibrary}>
          <h3>Library</h3>
          <p>View all your cards and choose {PLAY_DECK_SIZE} for your play deck.</p>
          <p style={{ color: 'var(--accent-blue)', marginTop: 8, fontSize: 11 }}>
            Play deck: {playDeckCount}/{PLAY_DECK_SIZE}
          </p>
        </div>

        <div
          className={`mode-card${battleReady ? '' : ' disabled'}`}
          onClick={battleReady ? onBattle : undefined}
        >
          <h3>Battle</h3>
          <p>
            {battleReady
              ? 'Fight the CPU with your play deck.'
              : `Complete your play deck in the Library first (${playDeckCount}/${PLAY_DECK_SIZE}).`}
          </p>
          {battleReady && (
            <p style={{ color: 'var(--accent-green)', marginTop: 8, fontSize: 11 }}>● Ready</p>
          )}
        </div>
      </div>
    </div>
  );
}
