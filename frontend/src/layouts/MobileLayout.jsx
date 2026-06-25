import MobileBottomNavigation from "../components/layout/mobile/MobileBottomNavigation.jsx";

function MobileLayout({ children }) {
  return (
    <div className="mobile-shell">
      <main className="mobile-main">{children}</main>
      <MobileBottomNavigation />
    </div>
  );
}

export default MobileLayout;

