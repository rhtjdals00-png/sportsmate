import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

function EmptyState({ title, description, actionLabel, actionTo }) {
  const isCreateAction = actionLabel === "모임 만들기";

  return (
    <div className="empty-state">
      <span className="empty-state__title">{title}</span>
      {description && <p className="empty-state__description">{description}</p>}
      {actionLabel && actionTo && (
        <div className="empty-state__action-container">
          <Link to={actionTo} className="empty-state__action">
            {isCreateAction && <Plus size={15} />}
            {actionLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

export default EmptyState;

