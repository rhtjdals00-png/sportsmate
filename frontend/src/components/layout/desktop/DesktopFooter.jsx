import { Headphones } from "lucide-react";
import { Link } from "react-router-dom";

function DesktopFooter() {
  return (
    <footer className="desktop-footer">
      <div className="desktop-footer__inner">
        <div className="desktop-footer__brand">
          <Link to="/" className="desktop-footer__logo">
            <span className="brand-logo-box">
              <img src="/img/test3.png" alt="SportsMate 로고" />
            </span>
            <strong>SPORTSMATE</strong>
          </Link>
          <p>함께 운동할 사람을 찾고, 즐거운 모임을 만들어가는 스포츠 커뮤니티</p>
        </div>

        <div className="desktop-footer__content">
          <nav className="desktop-footer__links" aria-label="푸터 메뉴">
            <Link to="/terms/service">이용약관</Link>
            <Link to="/terms/privacy">개인정보처리방침</Link>
            <Link to="/terms/location">위치기반서비스</Link>
            <Link className="is-support" to="/support">
              <Headphones size={15} />
              고객센터
            </Link>
          </nav>

          <div className="desktop-footer__details">
            <p>스포츠메이트 | 서울특별시 마포구 월드컵북로 21, 3층</p>
            <p>대표 메일 support@sportsmate.kr | 고객센터 평일 09:00 - 18:00</p>
            <p>사업자등록번호 000-00-00000 | 통신판매업 신고 2026-서울마포-0000</p>
          </div>
        </div>

        <div className="desktop-footer__bottom">
          <span>Copyright © {new Date().getFullYear()} SportsMate. All Rights Reserved.</span>
          <span>SportsMate는 건강한 운동 모임 문화를 만들어갑니다.</span>
        </div>
      </div>
    </footer>
  );
}

export default DesktopFooter;
