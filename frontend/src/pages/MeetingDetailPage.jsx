import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import MobileMeetingDetail from "../components/meeting/mobile/MobileMeetingDetail.jsx";
import DesktopMeetingDetail from "../components/meeting/desktop/DesktopMeetingDetail.jsx";
import { meetingApi } from "../api/meetingApi.js";
import { useResponsive } from "../hooks/useResponsive.js";

const MEETING_VIEWER_KEY = "sportsmate_meeting_viewer_id";

function getMeetingViewerId() {
  const storedViewerId = window.localStorage.getItem(MEETING_VIEWER_KEY);
  if (storedViewerId) return storedViewerId;

  const viewerId = window.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(MEETING_VIEWER_KEY, viewerId);
  return viewerId;
}

function MeetingDetailPage() {
  const { meetingId } = useParams();
  const { isMobile } = useResponsive();
  const requestedMeetingId = useRef(null);
  const [recordedViewCount, setRecordedViewCount] = useState(null);

  useEffect(() => {
    if (!meetingId || requestedMeetingId.current === String(meetingId)) return;

    requestedMeetingId.current = String(meetingId);
    setRecordedViewCount(null);
    meetingApi.recordView(meetingId, getMeetingViewerId())
      .then((data) => setRecordedViewCount(Number(data.view_count || 0)))
      .catch(() => {
        // A view-count failure must not block access to the meeting details.
      });
  }, [meetingId]);

  const Component = isMobile ? MobileMeetingDetail : DesktopMeetingDetail;
  return <Component recordedViewCount={recordedViewCount} />;
}

export default MeetingDetailPage;

