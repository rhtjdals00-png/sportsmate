import { Camera, CheckCircle2, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import DesktopProfileEdit from "../components/profile/desktop/DesktopProfileEdit.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { userApi } from "../api/userApi";
import { sportApi } from "../api/sportApi";
import { locationApi } from "../api/locationApi";
import { koreaRegions } from "../data/koreaRegions";
import { useResponsive } from "../hooks/useResponsive";

const T = {
  title: "\ud504\ub85c\ud544 \uc124\uc815",
  eyebrow: "\ucd94\uac00 \uc815\ubcf4 \uc785\ub825",
  heading: "\uc6b4\ub3d9 \uba54\uc774\ud2b8 \ucd94\ucc9c\uc744 \uc704\ud55c \ud504\ub85c\ud544\uc744 \uc644\uc131\ud574\uc8fc\uc138\uc694",
  description: "\uac00\uc785\uc740 \uc644\ub8cc\ub410\uc5b4\uc694. \uba87 \uac00\uc9c0 \uc815\ubcf4\ub9cc \ub354 \uc785\ub825\ud558\uba74 \ubaa8\uc784 \ucd94\ucc9c\uacfc \ub9e4\uce6d \ud488\uc9c8\uc774 \uc88b\uc544\uc9d1\ub2c8\ub2e4.",
  connected: "Supabase Auth \uc5f0\uacb0\ub428",
  previewAlt: "\ud504\ub85c\ud544 \ubbf8\ub9ac\ubcf4\uae30",
  changePhoto: "\uc0ac\uc9c4 \ubcc0\uacbd",
  name: "\uc774\ub984",
  namePlaceholder: "\uc2e4\uba85 \ub610\ub294 \ud45c\uc2dc \uc774\ub984",
  nickname: "\ub2c9\ub124\uc784",
  nicknamePlaceholder: "\ubaa8\uc784\uc5d0\uc11c \uc0ac\uc6a9\ud560 \ub2c9\ub124\uc784",
  phone: "\ud734\ub300\ud3f0 \ubc88\ud638",
  optional: "\uc120\ud0dd \uc785\ub825",
  bio: "\ud55c \uc904 \uc18c\uac1c",
  bioPlaceholder: "\uc608: \ud3c9\uc77c \uc800\ub141 \ub7ec\ub2dd\uacfc \uc8fc\ub9d0 \ud48b\uc0b4\uc744 \uc88b\uc544\ud574\uc694.",
  regionTitle: "\ud65c\ub3d9 \uc9c0\uc5ed",
  regionDesc: "\uc8fc\ub85c \ucc38\uc5ec\ud560 \uc218 \uc788\ub294 \uc9c0\uc5ed\uc744 \uac80\uc0c9\ud558\uac70\ub098 \uc9c1\uc811 \uc785\ub825\ud574\uc8fc\uc138\uc694.",
  sido: "\uc2dc/\ub3c4 \uc120\ud0dd",
  all: "\uc804\uccb4",
  noRegion: "\uc9c0\uc5ed \ubbf8\uc120\ud0dd",
  sportsProfile: "\uc6b4\ub3d9 \ud504\ub85c\ud544",
  sportsDescPrefix: "\uc804\uccb4 \uc6b4\ub3d9 \uc218\uc900\uc740",
  sportsDescSuffix: "\uc73c\ub85c \uc800\uc7a5\ub429\ub2c8\ub2e4.",
  preferredSports: "\uc120\ud638 \uc885\ubaa9",
  preferredSportsDesc: "\uad00\uc2ec \uc788\ub294 \uc885\ubaa9\uc744 \uc5ec\ub7ec \uac1c \uc120\ud0dd\ud560 \uc218 \uc788\uc5b4\uc694.",
  selectedUnit: "\uac1c \uc120\ud0dd",
  categoryLabel: "\uc885\ubaa9 \uce74\ud14c\uace0\ub9ac",
  saveError: "\ud504\ub85c\ud544 \uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.",
  later: "\ub098\uc911\uc5d0 \ud558\uae30",
  saving: "\uc800\uc7a5 \uc911...",
  save: "\ud504\ub85c\ud544 \uc800\uc7a5",
  nicknameNoticeTitle: "\ub2c9\ub124\uc784\uc740 \uc784\uc2dc\ub85c \uc124\uc815\ub410\uc5b4\uc694",
  nicknameNotice: "\uc18c\uc15c \uacc4\uc815\uc73c\ub85c \uac00\uc785\ud558\uba74 \uc774\uba54\uc77c @ \uc55e\ubd80\ubd84\uc744 \uae30\ubcf8 \ub2c9\ub124\uc784\uc73c\ub85c \uc124\uc815\ud569\ub2c8\ub2e4. \uac19\uc740 \ub2c9\ub124\uc784\uc774 \uc788\uc73c\uba74 \uc790\ub3d9\uc73c\ub85c \uace0\uc720 \ubb38\uc790\uac00 \ubd99\uc744 \uc218 \uc788\uc5b4\uc694. \ub2c9\ub124\uc784\uc740 \ub9c8\uc774\ud398\uc774\uc9c0\uc5d0\uc11c \uc5b8\uc81c\ub4e0 \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."
};

const levelOptions = [
  { value: "beginner", label: "\uc785\ubb38" },
  { value: "intermediate", label: "\uc911\uae09" },
  { value: "advanced", label: "\uc0c1\uae09" }
];

const fallbackSportGroups = [
  { category: { id: "fallback-ball", name: "\uad6c\uae30" }, sports: ["\ucd95\uad6c", "\ud48b\uc0b4", "\ub18d\uad6c", "\uc57c\uad6c", "\ubc30\uad6c", "\ud14c\ub2c8\uc2a4", "\ubc30\ub4dc\ubbfc\ud134", "\ud0c1\uad6c"] },
  { category: { id: "fallback-fitness", name: "\ud53c\ud2b8\ub2c8\uc2a4" }, sports: ["\ud5ec\uc2a4", "\ud06c\ub85c\uc2a4\ud54f", "\ud544\ub77c\ud14c\uc2a4", "\uc694\uac00", "\ud648\ud2b8\ub808\uc774\ub2dd"] },
  { category: { id: "fallback-run", name: "\ub7ec\ub2dd/\uc544\uc6c3\ub3c4\uc5b4" }, sports: ["\ub7ec\ub2dd", "\ub9c8\ub77c\ud1a4", "\ub4f1\uc0b0", "\uc790\uc804\uac70", "\ud2b8\ub808\ud0b9"] },
  { category: { id: "fallback-water", name: "\uc218\uc0c1/\uaca8\uc6b8" }, sports: ["\uc218\uc601", "\uc11c\ud551", "\uc2a4\ud0a4", "\uc2a4\ub178\ubcf4\ub4dc"] },
  { category: { id: "fallback-etc", name: "\uae30\ud0c0" }, sports: ["\ubcf5\uc2f1", "\ud074\ub77c\uc774\ubc0d", "\uace8\ud504", "\ub304\uc2a4", "\ubcfc\ub9c1"] }
];


// 筌뤴뫀而???袁⑥쨮????쇱젟 ?遺얇늺?癒?퐣 ?????롫뮉 疫꿸퀡???ル굝???怨쀬뵠?怨쀬뿯??덈뼄.
const fallbackCategories = fallbackSportGroups.map((group) => group.category);
const fallbackSports = fallbackSportGroups.flatMap((group) =>
  group.sports.map((name, index) => ({
    id: `${group.category.id}-${index}`,
    name,
    category_id: group.category.id
  }))
);

const defaultLevelMap = { all: "beginner" };

function parsePreferredLevels(value) {
  if (!value) return defaultLevelMap;
  if (typeof value === "object") return Object.keys(value).length ? value : defaultLevelMap;
  try {
    const parsed = JSON.parse(value);
    return parsed && Object.keys(parsed).length ? parsed : defaultLevelMap;
  } catch {
    return defaultLevelMap;
  }
}

function splitSports(value) {
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

// 筌뤴뫀而???袁⑹뒠 ?袁⑥쨮????쇱젟 ?뚮똾猷??곕뱜??낅빍?? PC ?遺얇늺?? ?袁⑥삋 ProfileEditPage ?브쑨由?癒?퐣 DesktopProfileEdit???????몃빍??
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
      setRegionMessage("\uac80\uc0c9\ud560 \uc8fc\uc18c\ub098 \uc9c0\uc5ed\uba85\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.");
      return;
    }
    setRegionLoading(true);
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      const items = data.items || [];
      setRegionResults(items);
      if (!items.length) {
        setRegionMessage("\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. \uc785\ub825\ud55c \uc9c0\uc5ed\uba85\uc740 \uadf8\ub300\ub85c \uc800\uc7a5\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.");
      }
    } catch {
      setRegionResults([]);
      setRegionMessage("\uc8fc\uc18c\uac80\uc0c9 API\uc5d0 \uc5f0\uacb0\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \uc785\ub825\ud55c \uc9c0\uc5ed\uba85\uc740 \uadf8\ub300\ub85c \uc800\uc7a5\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.");
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
      return {
        ...prev,
        preferred_sports: exists
          ? prev.preferred_sports.filter((name) => name !== sportName)
          : [...prev.preferred_sports, sportName]
      };
    });
  };

  const removeSport = (sportName) => {
    setForm((prev) => ({
      ...prev,
      preferred_sports: prev.preferred_sports.filter((name) => name !== sportName)
    }));
  };

  const attachProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("profile_image_url", reader.result);
    reader.readAsDataURL(file);
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
        preferred_sport_levels: {
          ...form.preferred_sport_levels,
          all: form.exercise_level
        }
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
                    placeholder="\uc608: \uc11c\uc6b8 \uac15\ub0a8\uad6c, \uc7a0\uc2e4\uc885\ud569\uc6b4\ub3d9\uc7a5"
                  />
                  <button type="button" onClick={searchRegion} disabled={regionLoading}>
                    <Search size={16} />
                    {regionLoading ? "\uac80\uc0c9 \uc911" : "\uc8fc\uc18c\ucc3e\uae30"}
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
                {!isMobile && usingFallbackSports ? <small className="profile-setup__sport-note">\uae30\ubcf8 \uc885\ubaa9 \ubaa9\ub85d\uc744 \ud45c\uc2dc\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.</small> : null}
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
            {form.preferred_sports.length > 0 && (
              <div className="profile-setup__selected">
                {form.preferred_sports.map((sportName) => (
                  <button type="button" key={sportName} onClick={() => removeSport(sportName)}>
                    {sportName}
                    <X size={14} />
                  </button>
                ))}
              </div>
            )}
          </section>

          {error && <p className="profile-setup__error">{error}</p>}
          <div className="profile-setup__actions">
            <Button type="button" variant="ghost" onClick={() => navigate("/", { replace: true })}>{T.later}</Button>
            <Button type="submit" disabled={saving || !form.nickname.trim()}>{saving ? T.saving : T.save}</Button>
          </div>
        </form>
      </main>
    </>
  );
}

export function ProfileSetupPage() {
  return <MobileProfileEditPage />;
}

// PC와 모바일 프로필 수정 화면을 접속 기기 기준으로 분기합니다.
function ProfileEditPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileProfileEditPage /> : <DesktopProfileEdit />;
}

export default ProfileEditPage;
