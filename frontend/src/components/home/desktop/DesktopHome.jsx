import { CalendarClock, MapPin, Plus, Search, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatMeetingSchedule, formatMeetingType } from "../../../utils/formatters";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import { getSportVisualAsset } from "../../../utils/sportVisualAssets";
import { useAuth } from "../../../contexts/AuthContext.jsx";

const GUEST_SPORT_SHORTCUT_LABELS = ["풋살", "배드민턴", "러닝", "테니스", "등산", "농구"];

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
  const { user, isAuthenticated } = useAuth();
  const [recommendRetryKey] = useState(0);
  const recommendedOneTime = useAsync(
    () => meetingApi.list({ limit: 10, status: "open", recommend: true, meeting_type: "one_time" }),
    [recommendRetryKey, user?.profile?.preferred_sports, user?.profile?.region]
  );
  const recommendedRegular = useAsync(
    () => meetingApi.list({ limit: 10, status: "open", recommend: true, meeting_type: "regular" }),
    [recommendRetryKey, user?.profile?.preferred_sports, user?.profile?.region]
  );
  const sports = useAsync(() => sportApi.sports(), []);
  const navigate = useNavigate();
  const dragStateRef = useRef(null);
  const dragMovedRef = useRef(false);
  const sportItems = sports.data?.items || [];

  const preferredSports = useMemo(() => {
    if (!user?.profile?.preferred_sports) return [];
    return user.profile.preferred_sports
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, [user?.profile?.preferred_sports]);

  const homeSportShortcuts = useMemo(() => {
    const activeLabels = isAuthenticated
      ? preferredSports.slice(0, 6)
      : GUEST_SPORT_SHORTCUT_LABELS;
    const mapped = activeLabels.map((label) => ({
      label,
      asset: getSportVisualAsset(label),
      sport: sportItems.find((sport) => sport.name === label)
    }));

    if (!isAuthenticated) {
      return mapped.filter((item) => item.sport);
    }

    if (mapped.length < 6) {
      const padded = [...mapped];
      while (padded.length < 6) {
        padded.push(null);
      }
      return padded;
    }
    return mapped;
  }, [isAuthenticated, preferredSports, sportItems]);

  const startCarouselDrag = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.currentTarget.closest(".home-card-carousel");
    if (!target || target.scrollWidth <= target.clientWidth) return;
    dragMovedRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: target.scrollLeft
    };
    target.classList.add("is-dragging");
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveCarouselDrag = (event) => {
    const target = event.currentTarget.closest(".home-card-carousel");
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
    const target = event.currentTarget.closest(".home-card-carousel");
    if (target) {
      target.classList.remove("is-dragging");
    }
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
        <div className="section-head" style={{ marginBottom: "26px" }}>
          <h2>나의 관심 종목</h2>
          {isAuthenticated && <Link to="/mypage?edit_profile=1">관심 종목 설정</Link>}
        </div>
        <div className="home-categories" style={{ marginTop: 0 }}>
          {homeSportShortcuts.map((item, index) => {
            if (!item) {
              if (!isAuthenticated) return null;
              return (
                <Link
                  key={`empty-${index}`}
                  to="/mypage?edit_profile=1"
                  className="home-category-placeholder"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "170px",
                    border: "2px dashed #cbd5e1",
                    borderRadius: "8px",
                    background: "#ffffff",
                    color: "#64748b",
                    textDecoration: "none",
                    gap: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f5f3ff";
                    e.currentTarget.style.borderColor = "#4f46e5";
                    e.currentTarget.style.color = "#4f46e5";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.color = "#64748b";
                  }}
                >
                  <Plus size={24} />
                  <span style={{ fontSize: "14px", fontWeight: "700" }}>관심 종목 추가</span>
                </Link>
              );
            }
            const { asset, label, sport } = item;
            return (
              <Link key={label} to={`/meetings?sport=${sport?.id || encodeURIComponent(label)}`}>
                {asset.thumbnail && <img className="home-category-card__image" src={asset.thumbnail} alt="" aria-hidden="true" />}
                <span className="home-category-card__hover">
                  {asset.icon && <img className="home-category-card__icon" src={asset.icon} alt="" aria-hidden="true" />}
                  <strong>{label}</strong>
                  <em>관심 종목 보기</em>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="home-recommend">
        <div className="section-head">
          <h2>추천 일회성 모임</h2>
          <Link to="/meetings?meeting_type=one_time">전체 보기</Link>
        </div>
        {recommendedOneTime.loading ? (
          <LoadingCards count={4} />
        ) : recommendedOneTime.error ? (
          <EmptyState title="추천 모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." actionLabel="모임 게시판" actionTo="/meetings" />
        ) : recommendedOneTime.data?.items?.length ? (
          <div className="home-card-carousel">
            {recommendedOneTime.data.items.map((meeting) => (
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
          <EmptyState title="아직 등록된 일회성 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
        )}
      </section>

      <section className="home-recommend" style={{ marginTop: "40px" }}>
        <div className="section-head">
          <h2>추천 정기 모임</h2>
          <Link to="/meetings?meeting_type=regular">전체 보기</Link>
        </div>
        {recommendedRegular.loading ? (
          <LoadingCards count={4} />
        ) : recommendedRegular.error ? (
          <EmptyState title="추천 모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." actionLabel="모임 게시판" actionTo="/meetings" />
        ) : recommendedRegular.data?.items?.length ? (
          <div className="home-card-carousel">
            {recommendedRegular.data.items.map((meeting) => (
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
          <EmptyState title="아직 등록된 정기 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
        )}
      </section>
    </div>
  );
}

export default DesktopHome;
