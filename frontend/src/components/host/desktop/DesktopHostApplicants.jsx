import { useParams } from "react-router-dom";
import DesktopHostParticipantManager from "./DesktopHostParticipantManager.jsx";

function DesktopHostApplicants({ standalone = false }) {
  const { meetingId } = useParams();

  return (
    <div className={`desktop-page${standalone ? " desktop-host-applicants-page" : ""}`}>
      <DesktopHostParticipantManager meetingId={meetingId} />
    </div>
  );
}

export default DesktopHostApplicants;
