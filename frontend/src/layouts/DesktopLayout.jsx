import { useLocation } from "react-router-dom";
import DesktopHeader from "../components/layout/desktop/DesktopHeader.jsx";
import DesktopFooter from "../components/layout/desktop/DesktopFooter.jsx";

function DesktopLayout({ children }) {
  const location = useLocation();
  const isStandaloneApplicantsPage = /^\/host\/meetings\/\d+\/applicants\/?$/.test(location.pathname);

  return (
    <div className={`desktop-shell${isStandaloneApplicantsPage ? " desktop-shell--standalone-applicants" : ""}`}>
      <DesktopHeader />
      <main className="desktop-main">
        <div className="desktop-main__inner">{children}</div>
      </main>
      <DesktopFooter />
    </div>
  );
}

export default DesktopLayout;

