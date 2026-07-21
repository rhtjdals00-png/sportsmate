import { Cloud, CloudRain, CloudSun, Droplets, Snowflake, Sun, Wind } from "lucide-react";

function WeatherIcon({ condition, size = 40 }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={size} />;
  if (condition === "snow") return <Snowflake size={size} />;
  if (condition === "clear") return <Sun size={size} />;
  if (condition === "partly_cloudy") return <CloudSun size={size} />;
  return <Cloud size={size} />;
}

function value(value, suffix) {
  return value === null || value === undefined ? null : `${Math.round(Number(value) * 10) / 10}${suffix}`;
}

export default function MobileWeatherCard({ forecast, loading = false, title = "모임 날씨" }) {
  if (loading) {
    return (
      <div className="mobile-weather-card is-loading">
        기상청 예보를 확인하고 있습니다.
      </div>
    );
  }

  if (!forecast) return null;
  
  if (!forecast.available) {
    return (
      <div className="mobile-weather-card is-unavailable">
        <div className="mobile-weather-card__icon">
          <Cloud size={24} />
        </div>
        <div className="mobile-weather-card__content">
          <strong>{title}</strong>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{forecast.message}</p>
        </div>
      </div>
    );
  }

  const temperature = value(forecast.temperature_c, "°");
  const range = forecast.temperature_min_c != null || forecast.temperature_max_c != null
    ? `${value(forecast.temperature_min_c, "°") || "-"} / ${value(forecast.temperature_max_c, "°") || "-"}` : null;

  return (
    <div className="mobile-weather-card">
      <div className="mobile-weather-card__content">
        <small>{title} · 기상청 {forecast.forecast_type === "mid" ? "중기" : "단기"}예보</small>
        <strong>{forecast.condition_label}{temperature ? ` ${temperature}` : ""}</strong>
        <div className="mobile-weather-card__metrics">
          {range && <span>최저/최고 {range}</span>}
          {forecast.precipitation_probability != null && <span><Droplets size={12} /> 강수 {value(forecast.precipitation_probability, "%")}</span>}
          {forecast.wind_speed_ms != null && <span><Wind size={12} /> 바람 {value(forecast.wind_speed_ms, "m/s")}</span>}
        </div>
      </div>
      <div className="mobile-weather-card__icon">
        <WeatherIcon condition={forecast.condition} />
      </div>
    </div>
  );
}
