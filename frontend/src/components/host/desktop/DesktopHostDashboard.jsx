import { Navigate } from "react-router-dom";

function DesktopHostDashboard() {
  return <Navigate to="/mypage?panel=hosted" replace />;
}

export default DesktopHostDashboard;
