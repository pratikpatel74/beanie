// Card.jsx — Renders a single playing card

const RED_SUITS = ['♥', '♦'];

export default function Card({ card, beanieRank, size = 'md', selected = false, onClick, disabled = false, className = '', style }) {
  if (!card) return null;

  const isBeanie = card.rank === beanieRank;
  const isRed    = RED_SUITS.includes(card.suit);

  const cls = [
    'card',
    `card-${size}`,
    isBeanie            ? 'beanie'        :
    card.rank === 'back' ? 'back'         : 'face',
    isRed && !isBeanie  ? 'red'           : '',
    selected            ? 'selected'      : '',
    disabled            ? 'card-disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  if (card.rank === 'back') {
    return (
      <div className={cls} onClick={disabled ? undefined : onClick} style={style}>
        <div className="back-inner" />
      </div>
    );
  }

  const pip   = isBeanie ? '★' : card.suit;
  const index = isBeanie ? '★' : card.suit;

  return (
    <div className={cls} onClick={disabled ? undefined : onClick} title={card.id} style={style}>
      <div className="card-corner card-corner-tl">
        <span className="ci-rank">{card.rank}</span>
        <span className="ci-suit">{index}</span>
      </div>
      <span className="card-pip">{pip}</span>
      <div className="card-corner card-corner-br">
        <span className="ci-rank">{card.rank}</span>
        <span className="ci-suit">{index}</span>
      </div>
    </div>
  );
}

export function EmptyCard({ size = 'sm' }) {
  return <div className={`card card-${size} empty`}>?</div>;
}
