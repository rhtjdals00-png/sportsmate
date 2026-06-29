import { useEffect, useState } from "react";

function AppLoader() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

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
            <img className="apple-illustration" src="/img/test3.png" alt="Sportsmate 사과 로고" />
          </div>
          <div className="juice-ripples"><span /><span /><span /></div>
        </div>
        <p>4과주스 · Sportsmate</p>
        <h1>상큼하게 운동할<br />운동 메이트 매칭중</h1>
        <div className="loading-track"><div className="loading-bar" /></div>
        <span>지역, 종목, 시간대를 준비하고 있어요</span>
      </section>
    </div>
  );
}

export default AppLoader;
