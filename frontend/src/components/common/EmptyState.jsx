import { Link } from "react-router-dom";

function EmptyState({ title, description, actionLabel, actionTo }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actionLabel && actionTo && <Link to={actionTo}>{actionLabel}</Link>}
    </div>
  );
}

export default EmptyState;

