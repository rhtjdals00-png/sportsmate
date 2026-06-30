import { useEffect, useState } from "react";

function AppLoader() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setVisible(false), 900);
    const unmountTimer = window.setTimeout(() => setMounted(false), 1500);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

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
        <p>{"4\uacfc\uc8fc\uc2a4 \u00b7 Sportsmate"}</p>
        <h1>{"\uac00\ubccd\uac8c \uc6b4\ub3d9\uc744 \uc2dc\uc791\ud558\uace0"}<br />{"\uc6b4\ub3d9 \uba54\uc774\ud2b8\ub97c \ub9e4\uce6d\ud574\uc694"}</h1>
        <div className="loading-track"><div className="loading-bar" /></div>
        <span>{"\uc9c0\uc5ed, \uc885\ubaa9, \uc2dc\uac04\ub300\ub97c \uc900\ube44\ud558\uace0 \uc788\uc5b4\uc694"}</span>
      </section>
    </div>
  );
}

export default AppLoader;