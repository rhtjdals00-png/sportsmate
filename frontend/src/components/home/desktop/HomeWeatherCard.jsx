import { useEffect, useState } from "react";
import { Cloud, CloudRain, CloudSun, LocateFixed, Snowflake, Sun, Wind } from "lucide-react";
import { Link } from "react-router-dom";
import { weatherApi } from "../../../api/weatherApi";
import { getWeatherFallbackLocation, requestCurrentPosition, sameWeatherArea, saveWeatherLocation } from "../../../utils/weatherLocation";

function WeatherIcon({ condition }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={40} />;
  if (condition === "snow") return <Snowflake size={40} />;
  if (condition === "clear") return <Sun size={40} />;
  if (condition === "partly_cloudy") return <CloudSun size={40} />;
  return <Cloud size={40} />;
}

export default function HomeWeatherCard({ user }) {
  const [location, setLocation] = useState(() => getWeatherFallbackLocation(user));
  const [state, setState] = useState({ loading: true, weather: null, message: "" });

  const load = (nextLocation) => {
    setState((current) => ({ ...current, loading: true }));
    return weatherApi.daily({ latitude: nextLocation.latitude, longitude: nextLocation.longitude })
      .then((data) => setState({ loading: false, weather: data.weather, message: "" }))
      .catch((error) => setState({ loading: false, weather: null, message: error.response?.data?.message || "날씨를 불러오지 못했습니다." }));
  };

  useEffect(() => {
    let active = true;
    const initial = getWeatherFallbackLocation(user);
    setLocation(initial);
    load(initial);
    if (initial.source === "profile") {
      return () => { active = false; };
    }
    requestCurrentPosition()
      .then((current) => {
        if (!active || sameWeatherArea(initial, current)) return;
        saveWeatherLocation(current);
        setLocation(current);
        load(current);
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

  const current = state.weather?.current;
  return (
    <Link className="home-weather-card" to="/weather" aria-label="전국 날씨 자세히 보기">
      <div className="home-weather-card__place">
        <span><LocateFixed size={17} /> 오늘의 날씨</span>
        <strong>{location.label}</strong>
        <small>눌러서 전국 날씨 조회</small>
      </div>
      {state.loading ? (
        <div className="home-weather-card__loading">내 위치의 날씨를 확인하고 있습니다.</div>
      ) : current ? (
        <>
          <div className="home-weather-card__condition">
            <WeatherIcon condition={current.condition} />
            <div><strong>{Math.round(current.temperature_c)}°</strong><span>{current.condition_label}</span></div>
          </div>
          <div className="home-weather-card__metrics">
            <span>강수확률 <b>{Math.round(current.precipitation_probability || 0)}%</b></span>
            <span><Wind size={15} /> 바람 <b>{current.wind_speed_ms ?? "-"}m/s</b></span>
            <p>{current.message}</p>
          </div>
        </>
      ) : (
        <div className="home-weather-card__loading">{state.message}</div>
      )}
    </Link>
  );
}
