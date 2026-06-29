import { useEffect, useState } from "react";
import { DESKTOP_MEDIA_QUERY } from "../config/breakpoints";

export function useResponsive() {
  const getState = () => {
    if (typeof window === "undefined") return { isMobile: true, isDesktop: false };
    const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
    return { isMobile: !isDesktop, isDesktop };
  };

  const [state, setState] = useState(getState);

  useEffect(() => {
    const handleResize = () => setState(getState());
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    mediaQuery.addEventListener("change", handleResize);
    window.addEventListener("resize", handleResize);

    return () => {
      mediaQuery.removeEventListener("change", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return state;
}

