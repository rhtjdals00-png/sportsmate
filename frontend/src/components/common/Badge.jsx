function Badge({ children, tone = "primary", className = "" }) {
  return <span className={`badge badge--${tone} ${className}`.trim()}>{children}</span>;
}

export default Badge;

