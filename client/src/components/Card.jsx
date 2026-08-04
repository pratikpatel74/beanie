// Card.jsx — Renders a single playing card

const RED_SUITS = ['♥', '♦'];

export default function Card({ card, beanieRank, size = 'md', selected = false, onClick, disabled = false, className = '' }) {
  if (!card) return null;

  const isBeanie = card.rank === beanieRank;
  const isRed    = RED_SUITS.includes(card.suit);

  const cls = [
    'card',
    `card-${size}`,
    isBeanie          ? 'beanie'               :
    card.rank === 'back' ? 'back'              : 'face',
    isRed && !isBeanie ? 'red'                 : '',
    selected          ? 'selected'             : '',
    disabled          ? 'card-disabled'        : '',
    className,
  ].filter(Boolean).join(' ');

  if (card.rank === 'back') {
    return <div className={cls} onClick={disabled ? undefined : onClick} />;
  }

  return (
    <div className={cls} onClick={disabled ? undefined : onClick} title={card.id}>
      <span className="card-rank">{card.rank}</span>
      {isBeanie && <span className="card-star">★</span>}
      <span className="card-suit">{card.suit}</span>
    </div>
  );
}

export function EmptyCard({ size = 'sm' }) {
  return <div className={`card card-${size} empty`}>?</div>;
}
