import { CalendarClock, MapPin, Plus, Search, Star, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatMeetingSchedule, formatMeetingType } from "../../../utils/formatters";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import { getSportVisualAsset, HOME_SPORT_SHORTCUT_LABELS } from "../../../utils/sportVisualAssets";

function HomeRecommendedCard({ meeting }) {
  const sportName = meeting.sport?.name || meeting.sport_name;
  const coverImage = getMeetingCoverImage(meeting);
  const isSportThumb = isUsingSportThumbnail(meeting);
  const statusLabel = getMeetingStatusLabel(meeting.status);
  const statusTone = getMeetingStatusTone(meeting.status);

  return (
    <article className="meeting-card meeting-card--compact home-recommend-card" aria-label={meeting.title}>
      <div className="home-recommend-card__top">
        <div
          className={`meeting-card__thumb ${isSportThumb ? "is-sport-thumbnail" : ""}`}
          style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
        />
        <div className="home-recommend-card__summary">
          <div className="meeting-card__top home-recommend-card__tags">
            <span className={`badge ${statusTone}`}>
              {statusLabel}
            </span>
            <span className="badge badge--sky">{sportName}</span>
            <span className="badge badge--type">{formatMeetingType(meeting.meeting_type)}</span>
          </div>
          <span className="meeting-card__title home-recommend-card__title">{meeting.title}</span>
        </div>
      </div>
      <div className="home-recommend-card__content">
        <p className="home-recommend-card__description">{meeting.description || ""}</p>
      </div>
      <dl className="meeting-card__meta home-recommend-card__footer">
        <div className="home-recommend-card__location">
          <MapPin size={16} />
          <span>{meeting.location_name || meeting.address}</span>
        </div>
        <div className="home-recommend-card__meta-item">
          <CalendarClock size={16} />
          <span>{formatMeetingSchedule(meeting)}</span>
        </div>
        <div className="home-recommend-card__meta-item">
          <Users size={16} />
          <span>{meeting.current_participants}/{meeting.max_participants}명</span>
        </div>
        <div className="home-recommend-card__meta-item">
          <Star size={16} />
          <span>4.{meeting.id % 5 + 5}</span>
        </div>
      </dl>
    </article>
  );
}

function getMeetingStatusLabel(status) {
  if (status === "full") return "모집마감";
  if (status === "closed") return "모집종료";
  return "모집중";
}

function getMeetingStatusTone(status) {
  if (status === "full") return "badge--warning";
  if (status === "closed" || status === "cancelled") return "badge--slate";
  return "badge--success";
}

function DesktopHome() {
  const [recommendRetryKey] = useState(0);
  const recommendedMeetings = useAsync(() => meetingApi.list({ limit: 10, status: "open" }), [recommendRetryKey]);
  const sports = useAsync(() => sportApi.sports(), []);
  const recommendedItems = recommendedMeetings.data?.items || [];
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const dragStateRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [carouselDragging, setCarouselDragging] = useState(false);
  const sportItems = sports.data?.items || [];

  // 2026-07-10: DesktopPrototype 없이 홈 화면만 독립 렌더링하도록 홈 전용 구성으로 분리.
  const homeSportShortcuts = useMemo(() => {
    return HOME_SPORT_SHORTCUT_LABELS.map((label) => ({
      label,
      asset: getSportVisualAsset(label),
      sport: sportItems.find((sport) => sport.name === label)
    }));
  }, [sportItems]);

  const startCarouselDrag = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = carouselRef.current;
    if (!target || target.scrollWidth <= target.clientWidth) return;
    dragMovedRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: target.scrollLeft
    };
    setCarouselDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveCarouselDrag = (event) => {
    const target = carouselRef.current;
    const state = dragStateRef.current;
    if (!target || !state || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 5) {
      dragMovedRef.current = true;
      event.preventDefault();
    }
    target.scrollLeft = state.scrollLeft - deltaX;
  };

  const endCarouselDrag = (event) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = null;
    setCarouselDragging(false);
  };

  const openRecommendedMeeting = (meetingId) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    navigate(`/meetings/${meetingId}`);
  };

  const handleRecommendedKeyDown = (event, meetingId) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    navigate(`/meetings/${meetingId}`);
  };

  return (
    <div className="desktop-page desktop-home-page">
      <section className="home-banner">
        <div className="home-banner-copy">
          <span>오늘도 함께, SPORTSMATE</span>
          <h1>
            가볍게 찾고
            <br />
            함께 운동하는 하루
          </h1>
          <p>추천 모임과 신규 모임을 먼저 둘러보고, 자세한 조건은 모임 찾기에서 설정하세요.</p>
          <div className="home-banner-actions">
            <Link to="/meetings" className="ghost-btn">
              <Search size={15} />
              모임 찾기
            </Link>
            <Link to="/meetings/create" className="primary-small">
              <Plus size={15} />
              모임 만들기
            </Link>
          </div>
        </div>
        <div className="home-banner-image">
          <img src="https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80" alt="러닝 이미지" />
        </div>
      </section>

      <section className="home-categories-wrap">
        <div className="home-categories">
          {homeSportShortcuts.map(({ asset, label, sport }) => (
            <Link key={label} to={`/meetings?sport=${sport?.id || encodeURIComponent(label)}`}>
              {asset.thumbnail && <img className="home-category-card__image" src={asset.thumbnail} alt="" aria-hidden="true" />}
              <span className="home-category-card__hover">
                {asset.icon && <img className="home-category-card__icon" src={asset.icon} alt="" aria-hidden="true" />}
                <strong>{label}</strong>
                <em>관심 종목 보기</em>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-recommend">
        <div className="section-head">
          <h2>오늘의 추천 모임</h2>
          <Link to="/meetings">전체 보기</Link>
        </div>
        {recommendedMeetings.loading ? (
          <LoadingCards count={4} />
        ) : recommendedMeetings.error ? (
          <EmptyState title="추천 모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." actionLabel="모임 게시판" actionTo="/meetings" />
        ) : recommendedItems.length ? (
          <div ref={carouselRef} className={`home-card-carousel ${carouselDragging ? "is-dragging" : ""}`}>
            {recommendedItems.map((meeting) => (
              <div
                key={meeting.id}
                className="home-card-drag-target"
                role="link"
                tabIndex={0}
                onClick={() => openRecommendedMeeting(meeting.id)}
                onKeyDown={(event) => handleRecommendedKeyDown(event, meeting.id)}
                onPointerDown={startCarouselDrag}
                onPointerMove={moveCarouselDrag}
                onPointerUp={endCarouselDrag}
                onPointerCancel={endCarouselDrag}
              >
                <HomeRecommendedCard meeting={meeting} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="아직 등록된 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
        )}
      </section>
    </div>
  );
}

export default DesktopHome;
