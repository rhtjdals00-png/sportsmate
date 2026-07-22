import { CalendarClock, MapPin, Users } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../common/Badge.jsx";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import { isMeetingLifecycleEnded } from "../../../utils/meetingLifecycle.js";

const WEEKDAY_MAP = {
  MO: "월",
  TU: "화",
  WE: "수",
  TH: "목",
  FR: "금",
  SA: "토",
  SU: "일"
};

const parseRepeatDays = (rule) => {
  if (!rule) return null;
  const match = rule.match(/BYDAY=([^;]+)/);
  if (!match) return null;
  const days = match[1].split(",");
  const koreanDays = days.map(d => WEEKDAY_MAP[d]).filter(Boolean);
  if (koreanDays.length === 0) return null;
  return `매주 ${koreanDays.join(", ")}`;
};


function MeetingCard({ meeting, compact = false }) {
  const isEnded = isMeetingLifecycleEnded(meeting);
  const actualStatus = meeting.status === "cancelled" ? "cancelled" : (isEnded ? "closed" : meeting.status);
  const statusLabel = getStatusLabel(actualStatus);
  const coverImage = getMeetingCoverImage(meeting);
  const isSportThumb = isUsingSportThumbnail(meeting);

  return (
    <Link 
      to={`/meetings/${meeting.id}`} 
      className={`meeting-card ${compact ? "meeting-card--compact" : ""}`}
      style={(isEnded || actualStatus === "cancelled") ? { opacity: 0.6, filter: 'grayscale(0.8)' } : undefined}
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
            {meeting.meeting_type === "regular" && parseRepeatDays(meeting.repeat_rule) && (
              <span className="badge badge--type" style={{ marginLeft: '4px', backgroundColor: '#eef2ff', color: '#4f46e5' }}>
                {parseRepeatDays(meeting.repeat_rule)}
              </span>
            )}
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
          <span>{meeting.location_name || meeting.address || "장소 미정"}</span>
        </div>
        <div>
          <CalendarClock size={16} />
          <span>{meeting.start_at ? formatDateTime(meeting.start_at) : "일정 미정"}</span>
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
