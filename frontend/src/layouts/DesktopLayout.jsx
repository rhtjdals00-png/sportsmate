import DesktopSidebar from "../components/layout/desktop/DesktopSidebar.jsx";

function DesktopLayout({ children }) {
  return (
    <div className="desktop-shell">
      <DesktopSidebar />
      <main className="desktop-main">{children}</main>
    </div>
  );
}

export default DesktopLayout;

