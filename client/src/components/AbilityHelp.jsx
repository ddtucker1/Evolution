import { getUpgradeHelpLines } from '../../../shared/upgradePoints.js';

export default function AbilityHelp({ open, onClose }) {
  if (!open) return null;

  const upgradeHelpLines = getUpgradeHelpLines();

  return (
    <div className="target-overlay" onClick={onClose}>
      <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Upgrading Cards</h3>
        <p className="help-dialog-intro">
          Use Upgrade mode in the Library to sell cards for points and spend points to upgrade
          or purchase new cards.
        </p>
        <ul className="ability-help-list">
          {upgradeHelpLines.map((line) => (
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
