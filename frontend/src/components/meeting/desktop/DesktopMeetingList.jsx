import { CalendarClock, Crown, FileText, Map, MapPin, RotateCcw, Search, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { locationApi } from "../../../api/locationApi";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";

function getItems(data) {
  return data?.items || [];
}

function getSportName(meeting) {
  return meeting.sport?.name || "종목 미정";
}

function getPlaceName(meeting) {
  return meeting.location_name || meeting.address || "장소 미정";
}

function getParticipantLabel(meeting) {
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? "-";
  return `${current}/${max}명`;
}

function getDateLabel(value) {
  if (!value) return "일정 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getMeetingTypeLabel(type) {
  return type === "regular" ? "정기 모임" : "일회성 모임";
}

function isHostMeeting(meeting) {
  return meeting.my_participant?.role === "host";
}

function getStatusLabel(status) {
  if (status === "closed" || status === "full") return "모집마감";
  if (status === "cancelled") return "취소됨";
  return "모집중";
}

function getStatusClass(status) {
  if (status === "closed" || status === "full" || status === "cancelled") return "is-closed";
  return "is-open";
}

function DesktopMeetingList() {
  const [params, setParams] = useSearchParams();
  const queryKey = params.toString();
  const query = Object.fromEntries(params.entries());
  delete query.view;
  delete query.category;

  const meetings = useAsync(() => meetingApi.list(query), [queryKey]);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(
    () => (params.get("category") ? sportApi.sports({ category_id: params.get("category") }) : sportApi.sports()),
    [params.get("category")]
  );
  const sidoRegions = useAsync(() => locationApi.regions({ level: "sido" }), []);
  const sigunguRegions = useAsync(
    () => (params.get("sido") ? locationApi.regions({ level: "sigungu", parent_code: params.get("sido") }) : Promise.resolve({ items: [] })),
    [params.get("sido")]
  );

  const viewMode = params.get("view") || "list";
  const items = getItems(meetings.data);
  const categoryItems = getItems(categories.data);
  const sportItems = getItems(sports.data);
  const sidoItems = getItems(sidoRegions.data);
  const sigunguItems = getItems(sigunguRegions.data);

  const setParam = (key, value, extraDeletes = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    extraDeletes.forEach((deleteKey) => next.delete(deleteKey));
    setParams(next);
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (viewMode === "map") next.set("view", "map");
    setParams(next);
  };

  const submitKeyword = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setParam("keyword", String(formData.get("keyword") || "").trim());
  };

  return (
    <div className="desktop-meeting-board">
      <div className="screen-title desktop-meeting-board__title">
        <div>
          <h1>모임 게시판</h1>
          <span>내 주변에서 함께할 운동 모임을 찾아보세요.</span>
        </div>
        <button className="desktop-meeting-board__view-toggle" type="button" onClick={() => setParam("view", viewMode === "map" ? "list" : "map")}>
          {viewMode === "map" ? <FileText size={16} /> : <Map size={16} />}
          {viewMode === "map" ? "리스트로 보기" : "지도로 보기"}
        </button>
      </div>

      <section className="desktop-meeting-board__filters">
        <form className="desktop-meeting-board__search" onSubmit={submitKeyword}>
          <label>
            <Search size={18} />
            <input name="keyword" defaultValue={params.get("keyword") || ""} placeholder="제목, 장소, 종목 검색" />
          </label>
          <button type="submit">검색</button>
        </form>

        <div className="desktop-meeting-board__quick-filters">
          <button type="button" className={!params.get("status") ? "is-active" : ""} onClick={() => setParam("status", "")}>
            전체
          </button>
          <button type="button" className={params.get("status") === "open" ? "is-active" : ""} onClick={() => setParam("status", "open")}>
            모집중
          </button>
          <select value={params.get("category") || ""} onChange={(event) => setParam("category", event.target.value, ["sport"])}>
            <option value="">전체 대분류</option>
            {categoryItems.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select value={params.get("sport") || ""} onChange={(event) => setParam("sport", event.target.value)}>
            <option value="">전체 종목</option>
            {sportItems.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
          <select value={params.get("sido") || ""} onChange={(event) => setParam("sido", event.target.value, ["sigungu"])}>
            <option value="">전체 지역</option>
            {sidoItems.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
          <select value={params.get("sigungu") || ""} onChange={(event) => setParam("sigungu", event.target.value)} disabled={!params.get("sido")}>
            <option value="">전체 구역</option>
            {sigunguItems.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={resetFilters}>
            <RotateCcw size={14} />
            필터 초기화
          </button>
        </div>
      </section>

      {viewMode === "map" ? (
        <DesktopMeetingMap items={items} loading={meetings.loading} error={meetings.error} />
      ) : (
        <section className="desktop-meeting-board__results">
          <div className="desktop-section__head">
            <h2>모임 검색 결과</h2>
            <span>{items.length}개</span>
          </div>
          {meetings.loading ? (
            <LoadingCards count={4} />
          ) : meetings.error ? (
            <EmptyState title="모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." />
          ) : items.length ? (
            <div className="desktop-meeting-list">
              {items.map((meeting) => (
                <DesktopMeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <EmptyState title="조건에 맞는 모임이 없습니다." description="검색어나 필터를 조금 넓혀서 다시 찾아보세요." actionLabel="모임 만들기" actionTo="/meetings/create" />
          )}
        </section>
      )}
    </div>
  );
}

function DesktopMeetingRow({ meeting }) {
  return (
    <Link className="desktop-meeting-row" to={`/meetings/${meeting.id}`}>
      <span className="desktop-meeting-row__thumb" style={meeting.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined}>
        {!meeting.cover_image_url && getSportName(meeting)}
      </span>
      <span className="desktop-meeting-row__main">
        <span className="desktop-meeting-row__badges">
          {isHostMeeting(meeting) && (
            <em className="desktop-meeting-owner-badge">
              <Crown size={12} />
              내가 방장
            </em>
          )}
          <em className={`desktop-meeting-status ${getStatusClass(meeting.status)}`}>{getStatusLabel(meeting.status)}</em>
          <em>{getSportName(meeting)}</em>
          <em>{getMeetingTypeLabel(meeting.meeting_type)}</em>
        </span>
        <strong>{meeting.title}</strong>
        <small>{meeting.description || "모임 설명이 없습니다."}</small>
      </span>
      <span className="desktop-meeting-row__meta">
        <span>
          <MapPin size={16} />
          <b>{getPlaceName(meeting)}</b>
        </span>
        <span>
          <CalendarClock size={16} />
          <b>{getDateLabel(meeting.start_at)}</b>
        </span>
      </span>
      <span className="desktop-meeting-row__people">
        <Users size={17} />
        <b>{getParticipantLabel(meeting)}</b>
      </span>
    </Link>
  );
}

function DesktopMeetingMap({ items, loading, error }) {
  return (
    <section className="desktop-meeting-map">
      <div className="desktop-meeting-map__canvas">
        <MapPin size={34} />
        <strong>지도 보기 영역</strong>
        <span>지도 API 연결 전까지 선택된 모임 목록을 기준으로 표시합니다.</span>
      </div>
      <aside className="desktop-meeting-map__list">
        <div className="desktop-section__head">
          <h2>지도 주변 모임</h2>
          <span>{items.length}개</span>
        </div>
        {loading ? (
          <LoadingCards count={2} />
        ) : error ? (
          <EmptyState title="모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." />
        ) : (
          items.slice(0, 5).map((meeting) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
              <span className="desktop-meeting-map__thumb" style={meeting.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined} />
              <span>
                <strong>{meeting.title}</strong>
                <small>
                  {getPlaceName(meeting)} · {getSportName(meeting)} · {getParticipantLabel(meeting)}
                </small>
              </span>
            </Link>
          ))
        )}
      </aside>
    </section>
  );
}

export default DesktopMeetingList;
