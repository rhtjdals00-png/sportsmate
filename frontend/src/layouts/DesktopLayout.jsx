import DesktopHeader from "../components/layout/desktop/DesktopHeader.jsx";
import DesktopFooter from "../components/layout/desktop/DesktopFooter.jsx";

function DesktopLayout({ children }) {
  return (
    <div className="desktop-shell">
      <DesktopHeader />
      <main className="desktop-main">
        <div className="desktop-main__inner">{children}</div>
      </main>
      <DesktopFooter />
    </div>
  );
}

export default DesktopLayout;

