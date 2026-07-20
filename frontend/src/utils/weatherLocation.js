export const SEOUL_WEATHER_LOCATION = {
  latitude: 37.5665,
  longitude: 126.978,
  label: "서울특별시",
  source: "default",
};

const STORAGE_KEY = "sportsmate_weather_location";

function validLocation(value) {
  return Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude));
}

export function getSavedWeatherLocation(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (validLocation(saved)) return saved;
  } catch {
    // 저장값이 손상되었으면 프로필 위치를 사용한다.
  }
  const profile = user?.profile;
  if (validLocation({ latitude: profile?.region_latitude, longitude: profile?.region_longitude })) {
    return {
      latitude: Number(profile.region_latitude),
      longitude: Number(profile.region_longitude),
      label: profile.region || "내 활동 지역",
      source: "profile",
    };
  }
  return SEOUL_WEATHER_LOCATION;
}

export function saveWeatherLocation(location) {
  if (!validLocation(location)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
}

export function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저에서는 위치 정보를 사용할 수 없습니다."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: "내 위치",
        source: "geolocation",
      }),
      () => reject(new Error("위치 권한이 없어 저장된 활동 지역의 날씨를 표시합니다.")),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

export function sameWeatherArea(first, second) {
  return Math.abs(Number(first?.latitude) - Number(second?.latitude)) < 0.02
    && Math.abs(Number(first?.longitude) - Number(second?.longitude)) < 0.02;
}
