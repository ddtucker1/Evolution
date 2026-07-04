export default function ChainFireAnimation({ chainCount }) {
  if (!chainCount || chainCount < 2) return null;

  const sizeClass = chainCount >= 3 ? 'chain-fire-large' : 'chain-fire-medium';

  return (
    <div className={`chain-fire-overlay ${sizeClass}`} aria-hidden="true">
      <div className="chain-fire-core" />
      <div className="chain-fire-flame chain-fire-flame-1" />
      <div className="chain-fire-flame chain-fire-flame-2" />
      <div className="chain-fire-flame chain-fire-flame-3" />
      {chainCount >= 3 && (
        <>
          <div className="chain-fire-flame chain-fire-flame-4" />
          <div className="chain-fire-flame chain-fire-flame-5" />
          <div className="chain-fire-burst" />
        </>
      )}
      <div className="chain-fire-embers" />
    </div>
  );
}
