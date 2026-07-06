import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bike, CalendarClock, CircleDot, Dumbbell, Eye, Footprints, LocateFixed, Map, MapPin, MessageSquareText, Mountain, Navigation, Route, Search, ShieldCheck, Star, Trophy, UserRound, UsersRound } from "lucide-react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";

const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

function loadNaverMapScript(clientId) {
  if (!clientId) return Promise.reject(new Error("missing naver map client id"));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (window.__sportsmateNaverMapPromise) return window.__sportsmateNaverMapPromise;

  window.__sportsmateNaverMapPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(NAVER_MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.naver.maps), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve(window.naver.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__sportsmateNaverMapPromise;
}

function toMapPoint(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function openNaverDirections({ origin, destination }) {
  const destPoint = toMapPoint(destination);
  if (!destPoint) {
    const keyword = encodeURIComponent(destination.address || destination.location_name || "");
    window.open(`https://map.naver.com/p/search/${keyword}`, "_blank", "noopener,noreferrer");
    return;
  }

  const destinationName = encodeURIComponent(destination.location_name || destination.address || "모임 장소");
  const destinationPart = `${destPoint.longitude},${destPoint.latitude},${destinationName},,`;
  const originPoint = toMapPoint(origin);
  const originPart = originPoint
    ? `${originPoint.longitude},${originPoint.latitude},${encodeURIComponent(origin.title || origin.address || "출발지")},,`
    : "-";
  window.open(`https://map.naver.com/p/directions/${originPart}/${destinationPart}/-/transit`, "_blank", "noopener,noreferrer");
}

function MeetingLocationMap({ clientId, meeting }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const point = toMapPoint(meeting);

  useEffect(() => {
    if (!clientId || !point) return;
    let disposed = false;
    setStatus("loading");
    loadNaverMapScript(clientId)
      .then((maps) => {
        if (disposed || !mapElementRef.current) return;
        const position = new maps.LatLng(point.latitude, point.longitude);
        mapRef.current = new maps.Map(mapElementRef.current, {
          center: position,
          zoom: 16,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.TOP_RIGHT,
            style: maps.ZoomControlStyle.SMALL,
          },
        });
        markerRef.current = new maps.Marker({ map: mapRef.current, position });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

    return () => {
      disposed = true;
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [clientId, point?.latitude, point?.longitude]);

  if (!point) {
    return (
      <div className="desktop-meeting-location-map is-empty">
        <MapPin size={24} />
        <span>지도 좌표가 없어 주소 정보만 표시합니다.</span>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="desktop-meeting-location-map is-empty">
        <Map size={24} />
        <span>네이버 지도 클라이언트 키를 확인해주세요.</span>
      </div>
    );
  }

  return (
    <div className="desktop-meeting-location-map" ref={mapElementRef}>
      {status === "loading" && <span>지도를 불러오는 중입니다.</span>}
      {status === "error" && <span>지도를 불러오지 못했습니다.</span>}
    </div>
  );
}

function MeetingDirections({ meeting }) {
  const [originKeyword, setOriginKeyword] = useState("");
  const [originResults, setOriginResults] = useState([]);
  const [originLoading, setOriginLoading] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [message, setMessage] = useState("");
  const destinationPoint = toMapPoint(meeting);

  useEffect(() => {
    const keyword = originKeyword.trim();
    if (!keyword || selectedOrigin?.address === keyword) {
      setOriginResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setOriginLoading(true);
      locationApi.searchPlaces({ keyword, size: 6 })
        .then((data) => setOriginResults(data.items || []))
        .catch(() => setOriginResults([]))
        .finally(() => setOriginLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [originKeyword, selectedOrigin?.address]);

  const selectOrigin = (place) => {
    const title = (place.title || place.address || "").replace(/<[^>]+>/g, "");
    const address = place.address || place.road_address || title;
    setSelectedOrigin({ ...place, title, address });
    setOriginKeyword(address);
    setOriginResults([]);
    setMessage("");
  };

  const openFromSelectedOrigin = () => {
    if (!destinationPoint) {
      setMessage("목적지 좌표가 없어 네이버 지도에서 장소 검색으로 이동합니다.");
      openNaverDirections({ destination: meeting });
      return;
    }
    if (!selectedOrigin) {
      setMessage("출발지를 검색해서 선택해주세요.");
      return;
    }
    openNaverDirections({ origin: selectedOrigin, destination: meeting });
  };

  const openFromMyLocation = () => {
    if (!destinationPoint) {
      setMessage("목적지 좌표가 없어 네이버 지도에서 장소 검색으로 이동합니다.");
      openNaverDirections({ destination: meeting });
      return;
    }
    if (!navigator.geolocation) {
      setMessage("브라우저에서 현재 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setMessage("현재 위치를 확인하고 있습니다.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMessage("");
        openNaverDirections({
          origin: {
            title: "내 위치",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          destination: meeting,
        });
      },
      () => setMessage("현재 위치 권한을 허용하거나 출발지를 직접 검색해주세요."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  return (
    <div className="desktop-meeting-directions">
      <div className="desktop-meeting-directions__actions">
        <button type="button" onClick={openFromMyLocation}>
          <LocateFixed size={16} /> 내 위치에서 길찾기
        </button>
        <button type="button" onClick={openFromSelectedOrigin}>
          <Navigation size={16} /> 선택 출발지로 길찾기
        </button>
      </div>

      <label className="desktop-meeting-directions__search">
        <Search size={17} />
        <input
          value={originKeyword}
          placeholder="출발지 주소나 장소명을 검색하세요"
          onChange={(event) => {
            setSelectedOrigin(null);
            setOriginKeyword(event.target.value);
          }}
        />
      </label>

      {(originLoading || originResults.length > 0) && (
        <div className="desktop-meeting-directions__results">
          {originLoading ? (
            <span>출발지를 검색 중입니다.</span>
          ) : (
            originResults.map((place, index) => (
              <button type="button" key={`${place.title}-${index}`} onClick={() => selectOrigin(place)}>
                <MapPin size={16} />
                <strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong>
                <small>{place.address || place.road_address}</small>
              </button>
            ))
          )}
        </div>
      )}

      {selectedOrigin && (
        <div className="desktop-meeting-directions__selected">
          <Route size={16} />
          <span><strong>{selectedOrigin.title || "선택한 출발지"}</strong>{selectedOrigin.address}</span>
        </div>
      )}

      {message && <p>{message}</p>}
    </div>
  );
}

function getSportPictogram(meeting) {
  const value = `${meeting.sport?.name || ""} ${meeting.sport?.category?.name || ""}`;
  if (/자전거/.test(value)) return Bike;
  if (/등산|트레킹|야외/.test(value)) return Mountain;
  if (/러닝|산책/.test(value)) return Footprints;
  if (/헬스|크로스핏|클라이밍|요가|필라테스|피트니스/.test(value)) return Dumbbell;
  if (/축구|풋살|농구|배구|야구|족구|볼링|당구|골프|수영/.test(value)) return Trophy;
  if (/배드민턴|탁구|테니스|스쿼시/.test(value)) return CircleDot;
  return Trophy;
}

function SportFallbackHero({ meeting }) {
  const Icon = getSportPictogram(meeting);
  return (
    <div className="desktop-meeting-detail__pictogram">
      <Icon size={72} strokeWidth={1.8} />
      <span>{meeting.sport?.name || "SportsMate"}</span>
    </div>
  );
}

function DesktopMeetingDetail() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mapClientId, setMapClientId] = useState("");
  const [hostProfileOpen, setHostProfileOpen] = useState(false);
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  if (detail.loading) return <LoadingCards count={3} />;
  if (detail.error || !detail.data?.meeting) {
    return (
      <EmptyState
        title="모임을 찾을 수 없습니다."
        description="삭제되었거나 접근할 수 없는 모임입니다."
        actionLabel="모임 게시판"
        actionTo="/meetings"
      />
    );
  }

  const meeting = detail.data.meeting;
  const myParticipant = meeting.my_participant;
  const isHost = user?.id === meeting.host?.id || myParticipant?.role === "host";
  const isClosed = meeting.status !== "open";
  const isFull = Number(meeting.current_participants || 0) >= Number(meeting.max_participants || 0);
  const hasApplied = Boolean(myParticipant && myParticipant.role !== "host" && myParticipant.status !== "cancelled");
  const canJoin = !isHost && !hasApplied && !isClosed && !isFull && !joining;
  const chatRoomId = meeting.chat_room_id;

  const joinMeeting = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }

    setJoining(true);
    setMessage({ text: "", tone: "notice" });
    try {
      await meetingApi.join(meeting.id, { join_message: "참여 신청합니다." });
      setMessage({
        text: "참가 신청이 접수됐습니다. 방장 승인 후 참여가 확정됩니다.",
        tone: "notice"
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "참가 신청을 처리하지 못했습니다.", tone: "error" });
    } finally {
      setJoining(false);
    }
  };

  const statusLabel = getStatusLabel(meeting.status);
  const participantLabel = getParticipantLabel(myParticipant);
  const actionLabel = getActionLabel({ joining, isClosed, isFull, isHost, myParticipant });
  const hostSummary = meeting.host_summary || {};

  return (
    <div className="desktop-meeting-detail">
      <div className="screen-title desktop-meeting-detail__title">
        <div>
          <span>모임 게시판</span>
          <h1>{meeting.title}</h1>
          <p>{meeting.location_name || meeting.address}</p>
        </div>
        <Link className="ghost-btn" to="/meetings">목록으로</Link>
      </div>

      <div className="desktop-meeting-detail__grid">
        <main className="desktop-meeting-detail__main">
          <section className="desktop-meeting-detail__hero" style={meeting.cover_image_url ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.66)), url(${meeting.cover_image_url})` } : undefined}>
            {!meeting.cover_image_url && <SportFallbackHero meeting={meeting} />}
          </section>

          <section className="desktop-section desktop-meeting-detail__body">
            <div className="desktop-section__head">
              <h2>상세 내용</h2>
              <span>{meeting.sport?.name || "종목 미정"} · {formatMeetingType(meeting.meeting_type)}</span>
            </div>
            <p>{meeting.description || "등록된 모임 설명이 없습니다."}</p>
            <div className="desktop-meeting-detail__chips">
              <span className={`desktop-meeting-status ${meeting.status === "open" ? "is-open" : "is-closed"}`}>{statusLabel}</span>
              <span>방장 승인 필요</span>
              {participantLabel && <span>{participantLabel}</span>}
            </div>
          </section>

          <section className="desktop-section desktop-meeting-detail__map">
            <div className="desktop-section__head">
              <h2>모임 장소</h2>
              <span>{meeting.address || "주소 미정"}</span>
            </div>
            <div className="desktop-meeting-location-card">
              <div className="desktop-meeting-location-card__summary">
                <span><MapPin size={18} /></span>
                <div>
                  <strong>{meeting.location_name || "장소 미정"}</strong>
                  <small>{meeting.address || "주소 정보가 없습니다."}</small>
                </div>
              </div>
              <MeetingLocationMap clientId={mapClientId} meeting={meeting} />
              <MeetingDirections meeting={meeting} />
            </div>
          </section>
        </main>

        <aside className="desktop-meeting-detail__side">
          <section className="desktop-section desktop-meeting-detail__panel">
            <button className="desktop-meeting-detail__host" type="button" onClick={() => setHostProfileOpen((open) => !open)} aria-expanded={hostProfileOpen}>
              <span><UserRound size={22} /></span>
              <div>
                <strong>{meeting.host?.nickname || meeting.host?.name || "방장"}</strong>
                <small>모임 방장 · 프로필 보기</small>
              </div>
            </button>

            {hostProfileOpen && (
              <div className="desktop-meeting-detail__host-profile">
                <div className="desktop-meeting-detail__host-score">
                  <Star size={18} />
                  <strong>{Number(hostSummary.rating_average || 0).toFixed(1)}</strong>
                  <span>/ 5.0</span>
                </div>
                <dl>
                  <div><dt>개설 모임</dt><dd>{hostSummary.hosted_count || 0}개</dd></div>
                  <div><dt>진행중</dt><dd>{hostSummary.active_hosted_count || 0}개</dd></div>
                  <div><dt>마감 모임</dt><dd>{hostSummary.completed_hosted_count || 0}개</dd></div>
                  <div><dt>후기</dt><dd>{hostSummary.review_count || 0}개</dd></div>
                </dl>
                <p>{hostSummary.bio || "아직 소개글이 등록되지 않았습니다."}</p>
                <div className="desktop-meeting-detail__host-tags">
                  {hostSummary.region && <span>{hostSummary.region}</span>}
                  {hostSummary.exercise_level && <span>{hostSummary.exercise_level}</span>}
                  {hostSummary.preferred_sports && <span>{hostSummary.preferred_sports}</span>}
                </div>
              </div>
            )}

            <dl className="desktop-meeting-detail__info">
              <div><CalendarClock size={18} /><span>{formatDateTime(meeting.start_at)}</span></div>
              <div><MapPin size={18} /><span>{meeting.location_name || "장소 미정"}</span></div>
              <div><UsersRound size={18} /><span>{meeting.current_participants}/{meeting.max_participants}명</span></div>
              <div><Eye size={18} /><span>조회 {meeting.view_count || 0}</span></div>
              <div><ShieldCheck size={18} /><span>승인제 모임</span></div>
            </dl>

            {message.text && <p className={`desktop-meeting-detail__message is-${message.tone}`}>{message.text}</p>}

            {isHost ? (
              <Link className="primary-btn full" to={`/host/meetings/${meeting.id}`}>방장 관리</Link>
            ) : (
              <button className="primary-btn full" type="button" onClick={joinMeeting} disabled={!canJoin}>
                {actionLabel}
              </button>
            )}

            {myParticipant?.status === "approved" && (
              <Link className="ghost-btn full" to={chatRoomId ? `/chats/${chatRoomId}` : "/chats"}>
                <MessageSquareText size={16} /> 채팅방 보기
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  if (status === "open") return "모집중";
  if (status === "full") return "모집 마감";
  if (status === "closed") return "기간 마감";
  if (status === "cancelled") return "취소됨";
  return "마감";
}

function getParticipantLabel(participant) {
  if (!participant) return "";
  if (participant.role === "host") return "내가 만든 모임";
  if (participant.status === "pending") return "신청 대기중";
  if (participant.status === "approved") return "참여중";
  if (participant.status === "rejected") return "신청 거절됨";
  if (participant.status === "cancelled") return "신청 취소됨";
  return "";
}

function getActionLabel({ joining, isClosed, isFull, isHost, myParticipant }) {
  if (joining) return "신청 중...";
  if (isHost) return "방장 관리";
  if (myParticipant?.status === "pending") return "승인 대기중";
  if (myParticipant?.status === "approved") return "참여중";
  if (myParticipant?.status === "rejected") return "신청 거절됨";
  if (isFull) return "모집 마감";
  if (isClosed) return "기간 마감";
  return "참가 신청";
}

export default DesktopMeetingDetail;
