import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cloud, CloudRain, CloudSun, Droplets, LocateFixed, MapPin, Search, Snowflake, Sun, Wind } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { locationApi } from "../api/locationApi";
import { weatherApi } from "../api/weatherApi";
import { getWeatherFallbackLocation, requestCurrentPosition, saveWeatherLocation } from "../utils/weatherLocation";

function WeatherIcon({ condition, size = 30 }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={size} />;
  if (condition === "snow") return <Snowflake size={size} />;
  if (condition === "clear") return <Sun size={size} />;
  if (condition === "partly_cloudy") return <CloudSun size={size} />;
  return <Cloud size={size} />;
}

function displayHour(value) {
  const date = new Date(value);
  const hour = date.getHours();
  return hour === 0 ? "자정" : hour < 12 ? `오전 ${hour}시` : hour === 12 ? "오후 12시" : `오후 ${hour - 12}시`;
}

function displayDate(value, index) {
  if (index === 0) return "오늘";
  if (index === 1) return "내일";
  return new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00`));
}

export default function WeatherPage() {
  const { user } = useAuth();
  const [location, setLocation] = useState(() => getWeatherFallbackLocation(user));
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [extendedOpen, setExtendedOpen] = useState(false);
  const [extendedWeather, setExtendedWeather] = useState(null);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [extendedMessage, setExtendedMessage] = useState("");
  const searchRequestRef = useRef(0);
  const extendedRequestRef = useRef(0);

  const loadWeather = async (nextLocation, persist = true) => {
    setLoading(true);
    setMessage("");
    extendedRequestRef.current += 1;
    setExtendedOpen(false);
    setExtendedWeather(null);
    setExtendedLoading(false);
    setExtendedMessage("");
    setLocation(nextLocation);
    if (persist) saveWeatherLocation(nextLocation);
    try {
      const data = await weatherApi.daily({ latitude: nextLocation.latitude, longitude: nextLocation.longitude });
      setWeather(data.weather);
    } catch (error) {
      setWeather(null);
      setMessage(error.response?.data?.message || "날씨를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fallback = getWeatherFallbackLocation(user);
    loadWeather(fallback, false);
    if (fallback.source === "profile") {
      return () => { active = false; };
    }
    requestCurrentPosition()
      .then(async (current) => {
        if (!active) return;
        let label = "내 위치";
        let address = "";
        try {
          const data = await locationApi.reverseGeocode({ latitude: current.latitude, longitude: current.longitude });
          label = data.item?.address || data.item?.title || label;
          address = data.item?.address || data.item?.road_address || label;
        } catch {
          // 좌표만으로도 예보 조회는 가능하다.
        }
        if (active) loadWeather({ ...current, label, address });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [
    user?.id,
    user?.profile?.region,
    user?.profile?.region_latitude,
    user?.profile?.region_longitude,
    user?.profile?.region_2,
    user?.profile?.region_2_latitude,
    user?.profile?.region_2_longitude,
  ]);

  useEffect(() => {
    const value = keyword.trim();
    if (!value) {
      setResults([]);
      setSearching(false);
      return;
    }
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const timer = window.setTimeout(() => {
      setSearching(true);
      locationApi.searchPlaces({ keyword: value, size: 8 })
        .then((data) => {
          if (searchRequestRef.current === requestId) setResults((data.items || []).filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))));
        })
        .catch(() => {
          if (searchRequestRef.current === requestId) setResults([]);
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) setSearching(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const useMyLocation = async () => {
    setMessage("현재 위치를 확인하고 있습니다.");
    try {
      const current = await requestCurrentPosition();
      let label = "내 위치";
      let address = "";
      try {
        const data = await locationApi.reverseGeocode({ latitude: current.latitude, longitude: current.longitude });
        label = data.item?.address || data.item?.title || label;
        address = data.item?.address || data.item?.road_address || label;
      } catch {
        // 역지오코딩 실패 시에도 좌표 예보는 사용할 수 있다.
      }
      await loadWeather({ ...current, label, address });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const selectPlace = (place) => {
    const label = (place.title || place.address || place.road_address || "선택 지역").replace(/<[^>]+>/g, "");
    const address = (place.address || place.road_address || label).replace(/<[^>]+>/g, "");
    setKeyword("");
    setResults([]);
    loadWeather({ latitude: Number(place.latitude), longitude: Number(place.longitude), label, address, source: "search" });
  };

  const toggleExtendedForecast = async () => {
    if (extendedOpen) {
      setExtendedOpen(false);
      return;
    }
    setExtendedOpen(true);
    if (extendedWeather || extendedLoading) return;

    const requestId = extendedRequestRef.current + 1;
    extendedRequestRef.current = requestId;
    setExtendedLoading(true);
    setExtendedMessage("");
    try {
      const data = await weatherApi.extended({ address: location.address || location.label });
      if (extendedRequestRef.current !== requestId) return;
      setExtendedWeather(data.weather);
      if (!(data.weather?.daily || []).length) {
        setExtendedMessage("현재 지역의 중기예보가 아직 발표되지 않았습니다.");
      }
    } catch (error) {
      if (extendedRequestRef.current === requestId) {
        setExtendedMessage(error.response?.data?.message || "장기예보를 불러오지 못했습니다.");
      }
    } finally {
      if (extendedRequestRef.current === requestId) setExtendedLoading(false);
    }
  };

  const current = weather?.current;
  return (
    <div className="desktop-page desktop-weather-page">
      <div className="screen-title desktop-weather-page__title">
        <div><span>WEATHER FOR SPORTS</span><h1>전국 운동 날씨</h1><p>원하는 지역의 오늘 날씨와 앞으로 24시간 예보를 확인하세요.</p></div>
        <button type="button" className="ghost-btn" onClick={useMyLocation}><LocateFixed size={17} /> 내 위치</button>
      </div>

      <section className="desktop-weather-search">
        <label><Search size={19} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="지역, 주소 또는 장소를 검색하세요 (예: 부산 해운대)" /></label>
        {(searching || results.length > 0) && (
          <div className="desktop-weather-search__results">
            {searching ? <span>지역을 검색하고 있습니다.</span> : results.map((place, index) => (
              <button type="button" key={`${place.title}-${index}`} onClick={() => selectPlace(place)}>
                <MapPin size={17} /><span><strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong><small>{place.address || place.road_address}</small></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {message && <p className="desktop-weather-page__message">{message}</p>}
      {loading ? (
        <section className="desktop-weather-loading">기상청 예보를 불러오고 있습니다.</section>
      ) : current ? (
        <>
          <section className="desktop-weather-current">
            <div className="desktop-weather-current__place"><MapPin size={18} /><span><small>현재 조회 지역</small><strong>{location.label}</strong></span></div>
            <div className="desktop-weather-current__main"><WeatherIcon condition={current.condition} size={64} /><strong>{Math.round(current.temperature_c)}°</strong><span>{current.condition_label}</span></div>
            <div className="desktop-weather-current__metrics">
              <span><Droplets size={17} /> 강수확률 <b>{Math.round(current.precipitation_probability || 0)}%</b></span>
              <span>습도 <b>{current.humidity ?? "-"}%</b></span>
              <span><Wind size={17} /> 풍속 <b>{current.wind_speed_ms ?? "-"}m/s</b></span>
            </div>
            <p>{current.message}</p>
          </section>

          <section className="desktop-section desktop-weather-hourly">
            <div className="desktop-section__head"><h2>시간대별 날씨</h2><span>앞으로 24시간</span></div>
            <div className="desktop-weather-hourly__list">
              {weather.hourly.map((item) => <article key={item.forecast_at}><time>{displayHour(item.forecast_at)}</time><WeatherIcon condition={item.condition} /><strong>{Math.round(item.temperature_c)}°</strong><span><Droplets size={13} />{Math.round(item.precipitation_probability || 0)}%</span></article>)}
            </div>
          </section>

          <section className="desktop-section desktop-weather-daily">
            <div className="desktop-section__head">
              <div><h2>3일 예보</h2><span>기상청 단기예보</span></div>
              <button type="button" className="desktop-weather-daily__toggle" aria-expanded={extendedOpen} onClick={toggleExtendedForecast}>
                {extendedOpen ? "장기예보 닫기" : "장기예보 보기"}
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="desktop-weather-daily__list">{weather.daily.map((item, index) => <article key={item.date}><strong>{displayDate(item.date, index)}</strong><span><WeatherIcon condition={item.condition} size={25} />{item.condition_label}</span><span>최저 {Math.round(item.temperature_min_c)}° / 최고 {Math.round(item.temperature_max_c)}°</span><span><Droplets size={14} />{Math.round(item.precipitation_probability || 0)}%</span></article>)}</div>
            {extendedOpen && (
              <div className="desktop-weather-extended">
                <div className="desktop-weather-extended__head"><h3>4~10일 예보</h3><span>기상청 중기예보</span></div>
                {extendedLoading ? <p>장기예보를 불러오고 있습니다.</p> : null}
                {extendedMessage ? <p>{extendedMessage}</p> : null}
                <div className="desktop-weather-daily__list">
                  {(extendedWeather?.daily || []).map((item, index) => <article key={item.date}><strong>{displayDate(item.date, index + weather.daily.length)}</strong><span><WeatherIcon condition={item.condition} size={25} />{item.condition_label}</span><span>최저 {Math.round(item.temperature_min_c)}° / 최고 {Math.round(item.temperature_max_c)}°</span><span><Droplets size={14} />{Math.round(item.precipitation_probability || 0)}%</span></article>)}
                </div>
              </div>
            )}
          </section>
        </>
      ) : <section className="desktop-weather-loading">날씨 정보가 없습니다.</section>}
    </div>
  );
}
