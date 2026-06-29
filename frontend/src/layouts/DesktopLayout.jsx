import DesktopHeader from "../components/layout/desktop/DesktopHeader.jsx";

function DesktopLayout({ children }) {
  return (
    <div className="desktop-shell">
      <DesktopHeader />
      <main className="desktop-main">
        <div className="desktop-main__inner">{children}</div>
      </main>
    </div>
  );
}

export default DesktopLayout;

