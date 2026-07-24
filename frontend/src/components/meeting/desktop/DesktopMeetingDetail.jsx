import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bike, CalendarClock, CircleAlert, CircleDot, Dumbbell, Eye, Footprints, LocateFixed, Map, MapPin, MessageSquareText, Mountain, Navigation, Pin, Route, Search, Star, Trophy, UserRound, UsersRound, X } from "lucide-react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { locationApi } from "../../../api/locationApi";
import { reportApi } from "../../../api/reportApi";
import { weatherApi } from "../../../api/weatherApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { formatDateTime, formatMeetingType, formatRegularMeetingSchedule } from "../../../utils/formatters";
import { getMeetingCoverImage } from "../../../utils/sportThumbnails";
import DesktopWeatherCard from "./DesktopWeatherCard.jsx";

const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";
const JOIN_MESSAGE_MAX_LENGTH = 200;

function getDisplayStartAt(meeting) {
  return meeting?.meeting_type === "regular" ? meeting?.next_session?.start_at || meeting?.start_at : meeting?.start_at;
}

function getNextSessionLabel(meeting) {
  if (meeting?.meeting_type !== "regular") return formatDateTime(getDisplayStartAt(meeting));
  return meeting?.next_session?.start_at ? formatDateTime(meeting.next_session.start_at) : "예정된 회차 없음";
}

function parseMeetingDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function oneTimeOperationEndAt(meeting) {
  const explicitEnd = parseMeetingDateTime(meeting?.end_at);
  if (explicitEnd) return explicitEnd;
  const fallbackEnd = parseMeetingDateTime(meeting?.start_at);
  if (!fallbackEnd) return null;
  fallbackEnd.setHours(23, 59, 59, 999);
  return fallbackEnd;
}

function isMeetingOperationEnded(meeting) {
  if (!meeting) return false;
  if (meeting.meeting_type === "regular") {
    if (meeting.next_session?.start_at) return false;
    const endAt = parseMeetingDateTime(meeting.end_at);
    return Boolean(endAt && Date.now() >= endAt.getTime());
  }
  const endAt = oneTimeOperationEndAt(meeting);
  return Boolean(endAt && Date.now() >= endAt.getTime());
}

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
        window.setTimeout(() => {
          if (!disposed && mapRef.current) {
            maps.Event.trigger(mapRef.current, "resize");
            mapRef.current.setCenter(position);
          }
        }, 80);
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
    <div className="desktop-meeting-location-map is-live" ref={mapElementRef}>
      {status === "loading" && <span>지도를 불러오는 중입니다.</span>}
      {status === "error" && <span>지도를 불러오지 못했습니다.</span>}
    </div>
  );
}

