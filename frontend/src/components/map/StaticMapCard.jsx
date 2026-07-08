import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Navigation, Search, Route } from "lucide-react";
import { locationApi } from "../../api/locationApi";

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

function StaticMapCard({ meeting }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapClientId, setMapClientId] = useState("");
  const [mapStatus, setMapStatus] = useState("idle");

  const [originKeyword, setOriginKeyword] = useState("");
  const [originResults, setOriginResults] = useState([]);
  const [originLoading, setOriginLoading] = useState(false);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [directionsMessage, setDirectionsMessage] = useState("");

  const latitude = Number(meeting?.latitude);
  const longitude = Number(meeting?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => {
        setMapClientId(data.naver_dynamic_map_client_id || "");
      })
      .catch(() => {
        setMapClientId("");
      });
  }, []);

  useEffect(() => {
    if (!mapClientId || !hasCoordinates) return;
    let disposed = false;
    setMapStatus("loading");

    loadNaverMapScript(mapClientId)
      .then((maps) => {
        if (disposed || !mapElementRef.current) return;
        const position = new maps.LatLng(latitude, longitude);
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
        markerRef.current = new maps.Marker({ 
          map: mapRef.current, 
          position 
        });
        setMapStatus("ready");
      })
      .catch(() => {
        setMapStatus("error");
      });

    return () => {
      disposed = true;
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [mapClientId, latitude, longitude, hasCoordinates]);

  // Search logic
  useEffect(() => {
    const keyword = originKeyword.trim();
    if (!keyword || selectedOrigin?.address === keyword) {
      setOriginResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setOriginLoading(true);
      locationApi.searchPlaces({ keyword: keyword, size: 6 })
        .then((data) => setOriginResults(data.items || []))
        .catch((error) => {
          console.error('Location search error:', error);
          setOriginResults([]);
        })
        .finally(() => setOriginLoading(false));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [originKeyword, selectedOrigin?.address]);

  const selectOrigin = (place) => {
    const title = (place.title || place.address || "").replace(/<[^>]+>/g, "").trim();
    const address = place.address || place.road_address || title;
    setSelectedOrigin({ ...place, title, address });
    setOriginKeyword(address);
    setOriginResults([]);
    setDirectionsMessage("");
  };

  const toMapPoint = (place) => {
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  };

  const openNaverDirections = ({ origin, destination }) => {
    const keyword = encodeURIComponent(destination.location_name || destination.address || "");
    const destPoint = toMapPoint(destination);
    if (!destPoint || !origin) {
      window.open(`https://map.naver.com/p/search/${keyword}`, "_blank", "noopener,noreferrer");
      return;
    }
    const originPoint = toMapPoint(origin);
    const originPart = originPoint ? `s:${originPoint.longitude},${originPoint.latitude},${encodeURIComponent(origin.title || origin.address || "")}` : "";
    const destinationPart = `e:${destPoint.longitude},${destPoint.latitude},${keyword}`;
    window.open(`https://map.naver.com/p/directions/${originPart}/${destinationPart}/-/transit`, "_blank", "noopener,noreferrer");
  };

  const openFromMyLocation = () => {
    if (!hasCoordinates) {
      setDirectionsMessage("목적지 좌표가 없어 네이버 지도에서 장소 검색으로 이동합니다.");
      openNaverDirections({ destination: meeting });
      return;
    }
    if (!navigator.geolocation) {
      setDirectionsMessage("브라우저에서 현재 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setDirectionsMessage("현재 위치를 확인하고 있습니다...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDirectionsMessage("");
        openNaverDirections({
          origin: {
            title: "내 위치",
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          destination: meeting,
        });
      },
      () => setDirectionsMessage("현재 위치 권한을 허용하거나 출발지를 직접 검색해주세요."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const openFromSelectedOrigin = () => {
    if (!hasCoordinates) {
      setDirectionsMessage("목적지 좌표가 없어 네이버 지도에서 장소 검색으로 이동합니다.");
      openNaverDirections({ destination: meeting });
      return;
    }
    if (!selectedOrigin) {
      setDirectionsMessage("출발지를 검색해서 선택해주세요.");
      return;
    }
    openNaverDirections({ origin: selectedOrigin, destination: meeting });
  };

  return (
    <section className="map-card" style={{ display: "grid", gap: "10px" }}>
      {hasCoordinates && mapClientId ? (
        <div 
          className="map-card__canvas" 
          ref={mapElementRef}
          style={{ position: "relative", overflow: "hidden" }}
        >
          {mapStatus === "loading" && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 5, fontSize: "12px", color: "#64748b" }}>
              지도를 불러오는 중입니다...
            </div>
          )}
          {mapStatus === "error" && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 5, fontSize: "12px", color: "#ef4444" }}>
              지도를 불러오지 못했습니다.
            </div>
          )}
        </div>
      ) : (
        <div className="map-card__canvas">
          <MapPin size={32} />
          <span>{meeting.location_name}</span>
        </div>
      )}
      <p style={{ margin: 0, fontSize: "13px", color: "#334155", fontWeight: "800" }}>{meeting.address}</p>

      {/* 모바일 길찾기 UI 섹션 */}
      {hasCoordinates && (
        <div 
          style={{ 
            borderTop: "1px solid #eff6ff", 
            marginTop: "6px", 
            paddingTop: "12px", 
            display: "grid", 
            gap: "10px" 
          }}
        >
          {/* 길찾기 실행 버튼 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button 
              type="button" 
              onClick={openFromMyLocation}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #c7d2fe",
                background: "#eff6ff",
                color: "#4f46e5",
                fontSize: "11px",
                fontWeight: "900",
                cursor: "pointer"
              }}
            >
              <LocateFixed size={13} />
              내 위치에서 길찾기
            </button>
            <button 
              type="button" 
              onClick={openFromSelectedOrigin}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid #c7d2fe",
                background: "#4f46e5",
                color: "#fff",
                fontSize: "11px",
                fontWeight: "900",
                cursor: "pointer"
              }}
            >
              <Navigation size={13} />
              출발지로 길찾기
            </button>
          </div>

          {/* 출발지 입력창 */}
          <div 
            style={{ 
              position: "relative",
              display: "flex", 
              alignItems: "center", 
              background: "#f8fafc", 
              border: "1px solid #e2e8f0", 
              borderRadius: "8px", 
              padding: "2px 8px" 
            }}
          >
            <Search size={14} style={{ color: "#94a3b8", marginRight: "6px" }} />
            <input
              type="text"
              value={originKeyword}
              placeholder="출발지 주소나 장소명을 검색하세요"
              onChange={(event) => {
                setSelectedOrigin(null);
                setOriginKeyword(event.target.value);
              }}
              style={{
                flex: 1,
                border: 0,
                background: "transparent",
                padding: "6px 0",
                fontSize: "12px",
                color: "#334155",
                outline: "none"
              }}
            />
          </div>

          {/* 검색 안내 메시지 */}
          {directionsMessage && (
            <p style={{ margin: 0, fontSize: "11px", color: "#4f46e5", fontWeight: "800" }}>
              {directionsMessage}
            </p>
          )}

          {/* 검색 자동완성 리스트 */}
          {(originLoading || originResults.length > 0) && (
            <div 
              style={{ 
                background: "#fff", 
                border: "1px solid #e2e8f0", 
                borderRadius: "8px", 
                maxHeight: "150px", 
                overflowY: "auto",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
              }}
            >
              {originLoading ? (
                <div style={{ padding: "8px 12px", fontSize: "11px", color: "#94a3b8" }}>검색 중...</div>
              ) : (
                originResults.map((place, index) => (
                  <button 
                    type="button" 
                    key={`${place.title}-${index}`} 
                    onClick={() => selectOrigin(place)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: 0,
                      borderBottom: index < originResults.length - 1 ? "1px solid #f1f5f9" : 0,
                      background: "none",
                      display: "grid",
                      gap: "2px",
                      cursor: "pointer"
                    }}
                  >
                    <strong style={{ fontSize: "11px", color: "#334155" }}>
                      {(place.title || place.address || "").replace(/<[^>]+>/g, "")}
                    </strong>
                    <small style={{ fontSize: "9px", color: "#64748b" }}>
                      {place.address || place.road_address}
                    </small>
                  </button>
                ))
              )}
            </div>
          )}

          {/* 선택된 출발지 배지 */}
          {selectedOrigin && (
            <div 
              style={{ 
                background: "#f0fdf4", 
                border: "1px solid #bbf7d0", 
                borderRadius: "8px", 
                padding: "8px", 
                display: "flex", 
                alignItems: "center", 
                gap: "6px" 
              }}
            >
              <Route size={14} style={{ color: "#16a34a" }} />
              <span style={{ fontSize: "11px", color: "#14532d", fontWeight: "800" }}>
                출발지: {selectedOrigin.title}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default StaticMapCard;
