import { CalendarClock, Crown, FileText, Map, MapPin, RotateCcw, Search, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { locationApi } from "../../../api/locationApi";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";

const fallbackMeetings = [
  {
    id: 0,
    title: "한강 러닝 같이 하실 분!",
    description: "가볍게 5km 뛰고 스트레칭까지 같이 해요. 초보자도 환영합니다.",
    status: "open",
    category_id: "outdoor",
    sport_id: "running",
    sido_code: "11",
    sigungu_code: "11560",
    sport_name: "러닝",
    location_name: "여의도 한강공원",
    start_at: "2026-05-25T19:00:00",
    current_participants: 12,
    max_participants: 20,
    cover_image_url: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single",
    is_host: true
  },
  {
    id: 1,
    title: "초보자 농구 모임",
    description: "처음 오시는 분도 편하게 참여할 수 있는 농구 모임입니다.",
    status: "joined",
    category_id: "ball",
    sport_id: "basketball",
    sido_code: "11",
    sigungu_code: "11710",
    sport_name: "농구",
    location_name: "잠실 실내체육관",
    start_at: "2026-05-26T18:00:00",
    current_participants: 8,
    max_participants: 12,
    cover_image_url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single"
  },
  {
    id: 2,
    title: "관악산 등산 가실 분",
    description: "주말 오전 관악산 입구에서 만나 천천히 올라갑니다.",
    status: "joined",
    category_id: "outdoor",
    sport_id: "hiking",
    sido_code: "11",
    sigungu_code: "11110",
    sport_name: "등산",
    location_name: "관악산 입구",
    start_at: "2026-05-26T08:00:00",
    current_participants: 8,
    max_participants: 15,
    cover_image_url: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single"
  },
  {
    id: 3,
    title: "자전거 라이딩 모임",
    description: "한강 자전거 도로에서 안전하게 같이 라이딩해요.",
    status: "joined",
    category_id: "outdoor",
    sport_id: "cycling",
    sido_code: "41",
    sigungu_code: "41135",
    sport_name: "자전거",
    location_name: "한강 자전거 도로",
    start_at: "2026-05-27T07:00:00",
    current_participants: 5,
    max_participants: 10,
    cover_image_url: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single"
  },
  {
    id: 4,
    title: "주말 동네 축구해요",
    description: "잠실 풋살장에서 가볍게 몸 풀고 즐겁게 경기해요.",
    status: "open",
    category_id: "ball",
    sport_id: "soccer",
    sido_code: "11",
    sigungu_code: "11710",
    sport_name: "축구",
    location_name: "잠실 풋살장",
    start_at: "2026-05-30T20:00:00",
    current_participants: 10,
    max_participants: 14,
    cover_image_url: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single"
  },
  {
    id: 5,
    title: "퇴근 후 배드민턴",
    description: "마포 생활체육관에서 퇴근 후 가볍게 배드민턴 치실 분을 찾습니다.",
    status: "open",
    category_id: "racket",
    sport_id: "badminton",
    sido_code: "11",
    sigungu_code: "11680",
    sport_name: "배드민턴",
    location_name: "마포 생활체육관",
    start_at: "2026-05-29T19:30:00",
    current_participants: 6,
    max_participants: 12,
    cover_image_url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=700&q=80",
    meeting_type: "single"
  }
];

const fallbackCategories = [
  { id: "ball", name: "구기 종목" },
  { id: "racket", name: "라켓 스포츠" },
  { id: "outdoor", name: "러닝 / 야외" },
  { id: "fitness", name: "피트니스" },
  { id: "etc", name: "기타" }
];

const fallbackSports = [
  { id: "soccer", name: "축구", category_id: "ball" },
  { id: "futsal", name: "풋살", category_id: "ball" },
  { id: "basketball", name: "농구", category_id: "ball" },
  { id: "volleyball", name: "배구", category_id: "ball" },
  { id: "baseball", name: "야구", category_id: "ball" },
  { id: "jokgu", name: "족구", category_id: "ball" },
  { id: "badminton", name: "배드민턴", category_id: "racket" },
  { id: "table-tennis", name: "탁구", category_id: "racket" },
  { id: "tennis", name: "테니스", category_id: "racket" },
  { id: "squash", name: "스쿼시", category_id: "racket" },
  { id: "running", name: "러닝", category_id: "outdoor" },
  { id: "hiking", name: "등산", category_id: "outdoor" },
  { id: "trekking", name: "트래킹", category_id: "outdoor" },
  { id: "cycling", name: "자전거", category_id: "outdoor" },
  { id: "walking", name: "산책", category_id: "outdoor" },
  { id: "gym", name: "헬스", category_id: "fitness" },
  { id: "crossfit", name: "크로스핏", category_id: "fitness" },
  { id: "climbing", name: "클라이밍", category_id: "fitness" },
  { id: "yoga", name: "요가", category_id: "fitness" },
  { id: "pilates", name: "필라테스", category_id: "fitness" },
  { id: "bowling", name: "볼링", category_id: "etc" },
  { id: "dance", name: "댄스", category_id: "etc" },
  { id: "golf", name: "골프", category_id: "etc" },
  { id: "swimming", name: "수영", category_id: "etc" }
];

const fallbackSidoRegions = [
  { code: "11", name: "서울특별시" },
  { code: "26", name: "부산광역시" },
  { code: "27", name: "대구광역시" },
  { code: "28", name: "인천광역시" },
  { code: "29", name: "광주광역시" },
  { code: "30", name: "대전광역시" },
  { code: "31", name: "울산광역시" },
  { code: "36", name: "세종특별자치시" },
  { code: "41", name: "경기도" },
  { code: "43", name: "충청북도" },
  { code: "44", name: "충청남도" },
  { code: "45", name: "전북특별자치도" },
  { code: "46", name: "전라남도" },
  { code: "47", name: "경상북도" },
  { code: "48", name: "경상남도" },
  { code: "50", name: "제주특별자치도" }
];

const fallbackSigunguRegions = [
  { code: "11110", parent_code: "11", name: "종로구", full_name: "서울특별시 종로구" },
  { code: "11680", parent_code: "11", name: "강남구", full_name: "서울특별시 강남구" },
  { code: "11710", parent_code: "11", name: "송파구", full_name: "서울특별시 송파구" },
  { code: "11560", parent_code: "11", name: "영등포구", full_name: "서울특별시 영등포구" },
  { code: "41135", parent_code: "41", name: "분당구", full_name: "경기도 성남시 분당구" },
  { code: "41111", parent_code: "41", name: "장안구", full_name: "경기도 수원시 장안구" },
  { code: "43113", parent_code: "43", name: "흥덕구", full_name: "충청북도 청주시 흥덕구" },
  { code: "44133", parent_code: "44", name: "서북구", full_name: "충청남도 천안시 서북구" },
  { code: "50110", parent_code: "50", name: "제주시", full_name: "제주특별자치도 제주시" }
];

function getItems(data, fallback = []) {
  return data?.items?.length ? data.items : fallback;
}

function hasFallbackId(items = [], id) {
  return items.some((item) => String(item.id || item.code) === String(id));
}

function findSportByParam(value, items = fallbackSports) {
  if (!value) return null;
  const decodedValue = decodeURIComponent(String(value));
  return items.find((sport) => String(sport.id) === decodedValue || sport.name === decodedValue) || null;
}

function filterFallbackMeetings(params) {
  const keyword = (params.get("keyword") || "").trim().toLowerCase();
  const status = params.get("status") || "";
  const category = params.get("category") || "";
  const sport = findSportByParam(params.get("sport"))?.id || params.get("sport") || "";
  const sido = params.get("sido") || "";
  const sigungu = params.get("sigungu") || "";

  return fallbackMeetings.filter((meeting) => {
    const keywordTarget = `${meeting.title} ${meeting.description} ${meeting.sport_name} ${meeting.location_name}`.toLowerCase();
    if (keyword && !keywordTarget.includes(keyword)) return false;
    if (status && meeting.status !== status) return false;
    if (category && meeting.category_id !== category) return false;
    if (sport && meeting.sport_id !== sport) return false;
    if (sido && meeting.sido_code !== sido) return false;
    if (sigungu && meeting.sigungu_code !== sigungu) return false;
    return true;
  });
}

function getSportName(meeting) {
  return meeting.sport?.name || meeting.sport_name || meeting.sport || "종목 미정";
}

function getPlaceName(meeting) {
  return meeting.location_name || meeting.address || meeting.place || "장소 미정";
}

function getParticipantLabel(meeting) {
  const current = meeting.current_participants ?? meeting.current ?? 0;
  const max = meeting.max_participants ?? meeting.max ?? "-";
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
  return meeting.is_host || meeting.isHost || meeting.role === "host" || meeting.state === "host";
}

function getStatusLabel(status) {
  if (status === "closed" || status === "full") return "모집마감";
  if (status === "joined") return "참여중";
  return "모집중";
}

function getStatusClass(status) {
  if (status === "closed" || status === "full") return "is-closed";
  if (status === "joined") return "is-joined";
  return "is-open";
}

function DesktopMeetingList() {
  const [params, setParams] = useSearchParams();
  const queryKey = params.toString();
  const selectedSport = findSportByParam(params.get("sport"))?.id || params.get("sport") || "";
  const query = Object.fromEntries(params.entries());
  if (selectedSport) query.sport = selectedSport;
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
  const usesFallbackMeetings = Boolean(meetings.error);
  const items = usesFallbackMeetings ? filterFallbackMeetings(params) : getItems(meetings.data, []);
  const categoryItems = getItems(categories.data, fallbackCategories);
  const selectedCategory = params.get("category") || "";
  const selectedSido = params.get("sido") || "";
  const apiSportItems = getItems(sports.data, []);
  const usesFallbackSports = Boolean(sports.error) || !apiSportItems.length || hasFallbackId(fallbackCategories, selectedCategory);
  const sportItems = usesFallbackSports
    ? fallbackSports.filter((sport) => !selectedCategory || sport.category_id === selectedCategory)
    : apiSportItems;
  const sidoItems = getItems(sidoRegions.data, fallbackSidoRegions);
  const apiSigunguItems = getItems(sigunguRegions.data, []);
  const sigunguItems = sigunguRegions.error || !apiSigunguItems.length || hasFallbackId(fallbackSidoRegions, selectedSido)
    ? fallbackSigunguRegions.filter((region) => !selectedSido || region.parent_code === selectedSido)
    : apiSigunguItems;

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
            <input name="keyword" defaultValue={params.get("keyword") || ""} placeholder="제목, 장소, 종목, 태그 검색" />
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
          <select value={selectedSport} onChange={(event) => setParam("sport", event.target.value)}>
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
        <DesktopMeetingMap items={items} />
      ) : (
        <section className="desktop-meeting-board__results">
          <div className="desktop-section__head">
            <h2>모임 검색 결과</h2>
            <span>{items.length}개</span>
          </div>
          {meetings.loading ? (
            <LoadingCards count={4} />
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
          <b>{getDateLabel(meeting.start_at || meeting.starts_at)}</b>
        </span>
      </span>
      <span className="desktop-meeting-row__people">
        <Users size={17} />
        <b>{getParticipantLabel(meeting)}</b>
      </span>
    </Link>
  );
}

function DesktopMeetingMap({ items }) {
  return (
    <section className="desktop-meeting-map">
      <div className="desktop-meeting-map__canvas">
        <MapPin size={34} />
        <strong>지도 보기 영역</strong>
        <span>지도 API 연결 전까지는 선택 흐름을 보여주는 임시 화면입니다.</span>
      </div>
      <aside className="desktop-meeting-map__list">
        <div className="desktop-section__head">
          <h2>지도 주변 모임</h2>
          <span>{items.length}개</span>
        </div>
        {items.slice(0, 5).map((meeting) => (
          <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
            <span className="desktop-meeting-map__thumb" style={meeting.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined} />
            <span>
              <strong>{meeting.title}</strong>
              <small>
                {getPlaceName(meeting)} · {getSportName(meeting)} · {getParticipantLabel(meeting)}
              </small>
            </span>
          </Link>
        ))}
      </aside>
    </section>
  );
}

export default DesktopMeetingList;
