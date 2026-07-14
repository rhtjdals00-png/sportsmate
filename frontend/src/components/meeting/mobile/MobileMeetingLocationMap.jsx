import { useEffect, useRef, useState } from "react";
import { LocateFixed, Map, Navigation, Route, MapPin } from "lucide-react";
import { locationApi } from "../../../api/locationApi";

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

export default function MobileMeetingLocationMap({ meeting }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapClientId, setMapClientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const latitude = Number(meeting?.latitude);
  const longitude = Number(meeting?.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  useEffect(() => {
    if (!mapClientId || !containerRef.current) return;

    let isMounted = true;
    setLoading(true);

    loadNaverMapScript(mapClientId)
      .then((maps) => {
        if (!isMounted || !containerRef.current) return;

        const center = hasCoordinates 
          ? new maps.LatLng(latitude, longitude)
          : new maps.LatLng(DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude);

        if (!mapRef.current) {
          const mapOptions = {
            center,
            zoom: 15,
            minZoom: 10,
            maxZoom: 19,
            logoControl: false,
            mapDataControl: false,
            scaleControl: false,
            zoomControl: true,
            zoomControlOptions: {
              position: maps.Position.TOP_RIGHT,
              style: maps.ZoomControlStyle.SMALL,
            },
          };
          mapRef.current = new maps.Map(containerRef.current, mapOptions);
        } else {
          mapRef.current.setCenter(center);
        }

        if (hasCoordinates) {
          if (!markerRef.current) {
            markerRef.current = new maps.Marker({
              position: center,
              map: mapRef.current,
            });
          } else {
            markerRef.current.setPosition(center);
          }
        }
        
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "지도를 불러올 수 없습니다.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [mapClientId, latitude, longitude, hasCoordinates]);

  const openNaverDirections = () => {
    if (!hasCoordinates) return;
    const name = encodeURIComponent(meeting.location_name || meeting.address || "목적지");
    const url = `https://map.naver.com/v5/directions/-/name,${longitude},${latitude},${name}/-/transit?c=15,0,0,0,dh`;
    window.open(url, "_blank");
  };

  const openKakaoDirections = () => {
    if (!hasCoordinates) return;
    const name = encodeURIComponent(meeting.location_name || meeting.address || "목적지");
    const url = `https://map.kakao.com/link/to/${name},${latitude},${longitude}`;
    window.open(url, "_blank");
  };

  return (
    <section className="detail-card">
      <h2>모임 장소</h2>
      
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ width: "32px", height: "32px", background: "#eff6ff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", flexShrink: 0 }}>
          <MapPin size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <strong style={{ display: "block", fontSize: "14px", color: "#1e293b", marginBottom: "2px" }}>
            {meeting.location_name || "장소 미정"}
          </strong>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {meeting.address || "주소 정보가 없습니다."}
          </span>
        </div>
      </div>

      <div 
        ref={containerRef} 
        style={{ 
          position: "relative",
          zIndex: 0,
          width: "100%", 
          height: "180px", 
          backgroundColor: "#f1f5f9",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: "13px",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
      >
        {loading && !error && "지도를 불러오는 중입니다..."}
        {error && "지도를 렌더링하지 못했습니다."}
      </div>

      {hasCoordinates && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button 
            type="button" 
            onClick={openNaverDirections}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 0",
              background: "#03C75A",
              color: "#fff",
              border: 0,
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            <Navigation size={14} /> 네이버 지도로 길찾기
          </button>
          <button 
            type="button" 
            onClick={openKakaoDirections}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "10px 0",
              background: "#FEE500",
              color: "#000000",
              border: 0,
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            <Route size={14} /> 카카오맵으로 길찾기
          </button>
        </div>
      )}
    </section>
  );
}
