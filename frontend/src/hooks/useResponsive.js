import { useMemo } from "react";

const MOBILE_USER_AGENT_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_USER_AGENT_PATTERN = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;

function getDeviceOverride() {
  if (typeof window === "undefined") return "";
  const queryValue = new URLSearchParams(window.location.search).get("device");
  if (queryValue === "mobile" || queryValue === "desktop") {
    window.localStorage.setItem("sportsmate_device_override", queryValue);
    return queryValue;
  }
  return window.localStorage.getItem("sportsmate_device_override") || "";
}

function detectMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return true;
  }

  const override = getDeviceOverride();
  if (override === "mobile") return true;
  if (override === "desktop") return false;

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const isIPadOSDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;

  return (
    MOBILE_USER_AGENT_PATTERN.test(userAgent) ||
    TABLET_USER_AGENT_PATTERN.test(userAgent) ||
    isIPadOSDesktopMode ||
    (hasCoarsePointer && maxTouchPoints > 1 && window.screen.width <= 1024)
  );
}

export function useResponsive() {
  return useMemo(() => {
    const isMobile = detectMobileDevice();
    return { isMobile, isDesktop: !isMobile };
  }, []);
}
