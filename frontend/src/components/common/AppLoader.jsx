import { useEffect, useState } from "react";

function AppLoader() {
  const isCallbackRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/auth/callback");
  const isAlreadyShown = (typeof window !== "undefined" && Boolean(window.__app_loader_shown)) || isCallbackRoute;

  const [visible, setVisible] = useState(!isAlreadyShown);
  const [mounted, setMounted] = useState(!isAlreadyShown);

  useEffect(() => {
    if (isAlreadyShown) return;
    if (typeof window !== "undefined") {
      window.__app_loader_shown = true;
    }
    const hideTimer = window.setTimeout(() => setVisible(false), 900);
    const unmountTimer = window.setTimeout(() => setMounted(false), 1500);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [isAlreadyShown]);

  if (!mounted) return null;

  return (
    <div className={`app-loader ${visible ? "" : "loader-out"}`} aria-hidden={!visible}>
      <div className="loader-grid" />
      <div className="speed-line speed-line-a" />
      <div className="speed-line speed-line-b" />
      <div className="speed-line speed-line-c" />
      <section className="app-loader__panel">
        <div className="apple-stage" aria-hidden="true">
          <div className="juice-splash juice-splash-a" />
          <div className="juice-splash juice-splash-b" />
          <div className="apple-shadow" />
          <div className="apple-mark">
            <img className="apple-illustration" src="/img/test3.png" alt="Sportsmate logo" />
          </div>
          <div className="juice-ripples"><span /><span /><span /></div>
        </div>
        <p>{"4과주스 · Sportsmate"}</p>
        <h1>{"가볍게 운동을 시작하고"}<br />{"운동 메이트를 매칭해요"}</h1>
        <div className="loading-track"><div className="loading-bar" /></div>
        <span>{"지역, 종목, 시간대를 준비하고 있어요"}</span>
      </section>
    </div>
  );
}

export default AppLoader;
