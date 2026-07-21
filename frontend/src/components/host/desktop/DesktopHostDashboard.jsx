import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  MapPin,
  Megaphone,
  Users,
  Vote
} from "lucide-react";
import { Link } from "react-router-dom";

const hostMeeting = {
  id: 1,
  title: "한강 러닝 같이 하실 분!",
  time: "05.25(월) 19:00",
  place: "여의도 한강공원",
  img: "/images/sports/thumbnails/running.png"
};

const applicants = [
  {
    id: 1,
    name: "김철수",
    temperature: "36.5°",
    message: "열심히 뛰겠습니다! 잘 부탁드립니다.",
    img: "/img/test3.png"
  },
  {
    id: 2,
    name: "이영희",
    temperature: "42.1°",
    message: "매주 참석 가능합니다. 화이팅!",
    img: "/img/test3.png"
  }
];

function DesktopHostDashboard() {
  // 2026-07-10: /host 화면을 DesktopPrototype 의존 없이 독립 렌더링하도록 분리.
  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>방장 관리</h1>
          <span>모임 상태를 확인하고 신청자 승인, 공지, 투표, 출석을 한 화면에서 관리합니다.</span>
        </div>
      </div>

      <div className="host-management-layout">
        <div className="host-management-main">
          <section className="page-card host-meeting-summary">
            <div className="section-head">
              <div>
                <h2>내 모임 관리</h2>
                <span>현재 운영 중인 모임</span>
              </div>
              <span className="host-status-pill">모집중</span>
            </div>
            <div className="host-meeting-card">
              <img src={hostMeeting.img} alt="" />
              <div>
                <span className="host-sport-chip">러닝 / 야외</span>
                <h3>{hostMeeting.title}</h3>
                <p><CalendarDays size={15} />{hostMeeting.time}</p>
                <p><MapPin size={15} />{hostMeeting.place}</p>
              </div>
              <div className="host-meeting-side">
                <strong><Users size={17} />8 / 10명</strong>
                <Link to={`/meetings/${hostMeeting.id}`}>자세히 보기 <ChevronRight size={15} /></Link>
              </div>
            </div>
          </section>

          <div className="host-management-row">
            <section className="page-card host-stat-panel">
              <div className="section-head">
                <h2>활동 통계</h2>
              </div>
              <div className="host-stat-grid">
                <article>
                  <CalendarCheck size={22} />
                  <span>이번 달 모임</span>
                  <b>4회</b>
                </article>
                <article>
                  <BarChart3 size={22} />
                  <span>평균 참여율</span>
                  <b>92%</b>
                </article>
              </div>
            </section>

            <section className="page-card host-tool-panel-pc">
              <div className="section-head">
                <h2>모임 운영 도구</h2>
              </div>
              <div>
                <Link to="/host"><Megaphone size={20} /><span>공지 작성</span></Link>
                <Link to="/host/meetings/0/vote"><Vote size={20} /><span>투표 만들기</span></Link>
                <Link to="/host/meetings/0/attendance"><ClipboardCheck size={20} /><span>출석 체크</span></Link>
              </div>
            </section>
          </div>
        </div>

        <section className="page-card host-applicant-panel-pc">
          <div className="section-head">
            <div>
              <h2>참가자 관리</h2>
              <span>승인 대기 중인 신청자</span>
            </div>
            <span className="host-new-pill">New 2</span>
          </div>
          <div className="host-applicant-list-pc">
            {applicants.map((applicant) => (
              <article key={applicant.id}>
                <div className="host-applicant-profile">
                  <img src={applicant.img} alt="" />
                  <div>
                    <strong>{applicant.name} <em>{applicant.temperature}</em></strong>
                    <p>"{applicant.message}"</p>
                  </div>
                </div>
                <div className="host-applicant-actions">
                  <button type="button">거절하기</button>
                  <button type="button">승인하기</button>
                </div>
              </article>
            ))}
          </div>
          <Link className="host-applicant-more" to="/host/meetings/0/applicants">참가자 전체 보기 <ChevronRight size={15} /></Link>
        </section>
      </div>
    </div>
  );
}

export default DesktopHostDashboard;
