function Badge({ children, tone = "primary", className = "", style }) {
  return <span className={`badge badge--${tone} ${className}`.trim()} style={style}>{children}</span>;
}

export default Badge;

