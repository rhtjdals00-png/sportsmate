import { Camera, CheckCircle2, KeyRound, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import DesktopProfileEdit from "../components/profile/desktop/DesktopProfileEdit.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { userApi } from "../api/userApi";
import { sportApi } from "../api/sportApi";
import { locationApi } from "../api/locationApi";
import { koreaRegions } from "../data/koreaRegions";
import { useResponsive } from "../hooks/useResponsive";
import { isProfileEditVerified } from "../utils/profileEditAccess";

const T = {
  title: "프로필 설정",
  eyebrow: "추가 정보 입력",
  heading: "운동 메이트 추천을 위한 프로필을 완성해주세요",
  description: "가입은 완료됐어요. 몇 가지 정보만 더 입력하면 모임 추천과 매칭 품질이 좋아집니다.",
  connected: "Supabase Auth 연결됨",
  previewAlt: "프로필 미리보기",
  changePhoto: "사진 변경",
  name: "이름",
  namePlaceholder: "실명 또는 표시 이름",
  nickname: "닉네임",
  nicknamePlaceholder: "모임에서 사용할 닉네임",
  phone: "휴대폰 번호",
  optional: "선택 입력",
  bio: "한 줄 소개",
  bioPlaceholder: "예: 평일 저녁 러닝과 주말 풋살을 좋아해요.",
  regionTitle: "활동 지역",
  regionDesc: "주로 참여할 수 있는 지역을 검색하거나 직접 입력해주세요.",
  sido: "시/도 선택",
  all: "전체",
  noRegion: "지역 미선택",
  sportsProfile: "운동 프로필",
  sportsDescPrefix: "전체 운동 수준은",
  sportsDescSuffix: "으로 저장됩니다.",
  preferredSports: "선호 종목",
  preferredSportsDesc: "관심 있는 종목을 여러 개 선택할 수 있어요.",
  selectedUnit: "개 선택",
  categoryLabel: "종목 카테고리",
  saveError: "프로필 저장에 실패했습니다.",
  later: "나중에 하기",
  saving: "저장 중...",
  save: "프로필 저장",
  nicknameNoticeTitle: "닉네임은 임시로 설정됐어요",
  nicknameNotice: "소셜 계정으로 가입하면 이메일 @ 앞부분을 기본 닉네임으로 설정합니다. 같은 닉네임이 있으면 자동으로 고유 문자가 붙을 수 있어요. 닉네임은 마이페이지에서 언제든 수정할 수 있습니다."
};

const levelOptions = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "상급" }
];

