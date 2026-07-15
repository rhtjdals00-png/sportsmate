import { CalendarClock, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../common/Badge.jsx";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";


function MeetingCard({ meeting, compact = false }) {
  const isPast = new Date(meeting.start_at) < new Date();
  const actualStatus = meeting.status === "cancelled" ? "cancelled" : (isPast ? "closed" : meeting.status);
  const statusLabel = getStatusLabel(actualStatus);
  const coverImage = getMeetingCoverImage(meeting);
  const isSportThumb = isUsingSportThumbnail(meeting);

  return (
    <Link 
      to={`/meetings/${meeting.id}`} 
      className={`meeting-card ${compact ? "meeting-card--compact" : ""}`}
      style={(actualStatus === "closed" || actualStatus === "cancelled") ? { opacity: 0.6, filter: 'grayscale(0.8)' } : undefined}
    >
      <div className="meeting-card__body">
        <div className={`meeting-card__thumb ${isSportThumb ? "is-sport-thumbnail" : ""}`} style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}>
          {!coverImage && <span>{meeting.sport?.name || meeting.sport_name}</span>}
        </div>
        <div>
          <div className="meeting-card__top">
            <Badge tone={actualStatus === "open" ? "success" : actualStatus === "full" ? "warning" : "slate"}>
              {statusLabel}
            </Badge>
            <Badge tone="sky" className="meeting-card__sport-badge">
              {meeting.sport?.name || meeting.sport_name}
            </Badge>
            <span className="badge badge--type">{formatMeetingType(meeting.meeting_type)}</span>
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

      </dl>
    </Link>
  );
}

function getStatusLabel(status) {
  if (status === "open") return "모집중";
  if (status === "full") return "모집마감";
  if (status === "closed") return "모집종료";
  if (status === "cancelled") return "취소됨";
  return "마감";
}

export default MeetingCard;
