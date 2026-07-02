import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MeetingCard from "../shared/MeetingCard.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";

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

const isNumericId = (value) => /^\d+$/.test(String(value || ""));

function MobileMeetingList() {
  const [params, setParams] = useSearchParams();
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

  return (
    <>
      <MobileHeader title="모임 게시판" />
      <section className="search-panel">
        <input
          aria-label="모임 검색"
          placeholder="지역, 종목, 모임명을 검색하세요"
          defaultValue={params.get("keyword") || ""}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const next = new URLSearchParams(params);
            if (event.currentTarget.value) next.set("keyword", event.currentTarget.value);
            else next.delete("keyword");
            setParams(next);
          }}
        />
        <button type="button" aria-label="필터">
          <SlidersHorizontal size={20} />
        </button>
      </section>

      <div className="chip-scroll chip-scroll--nested">
        <button type="button" onClick={() => setCategory("")} className={!params.get("category") ? "active" : ""}>
          전체
        </button>
        {(categories.data?.items?.length ? categories.data.items : fallbackCategories).map((category) => (
          <button
            type="button"
            key={category.id}
            onClick={() => setCategory(String(category.id))}
            className={params.get("category") === String(category.id) ? "active" : ""}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="chip-scroll">
        <button type="button" onClick={() => setSport("")} className={!params.get("sport") ? "active" : ""}>
          종목 전체
        </button>
        {(sports.data?.items?.length
          ? sports.data.items
          : fallbackSports.filter((sport) => !params.get("category") || String(sport.category_id) === String(params.get("category")))
        ).map((sport) => (
          <button
            type="button"
            key={sport.id}
            onClick={() => setSport(String(sport.id))}
            className={params.get("sport") === String(sport.id) ? "active" : ""}
            disabled={!isNumericId(sport.id)}
          >
            {sport.name}
          </button>
        ))}
      </div>

      <div className="chip-scroll chip-scroll--muted">
        <button type="button" onClick={() => setRegion("sido", "")} className={!params.get("sido") ? "active" : ""}>
          전국
        </button>
        {(sidoRegions.data?.items?.length ? sidoRegions.data.items : fallbackSidoRegions).map((region) => (
          <button
            type="button"
            key={region.code}
            onClick={() => setRegion("sido", region.code)}
            className={params.get("sido") === region.code ? "active" : ""}
          >
            {region.name.replace("특별시", "").replace("광역시", "").replace("특별자치도", "").replace("특별자치시", "")}
          </button>
        ))}
      </div>

      {params.get("sido") && (
        <div className="chip-scroll chip-scroll--muted">
          <button type="button" onClick={() => setRegion("sigungu", "")} className={!params.get("sigungu") ? "active" : ""}>
            시군구 전체
          </button>
          {(sigunguRegions.data?.items || []).map((region) => (
            <button
              type="button"
              key={region.code}
              onClick={() => setRegion("sigungu", region.code)}
              className={params.get("sigungu") === region.code ? "active" : ""}
            >
              {region.name}
            </button>
          ))}
        </div>
      )}

      {meetings.loading ? (
        <LoadingCards />
      ) : meetings.data?.items?.length ? (
        <div className="card-list">
          {meetings.data.items.map((meeting) => (
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
    </>
  );
}

export default MobileMeetingList;
