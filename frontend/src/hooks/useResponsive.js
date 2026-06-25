import { useEffect, useState } from "react";

export function useResponsive() {
  const getState = () => {
    if (typeof window === "undefined") return { isMobile: true, isDesktop: false };
    const isMobile = window.innerWidth < 768;
    return { isMobile, isDesktop: !isMobile };
  };

  const [state, setState] = useState(getState);

  useEffect(() => {
    const handleResize = () => setState(getState());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return state;
}

