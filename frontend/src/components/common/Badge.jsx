function Badge({ children, tone = "primary" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export default Badge;

