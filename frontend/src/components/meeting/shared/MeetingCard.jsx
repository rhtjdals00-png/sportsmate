import { CalendarClock, MapPin, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../common/Badge.jsx";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";

function MeetingCard({ meeting, compact = false }) {
  return (
    <Link to={`/meetings/${meeting.id}`} className={`meeting-card ${compact ? "meeting-card--compact" : ""}`}>
      <div className="meeting-card__body">
        <div className="meeting-card__thumb" style={meeting.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined}>
          {!meeting.cover_image_url && <span>{meeting.sport?.name || meeting.sport_name}</span>}
        </div>
        <div>
          <div className="meeting-card__top">
            <Badge tone={meeting.status === "open" ? "success" : "slate"}>
              {meeting.status === "open" ? "모집중" : "모집마감"}
            </Badge>
            <Badge tone="sky">{meeting.sport?.name || meeting.sport_name}</Badge>
            <span>{formatMeetingType(meeting.meeting_type)}</span>
          </div>
          <span className="meeting-card__title">
            {meeting.title}
          </span>
          <p>{meeting.description}</p>
        </div>
      </div>
      <dl className="meeting-card__meta">
        <div>
          <MapPin size={16} />
          <span>{meeting.location_name || meeting.address}</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <span>{formatDateTime(meeting.start_at)}</span>
        </div>
        <div>
          <Users size={16} />
          <span>
            {meeting.current_participants}/{meeting.max_participants}명
          </span>
        </div>
        <div>
          <Star size={16} />
          <span>4.{meeting.id % 5 + 5}</span>
        </div>
      </dl>
    </Link>
  );
}

export default MeetingCard;