function MeetingDirections({ meeting }) {
  const originSearchRequestRef = useRef(0);
  const [originKeyword, setOriginKeyword] = useState("");
  const [originResults, setOriginResults] = useState([]);
  const [originLoading, setOriginLoading] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [message, setMessage] = useState("");
  const destinationPoint = toMapPoint(meeting);

  useEffect(() => {
    const keyword = originKeyword.trim();
    const requestId = originSearchRequestRef.current + 1;
    originSearchRequestRef.current = requestId;

    if (!keyword || selectedOrigin?.address === keyword) {
      setOriginLoading(false);
      setOriginResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setOriginLoading(true);
      locationApi.searchPlaces({ keyword, size: 6 })
        .then((data) => {
          if (originSearchRequestRef.current === requestId) {
            setOriginResults(data.items || []);
          }
        })
        .catch(() => {
          if (originSearchRequestRef.current === requestId) {
            setOriginResults([]);
          }
        })
        .finally(() => {
          if (originSearchRequestRef.current === requestId) {
            setOriginLoading(false);
          }
        });
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

      <div className="desktop-meeting-directions__search-wrap">
        <label className="desktop-meeting-directions__search">
          <Search size={17} />
          <input
            value={originKeyword}
            placeholder="출발지 주소나 장소명을 검색하세요"
            autoComplete="off"
            aria-expanded={originLoading || originResults.length > 0}
            onChange={(event) => {
              setSelectedOrigin(null);
              setOriginKeyword(event.target.value);
            }}
          />
        </label>

        {(originLoading || originResults.length > 0) && (
          <div className="desktop-meeting-directions__results">
            {originLoading && <span>출발지를 검색 중입니다.</span>}
            {originResults.map((place, index) => (
              <button type="button" key={`${place.title}-${index}`} onClick={() => selectOrigin(place)}>
                <MapPin size={16} />
                <strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong>
                <small>{place.address || place.road_address}</small>
              </button>
            ))}
          </div>
        )}
      </div>

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

function DesktopMeetingDetail({ recordedViewCount = null }) {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [mapClientId, setMapClientId] = useState("");
  const [hostProfileOpen, setHostProfileOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinError, setJoinError] = useState("");
  const [participationConfirm, setParticipationConfirm] = useState(null);
  const [participationError, setParticipationError] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState({ text: "", tone: "notice" });
  const joinTextareaRef = useRef(null);
  const participationCancelButtonRef = useRef(null);
  const [weather, setWeather] = useState({ loading: true, forecast: null });
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  useEffect(() => {
    if (!isJoinModalOpen) return undefined;
    const timer = window.setTimeout(() => joinTextareaRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !joining) {
        setIsJoinModalOpen(false);
        setJoinMessage("");
        setJoinError("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isJoinModalOpen, joining]);

  useEffect(() => {
    if (!participationConfirm) return undefined;
    const timer = window.setTimeout(() => participationCancelButtonRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !cancelling) {
        setParticipationConfirm(null);
        setParticipationError("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [participationConfirm, cancelling]);

  useEffect(() => {
    let active = true;
    const meeting = detail.data?.meeting;
    const at = getDisplayStartAt(meeting);
    const latitude = Number(meeting?.latitude);
    const longitude = Number(meeting?.longitude);
    if (!meeting || !at || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setWeather({
        loading: false,
        forecast: meeting ? { available: false, message: "일정 또는 장소 좌표가 없어 예보를 확인할 수 없습니다." } : null,
      });
      return () => { active = false; };
    }
    setWeather({ loading: true, forecast: null });
    weatherApi.forecast({ latitude, longitude, at, address: meeting.address || meeting.location_name || "" })
      .then((data) => {
        if (active) setWeather({ loading: false, forecast: data.forecast });
      })
      .catch((error) => {
        if (!active) return;
        setWeather({
          loading: false,
          forecast: { available: false, message: error.response?.data?.message || "예보를 불러오지 못했습니다." },
        });
      });
    return () => { active = false; };
  }, [detail.data?.meeting, meetingId, refreshKey]);

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

  const submitReport = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }

    const reasonDetail = reportReason.trim();
    if (reasonDetail.length < 5) {
      setReportFeedback({ text: "신고 사유를 5자 이상 자세히 입력해 주세요.", tone: "error" });
      return;
    }

    setReporting(true);
    setReportFeedback({ text: "", tone: "notice" });
    try {
      await reportApi.create({
        target_type: "meeting",
        target_id: meeting.id,
        reason: "other",
        reason_detail: reasonDetail,
        context: JSON.stringify({
          meeting_id: meeting.id,
          meeting_title: meeting.title,
          source: "desktop_meeting_detail"
        })
      });
      setReportReason("");
      setReportFeedback({ text: "신고가 접수되었습니다. 관리자가 확인 후 처리합니다.", tone: "success" });
    } catch (error) {
      setReportFeedback({ text: error.response?.data?.message || "신고를 접수하지 못했습니다.", tone: "error" });
    } finally {
      setReporting(false);
    }
  };
  const myParticipant = meeting.my_participant;
  const isHost = user?.id === meeting.host?.id || myParticipant?.role === "host";
  const isClosed = meeting.status !== "open";
  const isFull = Number(meeting.current_participants || 0) >= Number(meeting.max_participants || 0);
  const isOperationEnded = isMeetingOperationEnded(meeting);
  const isLeaveBlockedStatus = meeting.status === "cancelled" || meeting.status === "suspended";
  const hasApplied = Boolean(myParticipant && myParticipant.role !== "host" && myParticipant.status !== "cancelled");
  const isMutatingParticipation = joining || cancelling;
  const canCancelApplication = myParticipant?.status === "pending" && !isMutatingParticipation;
  const canLeaveMeeting = myParticipant?.status === "approved" && !isHost && !isOperationEnded && !isLeaveBlockedStatus && !isMutatingParticipation;
  const canJoin = !isHost && !hasApplied && !isClosed && !isFull && !joining;
  const chatRoomId = meeting.chat_room_id;

  const closeJoinModal = () => {
    if (joining) return;
    setIsJoinModalOpen(false);
    setJoinMessage("");
    setJoinError("");
  };

  const openJoinModal = () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    if (!canJoin) return;
    setJoinMessage("");
    setJoinError("");
    setIsJoinModalOpen(true);
  };

  const joinMeeting = async (event) => {
    event?.preventDefault();
    if (joining) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }

    const trimmedMessage = joinMessage.trim();
    if (trimmedMessage.length > JOIN_MESSAGE_MAX_LENGTH) {
      setJoinError(`참가 메시지는 ${JOIN_MESSAGE_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }

    setJoining(true);
    setMessage({ text: "", tone: "notice" });
    setJoinError("");
    try {
      await meetingApi.join(meeting.id, { join_message: trimmedMessage });
      setIsJoinModalOpen(false);
      setJoinMessage("");
      setMessage({
        text: "참여 신청이 접수됐습니다. 방장 승인 후 참여가 확정됩니다.",
        tone: "notice"
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setJoinError(error.response?.data?.message || "참여 신청을 처리하지 못했습니다.");
    } finally {
      setJoining(false);
    }
  };

  const closeParticipationConfirm = () => {
    if (cancelling) return;
    setParticipationConfirm(null);
    setParticipationError("");
  };

  const openParticipationConfirm = (type) => {
    if (isMutatingParticipation) return;
    if (type === "cancel" && myParticipant?.status !== "pending") return;
    if (type === "leave" && !canLeaveMeeting) return;
    setParticipationError("");
    setParticipationConfirm(type);
  };

  const confirmParticipationChange = async (event) => {
    event?.preventDefault();
    if (!participationConfirm || cancelling) return;
    const actionType = participationConfirm;
    setCancelling(true);
    setMessage({ text: "", tone: "notice" });
    setParticipationError("");
    try {
      await meetingApi.cancelJoin(meeting.id);
      setParticipationConfirm(null);
      setMessage({
        text: actionType === "leave" ? "모임에서 나왔습니다." : "참여 신청을 취소했습니다.",
        tone: "notice"
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setParticipationError(
        error.response?.data?.message
          || (actionType === "leave" ? "모임 나가기를 처리하지 못했습니다." : "신청 취소를 처리하지 못했습니다.")
      );
    } finally {
      setCancelling(false);
    }
  };

  const displayStatus = isOperationEnded ? "closed" : meeting.status;
  const statusLabel = isOperationEnded ? "운영종료" : getStatusLabel(meeting.status);
  const participantLabel = getParticipantLabel(myParticipant);
  const actionLabel = getActionLabel({
    joining,
    cancelling,
    isClosed,
    isFull,
    isHost,
    isOperationEnded,
    status: meeting.status,
    myParticipant
  });
  const actionHandler = canCancelApplication
    ? () => openParticipationConfirm("cancel")
    : canLeaveMeeting
      ? () => openParticipationConfirm("leave")
      : openJoinModal;
  const actionDisabled = canCancelApplication || canLeaveMeeting ? false : !canJoin;
  const hostSummary = meeting.host_summary || {};
  const coverImage = getMeetingCoverImage(meeting);

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
          <section className="desktop-meeting-detail__hero" style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}>
            {!coverImage && <SportFallbackHero meeting={meeting} />}
          </section>

          <section className="desktop-section desktop-meeting-detail__body">
            <div className="desktop-section__head">
              <h2>상세 내용</h2>
              <span>{meeting.sport?.name || "종목 미정"} · {formatMeetingType(meeting.meeting_type)}</span>
            </div>
            <p>{meeting.description || "등록된 모임 설명이 없습니다."}</p>
            <div className="desktop-meeting-detail__chips">
              <span className={`desktop-meeting-status ${getStatusClass(displayStatus)}`}>{statusLabel}</span>
              <span className="desktop-meeting-detail__approval-chip">방장 승인 필요</span>
              {participantLabel && <span className="desktop-meeting-relation-badge">{participantLabel}</span>}
            </div>
          </section>

          <section className="desktop-section desktop-meeting-detail__weather">
            <div className="desktop-section__head">
              <h2>모임 날씨</h2>
              <span>{meeting.meeting_type === "regular" ? "다음 회차 기준" : formatDateTime(getDisplayStartAt(meeting))}</span>
            </div>
            <DesktopWeatherCard forecast={weather.forecast} loading={weather.loading} />
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

          <section className="desktop-section desktop-meeting-detail__report">
            <div className="desktop-section__head">
              <div>
                <h2>모임 신고</h2>
                <p>운영 정책에 어긋나는 모임이라면 관리자에게 알려주세요.</p>
              </div>
            </div>
            <form onSubmit={submitReport}>
              <label htmlFor="desktop-meeting-report-reason">신고 사유</label>
              <textarea
                id="desktop-meeting-report-reason"
                required
                minLength={5}
                maxLength={2000}
                rows={5}
                value={reportReason}
                onChange={(event) => {
                  setReportReason(event.target.value);
                  if (reportFeedback.text) setReportFeedback({ text: "", tone: "notice" });
                }}
                placeholder="신고 사유를 자세히 입력해 주세요. (최소 5자)"
                disabled={reporting}
              />
              <div className="desktop-meeting-detail__report-meta">
                <small>입력한 내용은 모임 운영 확인을 위해 관리자에게 전달됩니다.</small>
                <span>{reportReason.length} / 2000</span>
              </div>
              {reportFeedback.text ? (
                <p className={`desktop-meeting-detail__report-feedback is-${reportFeedback.tone}`} role="status">
                  {reportFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={reporting || reportReason.trim().length < 5}>
                {reporting ? "접수 중..." : "신고 접수"}
              </button>
            </form>
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
              {meeting.meeting_type === "regular" ? (
                <>
                  <div>
                    <Pin size={18} />
                    <span>{formatRegularMeetingSchedule(meeting)}</span>
                  </div>
                  <div className="desktop-meeting-detail__info-row--stacked">
                    <CalendarClock size={18} />
                    <span><small>다음 일정</small>{getNextSessionLabel(meeting)}</span>
                  </div>
                </>
              ) : (
                <div><CalendarClock size={18} /><span>{formatDateTime(getDisplayStartAt(meeting))}</span></div>
              )}
              <div><MapPin size={18} /><span>{meeting.location_name || "장소 미정"}</span></div>
              <div><UsersRound size={18} /><span>{meeting.current_participants}/{meeting.max_participants}명</span></div>
              <div><Eye size={18} /><span>조회 {Math.max(Number(meeting.view_count || 0), Number(recordedViewCount || 0))}</span></div>
            </dl>

            {message.text && <p className={`desktop-meeting-detail__message is-${message.tone}`}>{message.text}</p>}

            {isHost ? (
              <Link className="primary-btn full" to={`/host/meetings/${meeting.id}`}>방장 관리</Link>
            ) : (
              <button className="primary-btn full" type="button" onClick={actionHandler} disabled={actionDisabled}>
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

      {isJoinModalOpen && (
        <div className="desktop-meeting-join-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-meeting-join-title">
          <button className="desktop-meeting-join-modal__backdrop" type="button" onClick={closeJoinModal} aria-label="닫기" disabled={joining} />
          <form className="desktop-meeting-join-modal__panel" onSubmit={joinMeeting}>
            <div className="desktop-meeting-join-modal__head">
              <div>
                <h2 id="desktop-meeting-join-title">참여 신청</h2>
                <p>방장에게 전달할 메시지를 작성해 주세요.</p>
              </div>
              <button type="button" onClick={closeJoinModal} aria-label="닫기" disabled={joining}>
                <X size={18} />
              </button>
            </div>
            <label className="desktop-meeting-join-modal__field" htmlFor="desktop-meeting-join-message">
              <span>참가 메시지</span>
              <textarea
                id="desktop-meeting-join-message"
                ref={joinTextareaRef}
                rows={5}
                maxLength={JOIN_MESSAGE_MAX_LENGTH}
                value={joinMessage}
                onChange={(event) => {
                  setJoinMessage(event.target.value);
                  if (joinError) setJoinError("");
                }}
                placeholder="간단한 자기소개나 참가하고 싶은 이유를 적어 주세요."
                disabled={joining}
              />
            </label>
            <div className="desktop-meeting-join-modal__meta">
              <span>{joinMessage.length} / {JOIN_MESSAGE_MAX_LENGTH}</span>
            </div>
            {joinError && <p className="desktop-meeting-join-modal__error">{joinError}</p>}
            <div className="desktop-meeting-join-modal__actions">
              <button type="button" onClick={closeJoinModal} disabled={joining}>취소</button>
              <button type="submit" disabled={joining}>{joining ? "신청 중..." : "신청하기"}</button>
            </div>
          </form>
        </div>
      )}

      {participationConfirm && (
        <div className="desktop-participation-confirm" role="dialog" aria-modal="true" aria-labelledby="desktop-participation-confirm-title" aria-describedby="desktop-participation-confirm-description">
          <button className="desktop-participation-confirm__backdrop" type="button" onClick={closeParticipationConfirm} aria-label="확인창 닫기" disabled={cancelling} />
          <form className="desktop-participation-confirm__panel" onSubmit={confirmParticipationChange}>
            <span className="desktop-participation-confirm__icon" aria-hidden="true"><CircleAlert size={24} /></span>
            <div className="desktop-participation-confirm__copy">
              <h2 id="desktop-participation-confirm-title">
                {participationConfirm === "leave" ? "모임에서 나갈까요?" : "참여 신청을 취소할까요?"}
              </h2>
              <p id="desktop-participation-confirm-description">
                {participationConfirm === "leave"
                  ? "나가면 참가자 목록과 모임 채팅에서 제외됩니다. 다시 참여하려면 참여 신청과 방장 승인이 필요합니다."
                  : "취소 후에도 모집 중인 모임에는 다시 참여 신청할 수 있습니다."}
              </p>
            </div>
            {participationError && <p className="desktop-participation-confirm__error">{participationError}</p>}
            <div className="desktop-participation-confirm__actions">
              <button ref={participationCancelButtonRef} type="button" onClick={closeParticipationConfirm} disabled={cancelling}>
                {participationConfirm === "leave" ? "계속 참여하기" : "신청 유지하기"}
              </button>
              <button className="is-danger" type="submit" disabled={cancelling}>
                {cancelling ? "처리 중..." : participationConfirm === "leave" ? "모임 나가기" : "신청 취소하기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function getStatusLabel(status) {
  if (status === "open") return "모집중";
  if (status === "full") return "모집마감";
  if (status === "closed") return "모집종료";
  if (status === "cancelled") return "취소됨";
  return "마감";
}

function getStatusClass(status) {
  if (status === "open") return "is-open";
  if (status === "full") return "is-full";
  return "is-closed";
}

function getParticipantLabel(participant) {
  if (!participant) return "";
  if (participant.role === "host") return "내가 관리하는 모임";
  if (participant.status === "pending") return "신청 대기중";
  if (participant.status === "approved") return "참여중";
  if (participant.status === "rejected") return "신청 거절됨";
  if (participant.status === "cancelled") return "신청 취소됨";
  return "";
}

function getActionLabel({ joining, cancelling, isClosed, isFull, isHost, isOperationEnded, status, myParticipant }) {
  if (joining) return "신청 중...";
  if (cancelling && myParticipant?.status === "approved") return "나가는 중...";
  if (cancelling) return "취소 중...";
  if (isHost) return "방장 관리";
  if (myParticipant?.status === "pending") return "신청 취소";
  if (myParticipant?.status === "approved") {
    if (status === "cancelled") return "취소됨";
    if (status === "suspended") return "운영중지";
    if (isOperationEnded) return "운영 종료";
    return "모임 나가기";
  }
  if (myParticipant?.status === "rejected") return "신청 거절됨";
  if (isFull) return "모집마감";
  if (isClosed) return "모집종료";
  return "참여 신청";
}

export default DesktopMeetingDetail;
