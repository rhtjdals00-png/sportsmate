import { Cloud, CloudRain, CloudSun, Droplets, Snowflake, Sun, Wind } from "lucide-react";

function WeatherIcon({ condition, size = 30 }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={size} />;
  if (condition === "snow") return <Snowflake size={size} />;
  if (condition === "clear") return <Sun size={size} />;
  if (condition === "partly_cloudy") return <CloudSun size={size} />;
  return <Cloud size={size} />;
}

function value(value, suffix) {
  return value === null || value === undefined ? null : `${Math.round(Number(value) * 10) / 10}${suffix}`;
}

function forecastDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function DesktopWeatherCard({ forecast, loading = false, title = "모임 날씨", selectedAt = "" }) {
  if (loading) return <div className="desktop-weather-card is-loading">기상청 예보를 확인하고 있습니다.</div>;
  if (!forecast) return null;
  const targetLabel = forecastDateLabel(forecast.forecast_at || selectedAt);
  if (!forecast.available) {
    const unavailableMessage = forecast.forecast_type === "unavailable" ? "기상정보가 없습니다." : forecast.message;
    return (
      <div className="desktop-weather-card is-unavailable">
        <Cloud size={26} />
        <div><strong>{title}{targetLabel ? ` · ${targetLabel}` : ""}</strong><p>{unavailableMessage}</p></div>
      </div>
    );
  }

  const temperature = value(forecast.temperature_c, "°");
  const range = forecast.temperature_min_c != null || forecast.temperature_max_c != null
    ? `${value(forecast.temperature_min_c, "°") || "-"} / ${value(forecast.temperature_max_c, "°") || "-"}` : null;
  return (
    <div className="desktop-weather-card">
      <div className="desktop-weather-card__summary">
        <span><WeatherIcon condition={forecast.condition} /></span>
        <div><small>{title}{targetLabel ? ` · ${targetLabel}` : ""} · 기상청 {forecast.forecast_type === "mid" ? "중기" : "단기"}예보</small><strong>{forecast.condition_label}{temperature ? ` ${temperature}` : ""}</strong></div>
      </div>
      <div className="desktop-weather-card__metrics">
        {range && <span>최저/최고 <strong>{range}</strong></span>}
        {forecast.precipitation_probability != null && <span><Droplets size={15} /> 강수 <strong>{value(forecast.precipitation_probability, "%")}</strong></span>}
        {forecast.humidity != null && <span>습도 <strong>{value(forecast.humidity, "%")}</strong></span>}
        {forecast.wind_speed_ms != null && <span><Wind size={15} /> 바람 <strong>{value(forecast.wind_speed_ms, "m/s")}</strong></span>}
      </div>
      <p>{forecast.message}</p>
    </div>
  );
}