const fallbackSportGroups = [
  { category: { id: "fallback-ball", name: "구기 종목" }, sports: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { category: { id: "fallback-racket", name: "라켓 스포츠" }, sports: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { category: { id: "fallback-outdoor", name: "러닝 / 야외" }, sports: ["러닝", "등산", "트래킹", "자전거", "산책"] },
  { category: { id: "fallback-fitness", name: "피트니스" }, sports: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { category: { id: "fallback-etc", name: "기타" }, sports: ["볼링", "당구", "골프", "수영"] }
];


// API 응답이 비어 있거나 깨졌을 때 사용할 기본 종목 목록입니다.
const fallbackCategories = fallbackSportGroups.map((group) => group.category);
const fallbackSports = fallbackSportGroups.flatMap((group) =>
  group.sports.map((name, index) => ({
    id: `${group.category.id}-${index}`,
    name,
    category_id: group.category.id
  }))
);

function parsePreferredLevels(value) {
  if (!value) return {};
  if (typeof value === "object") return Object.keys(value).length ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && Object.keys(parsed).length ? parsed : {};
  } catch {
    return {};
  }
}

function splitSports(value) {
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

// 모바일 프로필 수정 화면은 PC 프로필 수정 화면과 분리해 관리합니다.
function MobileProfileEditPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const initialSports = useMemo(() => splitSports(user?.profile?.preferred_sports), [user?.profile?.preferred_sports]);
  const initialLevels = useMemo(() => parsePreferredLevels(user?.profile?.preferred_sport_levels), [user?.profile?.preferred_sport_levels]);

  const [form, setForm] = useState({
    name: user?.name || "",
    phone_number: user?.phone_number || "",
    nickname: user?.nickname || "",
    profile_image_url: user?.profile_image_url || "",
    bio: user?.profile?.bio || "",
    region: user?.profile?.region || "",
    region_sido: "",
    region_area: "",
    exercise_level: user?.profile?.exercise_level || initialLevels.all || "beginner",
    preferred_sports: initialSports,
    preferred_sport_levels: initialLevels
  });
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [regionKeyword, setRegionKeyword] = useState(user?.profile?.region || "");
  const [regionResults, setRegionResults] = useState([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionMessage, setRegionMessage] = useState("");
  const [useSportLevels, setUseSportLevels] = useState(
    initialSports.some((sportName) => Boolean(initialLevels[sportName]))
  );
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([sportApi.categories(), sportApi.sports()])
      .then(([categoryData, sportData]) => {
        setCategories(categoryData.items || []);
        setSports(sportData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setSports([]);
      });
  }, []);

  useEffect(() => {
    if (!form.region || form.region_sido) return;
    const matchedSido = koreaRegions.find((region) => form.region.includes(region.name));
    if (!matchedSido) return;
    const matchedArea = matchedSido.areas.find((area) => form.region.includes(area)) || "";
    setForm((prev) => ({
      ...prev,
      region_sido: matchedSido.name,
      region_area: matchedArea
    }));
  }, [form.region, form.region_sido]);

  const displayCategories = categories.length ? categories : fallbackCategories;
  const displaySports = sports.length ? sports : fallbackSports;
  const usingFallbackSports = !categories.length || !sports.length;

  const groupedSports = useMemo(
    () => displayCategories.map((category) => ({
      ...category,
      sports: displaySports.filter((sport) => String(sport.category_id) === String(category.id))
    })),
    [displayCategories, displaySports]
  );

  const selectedCategory = groupedSports.find((category) => String(category.id) === String(openCategoryId)) || groupedSports[0];
  const selectedRegion = koreaRegions.find((region) => region.name === form.region_sido);
  const selectedLevelLabel = levelOptions.find((level) => level.value === form.exercise_level)?.label || levelOptions[0].label;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRegion = (sidoName, areaName = "") => {
    setForm((prev) => ({
      ...prev,
      region_sido: sidoName,
      region_area: areaName,
      region: sidoName ? (areaName ? `${sidoName} ${areaName}` : sidoName) : ""
    }));
  };

  const updateRegionText = (value) => {
    setRegionKeyword(value);
    setForm((prev) => ({
      ...prev,
      region: value,
      region_sido: "",
      region_area: ""
    }));
  };

  const searchRegion = async () => {
    const keyword = regionKeyword.trim();
    setRegionMessage("");
    if (!keyword) {
      setRegionMessage("검색할 주소나 지역명을 입력해주세요.");
      return;
    }
    setRegionLoading(true);
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      const items = data.items || [];
      setRegionResults(items);
      if (!items.length) {
        setRegionMessage("검색 결과가 없습니다. 입력한 지역명은 그대로 저장할 수 있습니다.");
      }
    } catch {
      setRegionResults([]);
      setRegionMessage("주소검색 API에 연결할 수 없습니다. 입력한 지역명은 그대로 저장할 수 있습니다.");
    } finally {
      setRegionLoading(false);
    }
  };

  const selectRegionResult = (item) => {
    const value = item.address || item.title || "";
    updateRegionText(value);
    setRegionResults([]);
    setRegionMessage("");
  };

  const updateExerciseLevel = (level) => {
    setForm((prev) => ({
      ...prev,
      exercise_level: level,
      preferred_sport_levels: {
        ...prev.preferred_sport_levels,
        all: level
      }
    }));
  };

  const toggleSport = (sportName) => {
    setForm((prev) => {
      const exists = prev.preferred_sports.includes(sportName);
      const nextLevels = { ...prev.preferred_sport_levels };
      if (exists) {
        delete nextLevels[sportName];
      } else {
        nextLevels[sportName] = nextLevels[sportName] || prev.exercise_level;
      }
      return {
        ...prev,
        preferred_sports: exists
          ? prev.preferred_sports.filter((name) => name !== sportName)
          : [...prev.preferred_sports, sportName],
        preferred_sport_levels: nextLevels
      };
    });
  };

  const removeSport = (sportName) => {
    setForm((prev) => {
      const nextLevels = { ...prev.preferred_sport_levels };
      delete nextLevels[sportName];
      return {
        ...prev,
        preferred_sports: prev.preferred_sports.filter((name) => name !== sportName),
        preferred_sport_levels: nextLevels
      };
    });
  };

  const updateSportLevel = (sportName, level) => {
    setForm((prev) => ({
      ...prev,
      preferred_sport_levels: {
        ...prev.preferred_sport_levels,
        [sportName]: level
      }
    }));
  };

  const attachProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("profile_image_url", reader.result);
    reader.readAsDataURL(file);
  };

  const updatePassword = (field, value) => {
    setPasswordStatus("idle");
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitPasswordChange = () => {
    // 실제 비밀번호 변경 API가 연결되기 전까지 모바일과 PC의 확인 흐름을 동일하게 맞춥니다.
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordStatus("empty");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus("mismatch");
      return;
    }
    setPasswordStatus("success");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await userApi.updateMe({
        name: form.name.trim(),
        phone_number: form.phone_number.trim(),
        nickname: form.nickname.trim(),
        profile_image_url: form.profile_image_url,
        bio: form.bio.trim(),
        region: form.region || "",
        exercise_level: form.exercise_level,
        preferred_sports: form.preferred_sports.join(", "),
        preferred_sport_levels: useSportLevels
          ? { ...form.preferred_sport_levels, all: form.exercise_level }
          : { all: form.exercise_level }
      });
      setCurrentUser(data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || T.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {isMobile ? <MobileHeader title={T.title} /> : null}
      <main className="profile-setup-page">
        <form className="profile-setup" onSubmit={submit}>
          <section className="profile-setup__intro">
            <div>
              <p className="profile-setup__eyebrow">{T.eyebrow}</p>
              <h1>{T.heading}</h1>
              <p>{T.description}</p>
            </div>
            <div className="profile-setup__status">
              <CheckCircle2 size={18} />
              <span>{T.connected}</span>
            </div>
          </section>

          {!isMobile ? (
            <section className="profile-setup__nickname-notice" aria-label={T.nicknameNoticeTitle}>
              <strong>{T.nicknameNoticeTitle}</strong>
              <p>{T.nicknameNotice}</p>
              {form.nickname ? <span>{T.nickname}: {form.nickname}</span> : null}
            </section>
          ) : null}

          <section className="profile-setup__panel profile-setup__identity">
            <div className="profile-setup__avatar">
              <img src={form.profile_image_url || "/images/logo.png"} alt={T.previewAlt} />
              <label className="profile-setup__avatar-button">
                <Camera size={18} />
                <span>{T.changePhoto}</span>
                <input type="file" accept="image/*" onChange={attachProfileImage} />
              </label>
            </div>
            <div className="profile-setup__fields">
              <label>
                <span>{T.name}</span>
                <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder={T.namePlaceholder} />
              </label>
              <label>
                <span>{T.nickname}</span>
                <input maxLength={12} value={form.nickname} onChange={(event) => updateField("nickname", event.target.value.slice(0, 12))} placeholder={T.nicknamePlaceholder} required />
              </label>
              <label>
                <span>{T.phone}</span>
                <input value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} placeholder={T.optional} />
              </label>
              <label className="profile-setup__wide-field">
                <span>{T.bio}</span>
                <textarea value={form.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder={T.bioPlaceholder} rows={3} />
              </label>
            </div>
          </section>

          <section className="profile-setup__panel profile-setup__grid-section">
            <div>
              <h2>{T.regionTitle}</h2>
              <p>{T.regionDesc}</p>
            </div>
            {!isMobile ? (
              <div className="profile-setup__address-search">
                <div className="profile-setup__address-row">
                  <MapPin size={18} />
                  <input
                    value={regionKeyword}
                    onChange={(event) => updateRegionText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchRegion();
                      }
                    }}
                    placeholder="예: 서울 강남구, 잠실종합운동장"
                  />
                  <button type="button" onClick={searchRegion} disabled={regionLoading}>
                    <Search size={16} />
                    {regionLoading ? "검색 중" : "주소찾기"}
                  </button>
                </div>
                {regionMessage ? <p className="profile-setup__address-message">{regionMessage}</p> : null}
                {regionResults.length > 0 ? (
                  <div className="profile-setup__address-results">
                    {regionResults.map((item, index) => (
                      <button type="button" key={`${item.address || item.title}-${index}`} onClick={() => selectRegionResult(item)}>
                        <strong>{item.title || item.address}</strong>
                        {item.address ? <span>{item.address}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="profile-setup__region-result">{form.region || T.noRegion}</div>
              </div>
            ) : (
              <div className="profile-setup__region-selects">
                <select value={form.region_sido} onChange={(event) => updateRegion(event.target.value, "")}>
                  <option value="">{T.sido}</option>
                  {koreaRegions.map((region) => (
                    <option key={region.name} value={region.name}>{region.name}</option>
                  ))}
                </select>
                <select value={form.region_area} onChange={(event) => updateRegion(form.region_sido, event.target.value)} disabled={!form.region_sido}>
                  <option value="">{T.all}</option>
                  {(selectedRegion?.areas || []).map((area) => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <div className="profile-setup__region-result">{form.region || T.noRegion}</div>
              </div>
            )}
          </section>

          <section className="profile-setup__panel profile-setup__grid-section">
            <div>
              <h2>{T.sportsProfile}</h2>
              <p>{T.sportsDescPrefix} <strong>{selectedLevelLabel}</strong>{T.sportsDescSuffix}</p>
            </div>
            <div className="profile-setup__level-buttons">
              {levelOptions.map((level) => (
                <button
                  type="button"
                  key={level.value}
                  className={form.exercise_level === level.value ? "is-active" : ""}
                  onClick={() => updateExerciseLevel(level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </section>

          <section className="profile-setup__panel profile-setup__sports">
            <div className="profile-setup__section-head">
              <div>
                <h2>{T.preferredSports}</h2>
                <p>{T.preferredSportsDesc}</p>
                {!isMobile && usingFallbackSports ? <small className="profile-setup__sport-note">기본 종목 목록을 표시하고 있습니다.</small> : null}
              </div>
              <span>{form.preferred_sports.length}{T.selectedUnit}</span>
            </div>
            <div className="profile-setup__sport-body">
              <nav className="profile-setup__categories" aria-label={T.categoryLabel}>
                {groupedSports.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={(selectedCategory?.id === category.id) ? "is-active" : ""}
                    onClick={() => setOpenCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
              <div className="profile-setup__sport-list">
                {(selectedCategory?.sports || []).map((sport) => {
                  const checked = form.preferred_sports.includes(sport.name);
                  return (
                    <button
                      type="button"
                      key={sport.id}
                      className={checked ? "is-selected" : ""}
                      onClick={() => toggleSport(sport.name)}
                    >
                      {sport.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="profile-setup__level-toggle">
              <input
                type="checkbox"
                checked={useSportLevels}
                onChange={(event) => setUseSportLevels(event.target.checked)}
              />
              <span>종목별 수준 선택하기</span>
            </label>
            {useSportLevels && form.preferred_sports.length > 0 ? (
              <div className="profile-setup__sport-levels">
                {form.preferred_sports.map((sportName) => (
                  <label key={sportName}>
                    <span>{sportName}</span>
                    <select
                      value={form.preferred_sport_levels[sportName] || form.exercise_level}
                      onChange={(event) => updateSportLevel(sportName, event.target.value)}
                    >
                      {levelOptions.map((level) => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            {form.preferred_sports.length > 0 && (
              <div className="profile-setup__selected">
                {form.preferred_sports.map((sportName) => {
                  const levelLabel = levelOptions.find((level) => level.value === form.preferred_sport_levels[sportName])?.label;
                  return (
                    <button type="button" key={sportName} onClick={() => removeSport(sportName)}>
                      {useSportLevels && levelLabel ? `${sportName}:${levelLabel}` : sportName}
                      <X size={14} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="profile-setup__panel profile-setup__security">
            <div>
              <KeyRound size={18} />
              <div>
                <h2>계정 보안</h2>
                <p>비밀번호는 현재 비밀번호 확인 후 변경합니다.</p>
              </div>
            </div>
            <button type="button" onClick={() => setPasswordModalOpen(true)}>비밀번호 변경</button>
          </section>

          {error && <p className="profile-setup__error">{error}</p>}
          <div className="profile-setup__actions">
            <Button type="button" variant="ghost" onClick={() => navigate("/", { replace: true })}>{T.later}</Button>
            <Button type="submit" disabled={saving || !form.nickname.trim()}>{saving ? T.saving : T.save}</Button>
          </div>
        </form>
      </main>
      {passwordModalOpen ? (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPasswordModalOpen(false)}>
          <section className="profile-auth-modal password-change-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setPasswordModalOpen(false)}><X size={18} /></button>
            <h2>비밀번호 변경</h2>
            <p>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
            <label>
              현재 비밀번호
              <input type="password" value={passwordForm.current} onChange={(event) => updatePassword("current", event.target.value)} />
            </label>
            <label>
              새 비밀번호
              <input type="password" value={passwordForm.next} onChange={(event) => updatePassword("next", event.target.value)} />
            </label>
            <label>
              새 비밀번호 확인
              <input type="password" value={passwordForm.confirm} onChange={(event) => updatePassword("confirm", event.target.value)} />
            </label>
            {passwordStatus === "empty" ? <em className="nickname-check warn">모든 비밀번호 항목을 입력해주세요.</em> : null}
            {passwordStatus === "mismatch" ? <em className="nickname-check warn">새 비밀번호가 일치하지 않습니다.</em> : null}
            {passwordStatus === "success" ? <em className="nickname-check ok">비밀번호 변경 흐름이 확인되었습니다.</em> : null}
            <div>
              <button className="ghost-btn" type="button" onClick={() => setPasswordModalOpen(false)}>취소</button>
              <button className="primary-small" type="button" onClick={submitPasswordChange}>변경하기</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function ProfileSetupPage() {
  return <MobileProfileEditPage />;
}

function hasLinkedEmailProvider(user) {
  return (user?.provider || "")
    .split(",")
    .map((item) => item.trim())
    .includes("email");
}

// PC와 모바일 프로필 수정 화면을 접속 기기 기준으로 분기합니다.
function ProfileEditPage() {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [desktopEditUnlocked] = useState(() => isProfileEditVerified());
  // 2026-07-02: 모바일 흐름은 유지하고, PC에서만 DB provider의 email 연동 상태를 기준으로 보호.
  const canVerifyPassword = hasLinkedEmailProvider(user);

  if (isMobile) {
    return <MobileProfileEditPage />;
  }

  if (user && !canVerifyPassword) {
    return <Navigate to="/mypage/account-link" replace />;
  }

  if (user && canVerifyPassword && !desktopEditUnlocked) {
    return <Navigate to="/mypage" replace />;
  }

  return <DesktopProfileEdit />;
}

export default ProfileEditPage;
