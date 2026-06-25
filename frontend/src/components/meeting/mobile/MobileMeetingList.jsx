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

function MobileMeetingList() {
  const [params, setParams] = useSearchParams();
  const query = Object.fromEntries(params.entries());
  const meetings = useAsync(() => meetingApi.list(query), [params.toString()]);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(params.get("category") ? { category_id: params.get("category") } : {}), [params.get("category")]);
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
      <MobileHeader title="모임 찾기" />
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
        {(categories.data?.items || []).map((category) => (
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
        {(sports.data?.items || []).map((sport) => (
          <button
            type="button"
            key={sport.id}
            onClick={() => setSport(String(sport.id))}
            className={params.get("sport") === String(sport.id) ? "active" : ""}
          >
            {sport.name}
          </button>
        ))}
      </div>

      <div className="chip-scroll chip-scroll--muted">
        <button type="button" onClick={() => setRegion("sido", "")} className={!params.get("sido") ? "active" : ""}>
          전국
        </button>
        {(sidoRegions.data?.items || []).map((region) => (
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
