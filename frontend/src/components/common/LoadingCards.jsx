function LoadingCards({ count = 3 }) {
  return (
    <div className="loading-list" aria-label="불러오는 중">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index} />
      ))}
    </div>
  );
}

export default LoadingCards;

