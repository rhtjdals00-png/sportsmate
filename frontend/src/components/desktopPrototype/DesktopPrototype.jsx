import {
  BarChart3,
  Bike,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Crown,
  Dumbbell,
  FileText,
  Footprints,
  Goal,
  Home,
  LayoutDashboard,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  Mountain,
  Navigation,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UserCheck,
  Users,
  Vote,
  X
} from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import DesktopMeetingDetail from "../meeting/desktop/DesktopMeetingDetail.jsx";
import SharedMeetingCard from "../meeting/shared/MeetingCard.jsx";
import EmptyState from "../common/EmptyState.jsx";
import LoadingCards from "../common/LoadingCards.jsx";
import { meetingApi } from "../../api/meetingApi";
import { sportApi } from "../../api/sportApi";
import { useAsync } from "../../hooks/useAsync";

const joinedStates = new Set(["host", "joined"]);

const meetings = [];

const sportGroups = [
  { group: "구기 종목", items: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { group: "라켓 스포츠", items: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { group: "러닝 / 야외", items: ["러닝", "등산", "트레킹", "자전거", "워킹"] },
  { group: "피트니스", items: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { group: "기타", items: ["볼링", "당구", "골프", "수영"] }
];

const regionGroups = [
  { group: "서울권", items: ["여의도", "잠실", "마포", "강남", "홍대", "성수", "관악"] },
  { group: "경기권", items: ["수원", "성남", "고양", "용인", "부천", "안양", "하남"] },
  { group: "인천권", items: ["송도", "부평", "청라", "계양", "남동"] },
  { group: "부산권", items: ["해운대", "서면", "광안리", "동래"] }
];

const allSports = sportGroups.flatMap((group) => group.items);
const allRegions = regionGroups.flatMap((group) => group.items);

const profileInitial = {
  nickname: "김강한",
  intro: "러닝 · 농구 · 등산을 좋아해요",
  region: "여의도, 잠실, 관악",
  sports: "러닝, 농구, 등산, 자전거",
  intensity: "중급",
  purpose: "운동 메이트 / 친목",
  responseTime: "평균 12분",
  rating: "4.8",
  attendanceRate: "92%",
  meetingCount: "12회",
  img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80"
};

const PROFILE_INTRO_MAX_LENGTH = 30;
const PROFILE_INTRO_EMPTY_TEXT = "아직 한 줄 소개가 없습니다.";

function pageTitle(title, desc, showHome = false) {
  return (
    <div className="screen-title">
      <div>
        <h1>{title}</h1>
        <span>{desc}</span>
      </div>
      {showHome && (
        <Link to="/" className="ghost-btn">
          <Home size={15} />
          홈으로
        </Link>
      )}
    </div>
  );
}

function stateBadge(item) {
  if (item.state === "host") {
    return (
      <span className="board-badge host">
        <Crown size={13} />
        내가 방장
      </span>
    );
  }
  if (item.state === "joined") return <span className="board-badge joined">참여중</span>;
  return <span className="board-badge open">모집중</span>;
}

function memberCount(item) {
  return `${item.member}명`;
}

function participantCount(item) {
  return `${String(item.member).split("/")[0]}명`;
}

function meetingDay(item) {
  return Number(item.time.match(/05\.(\d+)/)?.[1] || 0);
}

function meetingsOnDay(day) {
  return meetings.filter((item) => joinedStates.has(item.state) && meetingDay(item) === day);
}

function itemById(id) {
  return meetings.find((item) => String(item.id) === String(id)) || meetings[0];
}

function sportsByGroup(name) {
  return sportGroups.find((group) => group.group === name)?.items || allSports;
}

function regionsByGroup(name) {
  return regionGroups.find((group) => group.group === name)?.items || allRegions;
}

function groupForSport(name) {
  return sportGroups.find((group) => group.items.includes(name))?.group || "";
}

function groupForRegion(name) {
  return regionGroups.find((group) => group.items.includes(name))?.group || "";
}

function nextParams(params, updates) {
  const next = new URLSearchParams(params);
  Object.entries(updates).forEach(([key, value]) => {
    if (value) next.set(key, value);
    else next.delete(key);
  });
  return next;
}

function filterMeetings(params) {
  const sport = params.get("sport") || "";
  const sports = (params.get("sports") || "").split(",").filter(Boolean);
  const group = params.get("group") || "";
  const status = params.get("status") || "";
  const region = params.get("region") || "";
  const regions = (params.get("regions") || "").split(",").filter(Boolean);
  const regionGroup = params.get("regionGroup") || "";
  const q = (params.get("q") || "").trim().toLowerCase();
  const regionItems = regionGroup ? regionsByGroup(regionGroup) : allRegions;

  return meetings.filter((item) => {
    const haystack = `${item.title} ${item.sport} ${item.place} ${item.host} ${item.desc} ${item.tags.join(" ")}`.toLowerCase();
    const statusOk = !status || (status === "joined" ? joinedStates.has(item.state) : item.state === status);
    const groupOk = !group || sportsByGroup(group).includes(item.sport) || item.tags.some((tag) => sportsByGroup(group).includes(tag));
    const regionOk = regions.length
      ? regions.some((name) => item.place.includes(name))
      : !region && !regionGroup
        ? true
        : region
          ? item.place.includes(region)
          : regionItems.some((name) => item.place.includes(name));
    const sportOk = sports.length
      ? sports.some((name) => item.sport === name || item.tags.includes(name))
      : !sport || item.sport === sport || item.tags.includes(sport);
    return groupOk && regionOk && sportOk && statusOk && (!q || haystack.includes(q));
  });
}

function getDday(time) {
  const day = Number(time.match(/05\.(\d+)/)?.[1] || 0);
  if (!day) return "";
  const diff = day - 25;
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : "종료";
}

function MeetingCard({ item }) {
  return (
    <Link className="proto-meeting-card" to={`/meetings/${item.id}`}>
      <img src={item.img} alt={item.title} />
      <span className="tag">{item.sport}</span>
      <b>{item.title}</b>
      <small>
        {item.place} · {item.time}
      </small>
      <footer>
        <span>{item.member}</span>
      </footer>
    </Link>
  );
}

function DesktopPrototype({ page }) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeParams = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMultiFilter, setShowMultiFilter] = useState(false);
  const [homeSports, setHomeSports] = useState([]);
  const [homeRegions, setHomeRegions] = useState([]);
  const [homeRegionGroup, setHomeRegionGroup] = useState(regionGroups[0].group);
  const [selectedSports, setSelectedSports] = useState((searchParams.get("sports") || "").split(",").filter(Boolean));
  const [selectedRegions, setSelectedRegions] = useState((searchParams.get("regions") || "").split(",").filter(Boolean));
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [dayModal, setDayModal] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(routeParams.chatRoomId ?? null);
  const [previewChatId, setPreviewChatId] = useState(routeParams.chatRoomId ?? null);
  const [talkSearchOpen, setTalkSearchOpen] = useState(false);
  const [talkInfoOpen, setTalkInfoOpen] = useState(false);
  const [talkSwitching, setTalkSwitching] = useState(false);
  const [talkClosing, setTalkClosing] = useState(false);
  const [profile, setProfile] = useState(profileInitial);
  const [profileDraft, setProfileDraft] = useState(profileInitial);
  const [profileEdit, setProfileEdit] = useState(false);

  const routePage = useMemo(() => {
    if (page) return page;
    if (location.pathname === "/") return "home";
    if (location.pathname === "/meetings") return "board";
    if (location.pathname.startsWith("/meetings/")) return "detail";
    if (location.pathname.startsWith("/chats")) return "chat";
    if (location.pathname === "/mypage/meetings") return "mymeetings";
    if (location.pathname === "/mypage") return "profile";
    if (location.pathname === "/map") return "map";
    if (location.pathname.startsWith("/host")) return "host";
    return "home";
  }, [location.pathname, page]);

  const setBoardParam = (key, value, extra = {}) => setSearchParams(nextParams(searchParams, { [key]: value, ...extra }));
  const toggleValue = (setter, value) => setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  const openDayModal = (day) => setDayModal({ day, items: meetingsOnDay(day) });
  const closeCalendarModal = () => {
    setCalendarModalOpen(false);
    setDayModal(null);
  };

  const content = {
    home: (
      <HomeContent
        homeSports={homeSports}
        homeRegions={homeRegions}
        homeRegionGroup={homeRegionGroup}
        setHomeRegionGroup={setHomeRegionGroup}
        setHomeSports={setHomeSports}
        setHomeRegions={setHomeRegions}
        toggleValue={toggleValue}
      />
    ),
    board: (
      <BoardPage
        params={searchParams}
        setBoardParam={setBoardParam}
        showMultiFilter={showMultiFilter}
        setShowMultiFilter={setShowMultiFilter}
        selectedSports={selectedSports}
        setSelectedSports={setSelectedSports}
        selectedRegions={selectedRegions}
        setSelectedRegions={setSelectedRegions}
        toggleValue={toggleValue}
      />
    ),
    detail: <DesktopMeetingDetail />,
    chat: (
      <ChatPage
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
        previewChatId={previewChatId}
        setPreviewChatId={setPreviewChatId}
        talkSearchOpen={talkSearchOpen}
        setTalkSearchOpen={setTalkSearchOpen}
        talkInfoOpen={talkInfoOpen}
        setTalkInfoOpen={setTalkInfoOpen}
        talkSwitching={talkSwitching}
        setTalkSwitching={setTalkSwitching}
        talkClosing={talkClosing}
        setTalkClosing={setTalkClosing}
        navigate={navigate}
      />
    ),
    map: <MapPageContent params={searchParams} setBoardParam={setBoardParam} />,
    mymeetings: <MyMeetingsContent openDayModal={openDayModal} />,
    profile: (
      <ProfileContent
        profile={profile}
        profileDraft={profileDraft}
        setProfile={setProfile}
        setProfileDraft={setProfileDraft}
        profileEdit={profileEdit}
        setProfileEdit={setProfileEdit}
        saveProfile={() => {
          setProfile(profileDraft);
          setProfileEdit(false);
        }}
        cancelProfile={() => {
          setProfileDraft(profile);
          setProfileEdit(false);
        }}
        openCalendarModal={() => setCalendarModalOpen(true)}
      />
    ),
    host: <HostContent />
  }[routePage];

  return (
    <div className={`desktop-page desktop-prototype legacy-pc ${routePage === "chat" ? "legacy-chat-page" : ""}`}>
      {content}
      <CalendarModal open={calendarModalOpen} close={closeCalendarModal} openDayModal={openDayModal} />
      <DayModal modal={dayModal} close={() => setDayModal(null)} />
    </div>
  );
}

function HomeContent() {
  const recommendedMeetings = useAsync(() => meetingApi.list({ limit: 10 }), []);
  const sports = useAsync(() => sportApi.sports(), []);
  const recommendedItems = recommendedMeetings.data?.items || [];
  const carouselRef = useRef(null);
  const dragStateRef = useRef(null);
  const dragMovedRef = useRef(false);
  const sportItems = sports.data?.items || [];
  const homeSportShortcuts = useMemo(() => {
    const definitions = [
      { icon: CircleDot, label: "농구" },
      { icon: Goal, label: "축구" },
      { icon: Footprints, label: "러닝" },
      { icon: Dumbbell, label: "헬스" },
      { icon: Mountain, label: "등산" },
      { icon: Bike, label: "자전거" }
    ];
    return definitions.map((item) => ({
      ...item,
      sport: sportItems.find((sport) => sport.name === item.label)
    }));
  }, [sportItems]);

  const startCarouselDrag = (event) => {
    const target = carouselRef.current;
    if (!target) return;
    dragMovedRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: target.scrollLeft
    };
    target.setPointerCapture?.(event.pointerId);
  };

  const moveCarouselDrag = (event) => {
    const target = carouselRef.current;
    const state = dragStateRef.current;
    if (!target || !state) return;
    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 5) dragMovedRef.current = true;
    target.scrollLeft = state.scrollLeft - deltaX;
  };

  const endCarouselDrag = (event) => {
    carouselRef.current?.releasePointerCapture?.(event.pointerId);
    dragStateRef.current = null;
  };

  const preventDraggedClick = (event) => {
    if (!dragMovedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragMovedRef.current = false;
  };

  return (
    <>
      <section className="home-banner legacy-home-banner">
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
          {homeSportShortcuts.map(({ icon: Icon, label, sport }) => {
            return (
              <Link key={label} to={`/meetings?sport=${sport?.id || encodeURIComponent(label)}`}>
                <Icon size={24} />
                <span>{label}</span>
              </Link>
            );
          })}
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
          <div
            ref={carouselRef}
            className="home-card-carousel"
            onClickCapture={preventDraggedClick}
            onPointerDown={startCarouselDrag}
            onPointerMove={moveCarouselDrag}
            onPointerUp={endCarouselDrag}
            onPointerCancel={endCarouselDrag}
            onPointerLeave={endCarouselDrag}
          >
            {recommendedItems.map((meeting) => <SharedMeetingCard key={meeting.id} meeting={meeting} compact />)}
          </div>
        ) : (
          <EmptyState title="아직 등록된 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
        )}
      </section>
    </>
  );
}

