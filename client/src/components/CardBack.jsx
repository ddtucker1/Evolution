export default function CardBack({ className = '' }) {
  return (
    <div className={`card-back${className ? ` ${className}` : ''}`} aria-hidden="true">
      <img src="/card-back.svg" alt="" className="card-back-image" draggable={false} />
    </div>
  );
}
