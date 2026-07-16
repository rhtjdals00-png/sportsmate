import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MobilePullToRefresh from "../../layout/mobile/MobilePullToRefresh.jsx";
import MeetingCard from "../shared/MeetingCard.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";
import { koreaRegions } from "../../../data/koreaRegions";

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
  { code: "42", name: "강원특별자치도" },
  { code: "43", name: "충청북도" },
  { code: "44", name: "충청남도" },
  { code: "45", name: "전북특별자치도" },
  { code: "46", name: "전라남도" },
  { code: "47", name: "경상북도" },
  { code: "48", name: "경상남도" },
  { code: "50", name: "제주특별자치도" }
];

const isNumericId = (value) => /^\d+$/.test(String(value || ""));

const mergeByName = (primary = [], fallback = []) => {
  const seen = new Set();
  return [...primary, ...fallback].filter((item) => {
    const name = item?.name;
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

function MobileMeetingList() {
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState(params.get("keyword") || "");

  useEffect(() => {
    setKeywordDraft(params.get("keyword") || "");
  }, [params]);

  const query = Object.fromEntries(params.entries());
  const meetings = useAsync(() => meetingApi.list({ limit: 10, ...query }), [params.toString()]);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(
    () => sportApi.sports(isNumericId(params.get("category")) ? { category_id: params.get("category") } : {}),
    [params.get("category")]
  );
  const sidoRegions = useAsync(() => locationApi.regions({ level: "sido" }), []);
  const sigunguRegions = useAsync(
    () => params.get("sido") ? locationApi.regions({ level: "sigungu", parent_code: params.get("sido") }) : Promise.resolve({ items: [] }),
    [params.get("sido")]
  );
  const categoryItems = categories.data?.items?.length ? categories.data.items : fallbackCategories;
  const sportItems = sports.data?.items?.length
    ? sports.data.items
    : fallbackSports.filter((sport) => !params.get("category") || String(sport.category_id) === String(params.get("category")));
  const sidoItems = mergeByName(sidoRegions.data?.items || [], fallbackSidoRegions);
  const currentCategory = categoryItems.find((category) => String(category.id) === String(params.get("category")));
  const currentSport = sportItems.find((sport) => String(sport.id) === String(params.get("sport")));
  const currentSido = sidoItems.find((region) => String(region.code) === String(params.get("sido")));
  const fallbackSigunguRegions = currentSido
    ? (koreaRegions.find((region) => region.name === currentSido.name)?.areas || []).map((name) => ({ code: name, name }))
    : [];
  const sigunguItems = mergeByName(sigunguRegions.data?.items || [], fallbackSigunguRegions);
  const currentSigungu = sigunguItems.find((region) => String(region.code) === String(params.get("sigungu")));

  const filterType = params.get("meeting_type");
  const displayedMeetings = useMemo(() => {
    const rawItems = meetings.data?.items || [];
    
    const openItems = rawItems.filter((meeting) => {
      if (meeting.status !== "open") return false;
      if (meeting.current_participants >= meeting.max_participants) return false;
      
      if (meeting.meeting_type === "regular") {
        if (meeting.end_at) return new Date(meeting.end_at) >= new Date();
        return true;
      } else {
        return new Date(meeting.start_at) >= new Date();
      }
    });

    if (!filterType) return openItems;
    return openItems.filter((meeting) => meeting.meeting_type === filterType);
  }, [meetings.data?.items, filterType]);

  const currentMeetingTypeLabel = useMemo(() => {
    if (filterType === "one_time") return "일회성 모임";
    if (filterType === "regular") return "정기 모임";
    return null;
  }, [filterType]);

  const filterSummary = useMemo(() => [
    currentMeetingTypeLabel,
    currentCategory?.name,
    currentSport?.name,
    currentSido?.name,
    currentSigungu?.name
  ].filter(Boolean).join(" · ") || "상세 설정", [currentMeetingTypeLabel, currentCategory, currentSport, currentSido, currentSigungu]);

  const setCategory = (categoryId) => {
    const next = new URLSearchParams(params);
    if (categoryId) next.set("category", categoryId);
    else next.delete("category");
    next.delete("sport");
    setParams(next);
  };

  const setSport = (sportId) => {
    const next = new URLSearchParams(params);
    if (sportId) next.set("sport", sportId);
    else next.delete("sport");
    setParams(next);
  };

  const setRegion = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "sido") next.delete("sigungu");
    setParams(next);
  };

  const setMeetingType = (typeValue) => {
    const next = new URLSearchParams(params);
    if (typeValue) next.set("meeting_type", typeValue);
    else next.delete("meeting_type");
    setParams(next);
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    setParams(next);
    setKeywordDraft("");
  };

  return (
    <MobilePullToRefresh onRefresh={async () => { await meetings.execute(); }}>
      <MobileHeader title="모임 게시판" />
      <section className="search-panel">
        <input
          aria-label="모임 검색"
          placeholder="지역, 종목, 모임명을 검색하세요"
          value={keywordDraft}
          onChange={(event) => setKeywordDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const next = new URLSearchParams(params);
            if (event.currentTarget.value) next.set("keyword", event.currentTarget.value);
            else next.delete("keyword");
            setParams(next);
          }}
        />
        <button type="button" aria-label="상세 설정" onClick={() => setFilterOpen((value) => !value)} className={filterOpen ? "is-active" : ""}>
          <SlidersHorizontal size={20} />
        </button>
      </section>

      <div className="mobile-filter-type-tabs" style={{ margin: '8px 16px 12px' }}>
        <button
          type="button"
          className={!params.get("meeting_type") ? "is-active" : ""}
          onClick={() => setMeetingType("")}
        >
          전체 모임
        </button>
        <button
          type="button"
          className={params.get("meeting_type") === "one_time" ? "is-active" : ""}
          onClick={() => setMeetingType("one_time")}
        >
          일회성 모임
        </button>
        <button
          type="button"
          className={params.get("meeting_type") === "regular" ? "is-active" : ""}
          onClick={() => setMeetingType("regular")}
        >
          정기 모임
        </button>
      </div>

      {filterOpen ? (
        <section className="mobile-filter-panel" aria-label={filterSummary}>
          <label>
            종목 카테고리
            <select value={params.get("category") || ""} onChange={(event) => setCategory(event.target.value)}>
              <option value="">카테고리 선택</option>
              {categoryItems.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            종목
            <select value={params.get("sport") || ""} onChange={(event) => setSport(event.target.value)}>
              <option value="">종목 선택</option>
              {sportItems.map((sport) => <option key={sport.id} value={sport.id} disabled={!isNumericId(sport.id)}>{sport.name}</option>)}
            </select>
          </label>
          <label>
            지역
            <select value={params.get("sido") || ""} onChange={(event) => setRegion("sido", event.target.value)}>
              <option value="">지역 선택</option>
              {sidoItems.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </label>
          <label>
            시/군/구
            <select value={params.get("sigungu") || ""} onChange={(event) => setRegion("sigungu", event.target.value)} disabled={!params.get("sido")}>
              <option value="">전체</option>
              {sigunguItems.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
            </select>
          </label>
          <button type="button" className="mobile-filter-reset-btn" onClick={resetFilters}>
            조건 초기화
          </button>
        </section>
      ) : null}

      {meetings.loading ? (
        <LoadingCards />
      ) : displayedMeetings.length ? (
        <div className="card-list">
          {displayedMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 모임이 없습니다."
          description="직접 첫 모임을 만들어보세요."
          actionLabel="모임 만들기"
          actionTo="/meetings/create"
        />
      )}
    </MobilePullToRefresh>
  );
}

export default MobileMeetingList;