function BoardPage({ params, setBoardParam, showMultiFilter, setShowMultiFilter, selectedSports, setSelectedSports, selectedRegions, setSelectedRegions, toggleValue }) {
  const items = filterMeetings(params);
  const selectedSport = params.get("sport") || "";
  const selectedGroup = params.get("group") || groupForSport(selectedSport || selectedSports[0]);
  const selectedRegion = params.get("region") || "";
  const selectedRegionGroup = params.get("regionGroup") || groupForRegion(selectedRegion || selectedRegions[0]);
  const selectedStatus = params.get("status") || "";
  const q = params.get("q") || "";
  const viewMode = params.get("view") || "list";
  const applyMultiFilter = () => {
    setBoardParam("sports", selectedSports.join(","), { regions: selectedRegions.join(","), sport: "", region: "", group: "", regionGroup: "", view: viewMode });
    setShowMultiFilter(false);
  };

  return (
    <>
      <div className="screen-title">
        <div>
          <h1>모임 게시판</h1>
          <span>필터와 검색을 사용하여 메이트 모집글을 찾아보세요.</span>
        </div>
        <button className="primary-small" type="button" onClick={() => setBoardParam("view", viewMode === "map" ? "list" : "map")}>
          {viewMode === "map" ? <FileText size={15} /> : <Map size={15} />}
          {viewMode === "map" ? "리스트로 보기" : "지도로 보기"}
        </button>
      </div>

      <section className="page-card board-control-card">
        <div className="board-search-row">
          <label htmlFor="board-search">
            <Search size={18} />
            <input id="board-search" defaultValue={q} placeholder="제목, 장소, 종목, 태그 검색" onKeyDown={(event) => event.key === "Enter" && setBoardParam("q", event.currentTarget.value)} />
          </label>
          <button type="button" onClick={() => setBoardParam("q", document.getElementById("board-search")?.value || "")}>
            검색
          </button>
        </div>
        <div className="filter-bar board-filter">
          <button type="button" className={!params.toString() ? "tab-on" : ""} onClick={() => setBoardParam("q", "", { sport: "", sports: "", group: "", region: "", regions: "", regionGroup: "", status: "", view: "" })}>
            전체
          </button>
          <button type="button" className={selectedStatus === "open" ? "tab-on" : ""} onClick={() => setBoardParam("status", "open")}>
            모집중
          </button>
          <select value={selectedGroup} onChange={(event) => setBoardParam("group", event.target.value, { sport: "" })}>
            <option value="">전체 대분류</option>
            {sportGroups.map((group) => (
              <option key={group.group} value={group.group}>
                {group.group}
              </option>
            ))}
          </select>
          <select value={selectedSport} disabled={!selectedGroup} onChange={(event) => setBoardParam("sport", event.target.value)}>
            <option value="">전체 소분류</option>
            {sportsByGroup(selectedGroup).map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
          <select value={selectedRegionGroup} onChange={(event) => setBoardParam("regionGroup", event.target.value, { region: "" })}>
            <option value="">전체 지역</option>
            {regionGroups.map((group) => (
              <option key={group.group} value={group.group}>
                {group.group}
              </option>
            ))}
          </select>
          <select value={selectedRegion} disabled={!selectedRegionGroup} onChange={(event) => setBoardParam("region", event.target.value)}>
            <option value="">전체 구역</option>
            {regionsByGroup(selectedRegionGroup).map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowMultiFilter((value) => !value)}>
            <SlidersHorizontal size={14} />
            상세/다중 필터
          </button>
        </div>
      </section>

      {showMultiFilter && (
        <section className="page-card board-multi-filter-panel">
          <div className="section-head">
            <h2>
              <SlidersHorizontal size={16} />
              상세 복수 선택 필터
            </h2>
            <div className="board-filter-actions">
              <button className="ghost-btn" type="button" onClick={() => { setSelectedSports([]); setSelectedRegions([]); }}>
                <RotateCcw size={14} />
                초기화
              </button>
              <button className="ghost-btn" type="button" onClick={() => setShowMultiFilter(false)}>
                <X size={14} />
                닫기
              </button>
            </div>
          </div>
          <div className="multi-filter-grid">
            <MultiChoice title="운동종목" groups={sportGroups} values={selectedSports} setValues={setSelectedSports} toggleValue={toggleValue} />
            <MultiChoice title="지역" groups={regionGroups} values={selectedRegions} setValues={setSelectedRegions} toggleValue={toggleValue} />
          </div>
          <button className="board-filter-apply" type="button" onClick={applyMultiFilter}>
            <Check size={15} />
            필터 적용하기
          </button>
        </section>
      )}

      {viewMode === "map" ? <MapResults items={items} /> : <BoardRows items={items} />}
    </>
  );
}

function MultiChoice({ title, groups, values, setValues, toggleValue }) {
  return (
    <div>
      <strong>
        {title} <em>{values.length ? values.join(", ") : "선택 없음"}</em>
      </strong>
      <div className="choice-pill-grid">
        {groups.map((group) => (
          <section className="choice-group" key={group.group}>
            <b>{group.group}</b>
            <div>
              {group.items.map((item) => (
                <label className="choice-pill" key={item}>
                  <input type="checkbox" checked={values.includes(item)} onChange={() => toggleValue(setValues, item)} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function BoardRows({ items }) {
  return (
    <div className="page-card proto-board-results">
      <div className="section-head">
        <h2>모임 검색 결과</h2>
        <span>{items.length}개</span>
      </div>
      {items.length ? (
        <div className="proto-board-table">
          <div className="proto-board-head">
            <span>모임 정보</span>
            <span>상태</span>
            <span>종목</span>
            <span>지역</span>
            <span>일시</span>
            <span>참여</span>
          </div>
          {items.map((item) => (
            <Link key={item.id} to={`/meetings/${item.id}`} className="proto-board-row">
              <span>
                <img src={item.img} alt="" />
                <span>
                  <b>{item.title}</b>
                </span>
              </span>
              <span>{stateBadge(item)}</span>
              <span>{item.sport}</span>
              <span>{item.place}</span>
              <span>{item.time}</span>
              <span>{item.member}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-result">
          <Search size={34} />
          <b>조건에 맞는 모임이 없습니다.</b>
          <span>검색어와 필터를 조금 넓혀보세요.</span>
        </div>
      )}
    </div>
  );
}

function MapResults({ items }) {
  return (
    <div className="map-layout">
      <section className="mock-map page-card">
        <div className="map-current-label">
          <Navigation size={14} />
          현재 위치 기준
        </div>
        <div className="map-pin p1"><Footprints size={22} /></div>
        <div className="map-pin p2"><Bike size={22} /></div>
        <div className="map-pin p3"><Mountain size={22} /></div>
        <div className="map-center" />
      </section>
      <aside className="page-card map-side-list">
        <div className="section-head">
          <h2>지도 주변 모임</h2>
          <span>{items.length}개</span>
        </div>
        {items.map((item) => (
          <Link key={item.id} to={`/meetings/${item.id}`} className="map-result">
            <img src={item.img} alt="" />
            <span>
              <b>{item.title}</b>
              <small>{item.place} · {item.sport} · {item.member}</small>
            </span>
          </Link>
        ))}
      </aside>
    </div>
  );
}

function ChatPage({ selectedChatId, setSelectedChatId, previewChatId, setPreviewChatId, talkSearchOpen, setTalkSearchOpen, talkInfoOpen, setTalkInfoOpen, talkSwitching, setTalkSwitching, talkClosing, setTalkClosing, navigate }) {
  const chatMeetings = meetings.filter((item) => joinedStates.has(item.state));
  const selected = selectedChatId === null ? null : chatMeetings.find((item) => String(item.id) === String(selectedChatId));
  const openRoom = (id) => {
    const nextId = String(id);
    setPreviewChatId(nextId);
    if (selectedChatId && String(selectedChatId) !== nextId) {
      setTalkSwitching(true);
      window.setTimeout(() => {
        setSelectedChatId(nextId);
        setTalkSwitching(false);
        navigate(`/chats/${id}`);
      }, 150);
      return;
    }
    setSelectedChatId(nextId);
    navigate(`/chats/${id}`);
  };
  const closeRoom = () => {
    setTalkClosing(true);
    window.setTimeout(() => {
      setSelectedChatId(null);
      setPreviewChatId(null);
      setTalkClosing(false);
      navigate("/chats");
    }, 420);
  };

  return (
    <>
      {pageTitle("내 채팅", "참여중인 모임 채팅방을 한곳에서 확인합니다.")}
      <div className="talk-layout">
        <aside className="page-card talk-list">
          <div className="talk-list-head">
            <h2>참여중인 채팅방</h2>
          </div>
          <div className="talk-list-items">
            {chatMeetings.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`proto-talk-room-item ${String(previewChatId) === String(item.id) || selected?.id === item.id ? "selected" : ""}`}
                onClick={() => setPreviewChatId(String(item.id))}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  openRoom(item.id);
                }}
              >
                <img src={item.img} alt={item.title} />
                <span>
                  <b>{item.title}</b>
                  <small>{item.place} · {participantCount(item)}</small>
                </span>
                <em>{index === 0 ? "방금" : `14:${30 - index * 4}`}</em>
              </button>
            ))}
          </div>
        </aside>
        {selected ? (
          <TalkRoom item={selected} talkSearchOpen={talkSearchOpen} setTalkSearchOpen={setTalkSearchOpen} talkInfoOpen={talkInfoOpen} setTalkInfoOpen={setTalkInfoOpen} switching={talkSwitching} closing={talkClosing} close={closeRoom} />
        ) : (
          <section className="page-card talk-room talk-room-empty">
            <div className="talk-empty-apple">
              <img src="/img/test3.png" alt="Sportsmate 사과 로고" />
              <p>채팅을 더블클릭하면 대화가 열립니다.</p>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function TalkRoom({ item, talkSearchOpen, setTalkSearchOpen, talkInfoOpen, setTalkInfoOpen, switching, closing, close }) {
  return (
    <section className={`page-card talk-room talk-room-open ${switching ? "talk-room-switching" : ""} ${closing ? "talk-room-closing" : ""}`}>
      <div className="talk-room-top">
        <div>
          <strong>{item.title}</strong>
          <small>{item.place} · {participantCount(item)}</small>
        </div>
        <span>
          {item.state === "host" && (
            <Link className="host-chat-btn" to={`/host/meetings/${item.id}`}>
              <LayoutDashboard size={15} />
              방장 대시보드
            </Link>
          )}
          <button className="talk-tool-btn" type="button" onClick={() => setTalkInfoOpen((value) => !value)}>
            <ClipboardList size={15} />
            <b>공지/일정</b>
          </button>
          <button className="talk-icon-btn" type="button" onClick={() => setTalkSearchOpen((value) => !value)}>
            <Search size={15} />
          </button>
          <button className="talk-close-btn" type="button" onClick={close}>
            <X size={15} />
          </button>
        </span>
      </div>
      <div className={`talk-search-panel ${talkSearchOpen ? "is-open" : ""}`}>
        <Search size={15} />
        <input placeholder="대화 내용 검색" />
      </div>
      <div className={`talk-info-panel ${talkInfoOpen ? "is-open" : ""}`}>
        <Link to={`/meetings/${item.id}`}>
          <Megaphone size={15} />
          <span>공지와 모임 상세 확인</span>
        </Link>
        <Link to="/mypage/meetings">
          <CalendarDays size={15} />
          <span>{item.time} 일정 보기</span>
        </Link>
        <Link to="/host/meetings/0/vote">
          <BarChart3 size={15} />
          <span>투표 확인</span>
        </Link>
      </div>
      <div className="talk-messages">
        <div className="talk-date">오늘</div>
        <div className="talk-bubble left">
          <b>{item.host}</b>
          <p>오늘 모임 시간 맞춰서 오시면 됩니다!</p>
        </div>
        <div className="talk-bubble right">
          <p>네 확인했습니다. 준비해서 갈게요.</p>
        </div>
        <div className="talk-bubble left">
          <b>모임 공지</b>
          <p>장소와 준비물은 상세 페이지에서 다시 확인해주세요.</p>
        </div>
        <div className="talk-poll">
          <b>코스 투표</b>
          <p>어떤 코스로 진행할까요?</p>
          <div><span>5km 코스</span><em style={{ width: "67%" }} /><strong>8명</strong></div>
          <div><span>8km 코스</span><em style={{ width: "33%" }} /><strong>4명</strong></div>
        </div>
      </div>
      <div className="talk-input">
        <span>메시지를 입력하세요...</span>
        <Send size={18} />
      </div>
    </section>
  );
}

function CalendarGrid({ openDayModal }) {
  return (
    <section className="page-card calendar-card">
      <div className="calendar-head">
        <button type="button"><ChevronLeft size={20} /></button>
        <div>
          <p>2025년 5월</p>
          <h2>이번 달 운동 일정</h2>
        </div>
        <button type="button"><ChevronRight size={20} /></button>
      </div>
      <div className="calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div className="calendar-grid">
        {Array.from({ length: 35 }, (_, index) => {
          const day = index - 2;
          const items = day > 0 && day <= 31 ? meetingsOnDay(day) : [];
          const first = items[0];
          return (
            <button type="button" key={index} onClick={() => day > 0 && day <= 31 && openDayModal(day)} className={`calendar-day ${items.length ? "has-event" : ""} ${items.some((item) => item.state === "host") ? "host-day" : ""}`}>
              <b>{day > 0 && day <= 31 ? day : ""}</b>
              {first && (
                <>
                  <small>{first.title}</small>
                  <em>{items.length > 1 ? `+${items.length - 1}개 더보기` : first.state === "host" ? "방장" : first.state === "joined" ? "참여" : "모집"}</em>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MyMeetingsContent({ openDayModal }) {
  const scheduled = meetings.filter((item) => joinedStates.has(item.state));
  return (
    <>
      {pageTitle("내 일정", "참여 예정인 모임과 내가 방장인 모임을 캘린더로 확인합니다.")}
      <div className="schedule-layout">
        <CalendarGrid openDayModal={openDayModal} />
        <aside className="page-card schedule-list">
          <div className="section-head">
            <h2>다가오는 일정</h2>
            <span>{scheduled.length}개</span>
          </div>
          {scheduled.map((item) => <ScheduleItem key={item.id} item={item} />)}
        </aside>
      </div>
    </>
  );
}

function ScheduleItem({ item, variant = "" }) {
  const isHost = item.state === "host";
  const showMemberBadge = !isHost && variant !== "profile";
  return (
    <article className={`proto-schedule-item ${variant ? `proto-schedule-item--${variant}` : ""} ${isHost ? "proto-schedule-item--host" : ""}`}>
      {isHost && <Link className="schedule-manage-btn is-active" to={`/host/meetings/${item.id}`}><LayoutDashboard size={14} />관리</Link>}
      <img src={item.img} alt={item.title} />
      <div>
        {isHost && <div className="schedule-item-status"><span className="host-badge"><Crown size={13} />내가 방장</span></div>}
        <div className="schedule-meta-row">
          <span className="schedule-date">{item.time}</span>
          <span className="schedule-dday">{getDday(item.time)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.place} · {item.member}</p>
        {showMemberBadge && <div><span className="member-badge">참여중</span></div>}
        <footer>
          <Link className="ghost-btn" to={`/meetings/${item.id}`}><FileText size={14} />상세</Link>
          <Link className="ghost-btn" to={`/chats/${item.id}`}><MessageCircle size={14} />채팅</Link>
        </footer>
      </div>
    </article>
  );
}

function ProfileContent({ profile, setProfile, setProfileDraft, openCalendarModal }) {
  const navigate = useNavigate();
  const [activeActivity, setActiveActivity] = useState("schedule");
  const [introEdit, setIntroEdit] = useState(false);
  const [introDraft, setIntroDraft] = useState(profile.intro);
  const [authOpen, setAuthOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const changeProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) => ({ ...current, img: reader.result }));
      setProfileDraft((current) => ({ ...current, img: reader.result }));
    };
    reader.readAsDataURL(file);
  };
  const saveIntro = () => {
    const nextIntro = introDraft.trim().slice(0, PROFILE_INTRO_MAX_LENGTH);
    setProfile((current) => ({ ...current, intro: nextIntro }));
    setProfileDraft((current) => ({ ...current, intro: nextIntro }));
    setIntroEdit(false);
  };
  const openProtectedEdit = () => {
    setAuthOpen(true);
    setAuthPassword("");
  };
  const confirmProtectedEdit = () => {
    // 2026-06-29: 실제 비밀번호 검증 API 연결 전까지 PC 프론트 진입 흐름만 mock 처리.
    setAuthOpen(false);
    navigate("/mypage/profile");
  };
  const scheduled = meetings.filter((item) => joinedStates.has(item.state));
  const hostedMeetings = meetings.filter((item) => item.state === "host");
  const joinedMeetings = meetings.filter((item) => item.state === "joined");
  const favoriteMeetings = meetings.filter((item) => item.state === "open").slice(0, 2);
  const reviewItems = joinedMeetings.slice(0, 2);
  const activityPanels = {
    schedule: { label: "다가오는 일정", count: scheduled.length, items: scheduled },
    hosted: { label: "내가 만든 모임", count: hostedMeetings.length, items: hostedMeetings },
    joined: { label: "참여 중인 모임", count: joinedMeetings.length, items: joinedMeetings },
    favorite: { label: "관심 모임", count: favoriteMeetings.length, items: favoriteMeetings },
    reviews: { label: "후기 관리", count: reviewItems.length, items: reviewItems }
  };
  const activityMenu = [
    { key: "schedule", label: "다가오는 일정", icon: CalendarDays },
    { key: "hosted", label: "내가 만든 모임", icon: Crown },
    { key: "joined", label: "참여 중인 모임", icon: Users },
    { key: "favorite", label: "관심 모임", icon: CircleDot },
    { key: "reviews", label: "후기 관리", icon: FileText }
  ];
  const activePanel = activityPanels[activeActivity];
  return (
    <>
      {pageTitle("내 정보", "프로필을 관리하고 이번 달 운동 일정을 모니터링합니다.")}
      <div className="profile-grid profile-grid--8b">
        <div className="profile-left-stack">
            <section className="profile-card profile-gold-card">
              <button className="profile-edit-btn" type="button" onClick={openProtectedEdit}>프로필 수정</button>
              <label className="profile-photo-quick" aria-label="프로필 사진 바꾸기">
                <Camera size={15} />
                <input type="file" accept="image/*" onChange={changeProfileImage} />
              </label>
              <img src={profile.img} alt="프로필 이미지" />
              <h2>{profile.nickname}</h2>
              {/* 2026-06-29: 한 줄 소개 수정 시 프로필 카드 높이가 출렁이지 않도록 고정 영역 안에서 상태만 전환. */}
              <div className="profile-intro-slot">
                {introEdit ? (
                  <div className="profile-intro-edit">
                    <input
                      value={introDraft}
                      maxLength={PROFILE_INTRO_MAX_LENGTH}
                      onChange={(event) => setIntroDraft(event.target.value.slice(0, PROFILE_INTRO_MAX_LENGTH))}
                    />
                    <div>
                      <span>{introDraft.length}/{PROFILE_INTRO_MAX_LENGTH}</span>
                      <button type="button" onClick={saveIntro}>저장</button>
                      <button type="button" onClick={() => { setIntroDraft(profile.intro); setIntroEdit(false); }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="profile-intro-quick">
                    <span className={!profile.intro ? "is-empty" : ""}>{profile.intro || PROFILE_INTRO_EMPTY_TEXT}</span>
                    <button type="button" onClick={() => setIntroEdit(true)}><Pencil size={12} />수정</button>
                  </div>
                )}
              </div>
              <div className="profile-stats-row">
                <span><b>{profile.rating}</b><em>평점</em></span>
                <span><b>{profile.attendanceRate}</b><em>참여율</em></span>
                <span><b>{profile.meetingCount}</b><em>누적 참여</em></span>
              </div>
            </section>
          <section className="page-card profile-preference-card">
            <h3>기본 정보 및 운동 성향</h3>
            <div className="preference-list">
              <p><b>선호 지역</b><span>{profile.region}</span></p>
              <p><b>관심 종목</b><span>{profile.sports}</span></p>
              <p><b>운동 수준</b><span>{profile.intensity}</span></p>
            </div>
          </section>
        </div>
        <section className="page-card schedule-list profile-schedule-panel">
          {/* 2026-06-29: 활동 메뉴는 결과 패널 상단 탭으로 배치해 클릭 위치와 변경 결과를 같은 영역에 둠. */}
          <div className="profile-activity-tabs">
            {activityMenu.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={activeActivity === key ? "is-active" : ""}
                type="button"
                onClick={() => setActiveActivity(key)}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="section-head profile-schedule-head">
            <div>
              <h2>{activePanel.label} <span className="schedule-count-inline">{activePanel.count}개</span></h2>
            </div>
            <div className={`profile-schedule-actions ${activeActivity !== "schedule" ? "is-placeholder" : ""}`}>
              {activeActivity === "schedule" ? (
                <button className="calendar-expand-btn" type="button" onClick={openCalendarModal}><CalendarDays size={15} />달력으로 보기</button>
              ) : (
                <span aria-hidden="true">달력으로 보기</span>
              )}
            </div>
          </div>
          <div className="profile-schedule-body">
            {activeActivity === "reviews" ? (
              reviewItems.map((item) => (
                <article className="profile-review-item" key={item.id}>
                  <div>
                    <b>{item.title}</b>
                    <span>{item.time} · {item.place}</span>
                  </div>
                  <button className="ghost-btn" type="button">후기 작성</button>
                </article>
              ))
            ) : (
              activePanel.items.map((item) => <ScheduleItem key={item.id} item={item} variant="profile" />)
            )}
            {!activePanel.items.length && <p className="empty-schedule">표시할 항목이 없습니다.</p>}
          </div>
        </section>
      </div>
      {authOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <section className="profile-auth-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            <ShieldCheck size={26} />
            <h2>프로필 수정 확인</h2>
            <p>중요한 프로필 정보를 수정하기 전에 비밀번호 확인이 필요합니다.</p>
            <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="비밀번호 입력" />
            <div>
              <button className="ghost-btn" type="button" onClick={() => setAuthOpen(false)}>취소</button>
              <button className="primary-small" type="button" onClick={confirmProtectedEdit}>확인</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function CalendarModal({ open, close, openDayModal }) {
  if (!open) return null;
  return (
    <div className="schedule-modal schedule-modal--calendar is-open is-calendar-modal" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="schedule-modal-panel">
        <button className="schedule-modal-close" type="button" onClick={close}><X size={18} /></button>
        <h2 className="schedule-modal-title">2025년 5월 전체 일정</h2>
        <div className="schedule-modal-body">
          <div className="profile-calendar-expanded">
            <CalendarGrid openDayModal={openDayModal} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DayModal({ modal, close }) {
  if (!modal) return null;
  return (
    <div className="schedule-modal schedule-modal--day is-open" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="schedule-modal-panel">
        <button className="schedule-modal-close" type="button" onClick={close}><X size={18} /></button>
        <h2 className="schedule-modal-title">5월 {modal.day}일 일정</h2>
        <div className="schedule-modal-body">
          {modal.items.length ? modal.items.map((item) => (
            <article className="schedule-modal-item" key={item.id}>
              <img src={item.img} alt={item.title} />
              <div>
                {item.state === "host" && <div className="schedule-modal-status">{stateBadge(item)}</div>}
                <span>{item.time}</span>
                <h3>{item.title}</h3>
                <p>{item.place} · {item.member}</p>
                {item.state !== "host" && stateBadge(item)}
                <footer>
                  <Link className="ghost-btn" to={`/meetings/${item.id}`}>상세 보기</Link>
                  {joinedStates.has(item.state) ? <Link className="ghost-btn" to={`/chats/${item.id}`}>채팅</Link> : <Link className="primary-small" to="/mypage/meetings">참가 신청</Link>}
                  {item.state === "host" && <Link className="primary-small" to={`/host/meetings/${item.id}`}>관리</Link>}
                </footer>
              </div>
            </article>
          )) : <p className="empty-schedule">등록된 일정이 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}

function MapPageContent({ params, setBoardParam }) {
  const items = filterMeetings(params);
  return (
    <>
      {pageTitle("지도 검색", "내 주변 모임을 지도와 결과 목록으로 묶어보는 화면입니다.")}
      <section className="page-card board-control-card">
        <div className="board-search-row">
          <label htmlFor="map-search">
            <Search size={18} />
            <input id="map-search" defaultValue={params.get("q") || ""} placeholder="종목, 모임명 검색" onKeyDown={(event) => event.key === "Enter" && setBoardParam("q", event.currentTarget.value)} />
          </label>
          <button type="button" onClick={() => setBoardParam("q", document.getElementById("map-search")?.value || "")}>검색</button>
        </div>
      </section>
      <MapResults items={items} />
    </>
  );
}

function HostContent() {
  const item = meetings[0];
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
      img: "/img/test2.png"
    }
  ];

  return (
    <>
      {pageTitle("방장 관리", "모임 상태를 확인하고 신청자 승인, 공지, 투표, 출석을 한 화면에서 관리합니다.")}
      {/* 2026-06-30: 모바일 방장 관리 흐름을 기준으로 PC에서는 신청자 처리와 운영 도구를 한 화면에 배치. */}
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
              <img src={item.img} alt="" />
              <div>
                <span className="host-sport-chip">러닝 / 야외</span>
                <h3>{item.title}</h3>
                <p><CalendarDays size={15} />{item.time}</p>
                <p><MapPin size={15} />{item.place}</p>
              </div>
              <div className="host-meeting-side">
                <strong><Users size={17} />8 / 10명</strong>
                <Link to={`/meetings/${item.id}`}>자세히 보기 <ChevronRight size={15} /></Link>
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
              <h2>신청자 관리</h2>
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
          <Link className="host-applicant-more" to="/host/meetings/0/applicants">신청자 전체 보기 <ChevronRight size={15} /></Link>
        </section>
      </div>
    </>
  );
}

export default DesktopPrototype;

