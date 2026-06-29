import { useResponsive } from "../../hooks/useResponsive";

function ResponsivePage({ mobile: MobileComponent, desktop: DesktopComponent }) {
  const { isMobile } = useResponsive();
  const Component = isMobile ? MobileComponent : DesktopComponent;

  return <Component />;
}

export default ResponsivePage;
