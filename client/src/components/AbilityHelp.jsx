import { getAbilityHelpEntries } from '../../../shared/combineRules.js';

export default function AbilityHelp({ open, onClose }) {
  if (!open) return null;

  const entries = getAbilityHelpEntries();

  return (
    <div className="target-overlay" onClick={onClose}>
      <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Special Abilities</h3>
        <p className="help-dialog-intro">
          Each word on a card is a special ability. Full descriptions are listed below.
        </p>
        <ul className="ability-help-list">
          {entries.map(({ name, description }) => (
            <li key={name}>
              <strong>{name}</strong>
              {' — '}
              {description}
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
