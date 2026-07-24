import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, Dumbbell, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MobilePullToRefresh from "../../layout/mobile/MobilePullToRefresh.jsx";
import MeetingCard from "../../meeting/shared/MeetingCard.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getSportIcon } from "../../../utils/sportIcons.jsx";
import { sportApi } from "../../../api/sportApi.js";
import { weatherApi } from "../../../api/weatherApi";
import { getWeatherFallbackLocation, requestCurrentPosition, sameWeatherArea, saveWeatherLocation } from "../../../utils/weatherLocation";
import { CloudRain, Snowflake, Sun, CloudSun, Cloud, Wind, Droplets } from "lucide-react";

function WeatherIcon({ condition, size = 40 }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={size} />;
  if (condition === "snow") return <Snowflake size={size} />;
  if (condition === "clear") return <Sun size={size} />;
  if (condition === "partly_cloudy") return <CloudSun size={size} />;
  return <Cloud size={size} />;
}

function splitPreferredSports(value) {
  if (Array.isArray(value)) {
    return value.map((sport) => String(sport || "").trim()).filter(Boolean);
  }
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function isAdminUser(user) {
  const role = String(user?.role || user?.profile?.role || "").toLowerCase();
  return Boolean(user?.is_admin || user?.isAdmin || role === "admin" || role === "administrator");
}

function MobileHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("one_time"); // "one_time" | "regular"
  const oneTimeMeetings = useAsync(
    () => meetingApi.list({ limit: 5, status: "open", meeting_type: "one_time", recommend: true }),
    [user?.profile?.preferred_sports, user?.profile?.region]
  );
  const regularMeetings = useAsync(
    () => meetingApi.list({ limit: 5, status: "open", meeting_type: "regular", recommend: true }),
    [user?.profile?.preferred_sports, user?.profile?.region]
  );
  const sportsList = useAsync(() => sportApi.sports(), []);
  const preferredSports = useMemo(
    () => splitPreferredSports(user?.profile?.preferred_sports),
    [user?.profile?.preferred_sports]
  );
  const sportShortcuts = useMemo(
    () => preferredSports.slice(0, 6).map((label) => ({ label, icon: getSportIcon(label) })),
    [preferredSports]
  );
  const hasPreferredSports = sportShortcuts.length > 0;
  const showAdminEntry = isAdminUser(user);
  const navigate = useNavigate();

  const [location, setLocation] = useState(() => getWeatherFallbackLocation(user));
  const [weatherState, setWeatherState] = useState({ loading: true, weather: null });
  const swiperRef = useRef(null);

  useEffect(() => {
    let active = true;
    const initial = getWeatherFallbackLocation(user);
    setLocation(initial);
    
    const load = (nextLocation) => {
      setWeatherState(curr => ({ ...curr, loading: true }));
      weatherApi.daily({ latitude: nextLocation.latitude, longitude: nextLocation.longitude })
        .then((data) => { if (active) setWeatherState({ loading: false, weather: data.weather }); })
        .catch(() => { if (active) setWeatherState({ loading: false, weather: null }); });
    };

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

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper) return;
    const interval = setInterval(() => {
      const maxScroll = swiper.scrollWidth - swiper.clientWidth;
      // 끝까지 스크롤 된 경우 다시 처음으로, 아니면 다음 슬라이드로
      if (swiper.scrollLeft >= maxScroll - 10) {
        swiper.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        swiper.scrollTo({ left: swiper.scrollLeft + swiper.clientWidth, behavior: 'smooth' });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const getWeatherMessage = (weatherObj, loading) => {
    if (loading) return { title: "날씨 정보를 불러오는 중...", desc: "잠시만 기다려주세요." };
    if (!weatherObj) return { title: "날씨를 불러올 수 없습니다", desc: "기상청 API 키가 설정되지 않았거나 네트워크 오류입니다." };
    const current = weatherObj.current;
    if (!current) return { title: "현재 날씨", desc: "날씨 정보를 불러올 수 없습니다." };
    
    const temp = Math.round(current.temperature_c) + "°";
    const cond = current.condition;
    
    if (["rain", "rain_snow", "shower"].includes(cond)) return { title: `현재 ${temp} 비 ☔️`, desc: "비가 오네요! 실내 체육관 모임을 추천해드려요." };
    if (cond === "snow") return { title: `현재 ${temp} 눈 ☃️`, desc: "눈길 조심하시고 따뜻한 실내 스포츠 어떠세요?" };
    return { title: `현재 ${temp} ${current.condition_label} ☀️`, desc: "운동하기 딱 좋은 날씨! 야외 모임 어떠세요?" };
  };
  
  const getSportMessage = (sportName) => {
    const name = sportName || "운동";
    if (/축구/.test(name)) return `${name} 한 게임 어떠세요? ⚽️`;
    if (/풋살/.test(name)) return `${name} 한 게임 어떠세요? 🥅`;
    if (/농구/.test(name)) return `${name} 한 게임 어떠세요? 🏀`;
    if (/배구/.test(name)) return `${name} 한 게임 어떠세요? 🏐`;
    if (/야구/.test(name)) return `${name} 한 게임 어떠세요? ⚾️`;
    if (/족구/.test(name)) return `${name} 한 게임 어떠세요? 🦶⚽️`;
    if (/배드민턴/.test(name)) return `${name} 한 게임 어떠세요? 🏸`;
    if (/탁구/.test(name)) return `${name} 한 게임 어떠세요? 🏓`;
    if (/테니스/.test(name)) return `${name} 한 게임 어떠세요? 🎾`;
    if (/스쿼시/.test(name)) return `${name} 한 게임 어떠세요? 🎾`;
    
    if (/러닝|마라톤/.test(name)) return `상쾌하게 ${name} 어떠세요? 🏃‍♂️`;
    if (/등산/.test(name)) return `상쾌하게 ${name} 가보실까요? ⛰️`;
    if (/트레킹|트래킹|자전거|라이딩/.test(name)) return `상쾌하게 ${name} 어떠세요? 🚴`;
    if (/산책|워킹|걷기/.test(name)) return `여유롭게 ${name} 어떠세요? 🚶`;
    
    if (/헬스|웨이트|피트니스|크로스핏/.test(name)) return `득근득근 ${name} 어떠세요? 💪`;
    if (/클라이밍/.test(name)) return `짜릿한 ${name} 어떠세요? 🧗‍♂️`;
    
    if (/요가|필라테스/.test(name)) return `차분하게 ${name} 어떠세요? 🧘‍♀️`;
    if (/수영/.test(name)) return `개운하게 ${name} 어떠세요? 🏊`;
    if (/볼링/.test(name)) return `재밌는 ${name} 한 게임 어떠세요? 🎳`;
    if (/당구/.test(name)) return `재밌는 ${name} 한 게임 어떠세요? 🎱`;
    if (/골프/.test(name)) return `여유롭게 ${name} 어떠세요? ⛳️`;

    return `즐거운 ${name} 한 번 어떠세요? 🏅`;
  };

  const getSportSearchRoute = (sportName) => {
    const name = sportName || "운동";
    
    // DB에서 받아온 실제 스포츠 목록에서 ID 추출 (숫자 ID 매핑용)
    const sports = sportsList.data?.items || [];
    const matchedSport = sports.find((s) => name.includes(s.name) || s.name.includes(name));
    
    if (matchedSport && matchedSport.category_id && matchedSport.id) {
      return `/meetings?category=${matchedSport.category_id}&sport=${matchedSport.id}`;
    }

    // fallbackMap (DB 연동 실패 혹은 로딩 전 대비용 하드코딩)
    const sportMap = {
      "축구": "category=ball&sport=soccer", "풋살": "category=ball&sport=futsal",
      "농구": "category=ball&sport=basketball", "배구": "category=ball&sport=volleyball",
      "야구": "category=ball&sport=baseball", "족구": "category=ball&sport=jokgu",
      "배드민턴": "category=racket&sport=badminton", "탁구": "category=racket&sport=table-tennis",
      "테니스": "category=racket&sport=tennis", "스쿼시": "category=racket&sport=squash",
      "러닝": "category=outdoor&sport=running", "마라톤": "category=outdoor&sport=running",
      "등산": "category=outdoor&sport=hiking", "트래킹": "category=outdoor&sport=trekking",
      "트레킹": "category=outdoor&sport=trekking", "자전거": "category=outdoor&sport=cycling",
      "라이딩": "category=outdoor&sport=cycling", "산책": "category=outdoor&sport=walking",
      "걷기": "category=outdoor&sport=walking", "헬스": "category=fitness&sport=gym",
      "웨이트": "category=fitness&sport=gym", "피트니스": "category=fitness&sport=gym",
      "크로스핏": "category=fitness&sport=crossfit", "클라이밍": "category=fitness&sport=climbing",
      "요가": "category=fitness&sport=yoga", "필라테스": "category=fitness&sport=pilates",
      "볼링": "category=etc&sport=bowling", "댄스": "category=etc&sport=dance",
      "골프": "category=etc&sport=golf", "수영": "category=etc&sport=swimming"
    };
    for (const key in sportMap) {
      if (name.includes(key)) return `/meetings?${sportMap[key]}`;
    }
    return `/meetings?keyword=${encodeURIComponent(name)}`;
  };

  const getRegionSearchRoute = (regionName) => {
    if (!regionName) return `/meetings`;
    const sidoMap = {
      "서울": "11", "부산": "26", "대구": "27", "인천": "28", "광주": "29",
      "대전": "30", "울산": "31", "세종": "36", "경기": "41", "강원": "42",
      "충북": "43", "충남": "44", "전북": "45", "전남": "46", "경북": "47",
      "경남": "48", "제주": "50"
    };
    for (const key in sidoMap) {
      if (regionName.includes(key)) {
        const parts = regionName.split(" ");
        const sigungu = parts.length > 1 ? parts[1] : "";
        let url = `/meetings?sido=${sidoMap[key]}`;
        if (sigungu) url += `&sigungu=${encodeURIComponent(sigungu)}`;
        return url;
      }
    }
    return `/meetings?keyword=${encodeURIComponent(regionName)}`;
  };

  const weatherInfo = getWeatherMessage(weatherState.weather, weatherState.loading);
  const nickname = user?.nickname || user?.name || '게스트';
  const regionName = user?.profile?.region || '우리 동네';
  const randomSport = useMemo(() => {
    if (!sportShortcuts || sportShortcuts.length === 0) return '운동';
    const randomIndex = Math.floor(Math.random() * sportShortcuts.length);
    return sportShortcuts[randomIndex].label;
  }, [sportShortcuts]);

  return (
    <MobilePullToRefresh onRefresh={async () => { await Promise.all([oneTimeMeetings.execute(), regularMeetings.execute()]); }}>
      <MobileHeader showLogo />
      <div className="mobile-hero-swiper" ref={swiperRef}>
        <div className="mobile-hero-slide" style={{ cursor: 'pointer' }} onClick={() => navigate(getSportSearchRoute(randomSport))}>
          <span>맞춤 추천</span>
          <h1>{nickname}님, 이번 주말엔<br/>{getSportMessage(randomSport)}</h1>
          <p>회원님을 위한 맞춤 모임을 준비했어요.</p>
        </div>
        <div className="mobile-hero-slide mobile-hero-slide--weather" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.98), rgba(254, 243, 199, 0.86))' }} onClick={() => navigate(`/weather`)}>
          <span>{location.label} 오늘의 날씨</span>
          <h1>{weatherInfo.title}</h1>
          <p>{weatherInfo.desc}</p>
          {weatherState.weather?.current && (
            <>
              <div className="weather-decor">
                <WeatherIcon condition={weatherState.weather.current.condition} size={110} />
              </div>
              <div className="mobile-weather-metrics">
                <span>강수확률 {Math.round(weatherState.weather.current.precipitation_probability || 0)}%</span>
                <span><Wind size={12} /> {weatherState.weather.current.wind_speed_ms ?? "-"}m/s</span>
              </div>
            </>
          )}
        </div>
        <div className="mobile-hero-slide" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.98), rgba(220, 252, 231, 0.86))' }} onClick={() => navigate(getRegionSearchRoute(regionName))}>
          <span>내 동네 핫플레이스</span>
          <h1>지금 {regionName}에서<br/>가장 인기 있는 모임 ✨</h1>
          <p>이웃들과 함께 바로 참여해보세요!</p>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/meetings">
          <Search size={20} />
          모임 찾기
        </Link>
        <Link to="/meetings/create">
          <CalendarPlus size={20} />
          모임 만들기
        </Link>
      </div>

      {showAdminEntry ? (
        <Link className="mobile-admin-entry" to="/admin">
          <ShieldCheck size={20} />
          <span>관리자 대시보드 이동하기</span>
        </Link>
      ) : null}

      <section className="home-sport-shortcuts" aria-label="선호 종목 바로가기">
        {hasPreferredSports ? (
          sportShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={`/meetings?keyword=${encodeURIComponent(item.label)}`}>
                <Icon size={22} style={{ color: 'var(--mobile-primary, #4f46e5)' }} />
                <span>{item.label}</span>
              </Link>
            );
          })
        ) : (
          <Link className="home-sport-shortcuts__empty" to="/mypage/profile">
            <Dumbbell size={22} style={{ color: 'var(--mobile-primary, #4f46e5)' }} />
            <span>선호 종목 설정</span>
          </Link>
        )}
      </section>


      <section className="section">
        <div className="section-title">
          <h2>추천 모임</h2>
        </div>

        <div className="mobile-filter-type-tabs" style={{ marginBottom: '16px' }}>
          <button 
            type="button" 
            className={activeTab === "one_time" ? "is-active" : ""}
            onClick={() => setActiveTab("one_time")}
            style={{ padding: '10px 0', fontSize: '14px', fontWeight: '600' }}
          >
            일회성 모임
          </button>
          <button 
            type="button" 
            className={activeTab === "regular" ? "is-active" : ""}
            onClick={() => setActiveTab("regular")}
            style={{ padding: '10px 0', fontSize: '14px', fontWeight: '600' }}
          >
            정기 모임
          </button>
        </div>

        {activeTab === "one_time" && (
          oneTimeMeetings.loading ? (
            <LoadingCards count={3} />
          ) : (
            <div className="card-list">
              {(oneTimeMeetings.data?.items || [])
                .filter((meeting) => 
                  meeting.status === "open" && 
                  meeting.current_participants < meeting.max_participants && 
                  new Date(meeting.start_at) >= new Date()
                )
                .map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} compact />
              ))}
            </div>
          )
        )}

        {activeTab === "regular" && (
          regularMeetings.loading ? (
            <LoadingCards count={3} />
          ) : (
            <div className="card-list">
              {(regularMeetings.data?.items || [])
                .filter((meeting) => {
                  if (meeting.status !== "open") return false;
                  if (meeting.current_participants >= meeting.max_participants) return false;
                  if (meeting.end_at) return new Date(meeting.end_at) >= new Date();
                  return true;
                })
                .map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} compact />
              ))}
            </div>
          )
        )}
      </section>
    </MobilePullToRefresh>
  );
}

export default MobileHome;
