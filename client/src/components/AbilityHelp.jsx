import { getCombineHelpLines } from '../../../shared/combineRules.js';

export default function AbilityHelp({ open, onClose }) {
  if (!open) return null;

  const combineHelpLines = getCombineHelpLines();

  return (
    <div className="target-overlay" onClick={onClose}>
      <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Combining Cards</h3>
        <p className="help-dialog-intro">
          Sacrifice two cards of the same level in the Library to create a stronger card one level higher.
        </p>
        <ul className="ability-help-list">
          {combineHelpLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
