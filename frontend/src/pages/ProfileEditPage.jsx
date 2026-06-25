import { Camera, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { userApi } from "../api/userApi";
import { sportApi } from "../api/sportApi";
import { koreaRegions } from "../data/koreaRegions";

const levelOptions = [
  { value: "beginner", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "상급" }
];

function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const preferredSportNames = useMemo(
    () => (user?.profile?.preferred_sports || "").split(",").map((sport) => sport.trim()).filter(Boolean),
    [user?.profile?.preferred_sports]
  );
  const [form, setForm] = useState({
    nickname: user?.nickname || "",
    profile_image_url: user?.profile_image_url || "",
    region: user?.profile?.region || "전국",
    region_sido: "",
    region_area: "",
    exercise_level: user?.profile?.exercise_level || "beginner",
    preferred_sports: preferredSportNames,
    preferred_sport_levels: user?.profile?.preferred_sport_levels || {}
  });
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [levelSelectionEnabled, setLevelSelectionEnabled] = useState(
    Boolean(user?.profile?.preferred_sport_levels && Object.keys(user.profile.preferred_sport_levels).length)
  );

  useEffect(() => {
    Promise.all([
      sportApi.categories(),
      sportApi.sports()
    ]).then(([categoryData, sportData]) => {
      setCategories(categoryData.items || []);
      setSports(sportData.items || []);
    });
  }, []);

  useEffect(() => {
    if (!form.region || form.region === "전국" || form.region_sido) return;
    const matchedSido = koreaRegions.find((region) => form.region.includes(region.name) || form.region.includes(shortRegionName(region.name)));
    if (!matchedSido) return;
    const matchedArea = matchedSido.areas.find((area) => form.region.includes(area)) || "";
    setForm((prev) => ({
      ...prev,
      region_sido: matchedSido.name,
      region_area: matchedArea,
      region: matchedArea ? `${matchedSido.name} ${matchedArea}` : matchedSido.name
    }));
  }, [form.region, form.region_sido]);

  const groupedSports = useMemo(
    () => categories.map((category) => ({
      ...category,
      sports: sports.filter((sport) => sport.category_id === category.id)
    })),
    [categories, sports]
  );
  const selectedCategory = groupedSports.find((category) => category.id === openCategoryId);

  const selectedRegion = koreaRegions.find((region) => region.name === form.region_sido);
  const shortRegionName = (name) => name
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("특별자치도", "")
    .replace("특별자치시", "")
    .replace("특별자치도", "");

  const updateRegion = (sidoName, areaName = "") => {
    const regionName = sidoName ? (areaName ? `${sidoName} ${areaName}` : sidoName) : "전국";
    setForm((prev) => ({
      ...prev,
      region: regionName,
      region_sido: sidoName,
      region_area: areaName
    }));
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

  const toggleSport = (sportName) => {
    setForm((prev) => {
      const exists = prev.preferred_sports.includes(sportName);
      const nextSports = exists
        ? prev.preferred_sports.filter((name) => name !== sportName)
        : [...prev.preferred_sports, sportName];
      const nextLevels = { ...prev.preferred_sport_levels };
      if (exists) {
        delete nextLevels[sportName];
      } else if (levelSelectionEnabled) {
        nextLevels[sportName] = nextLevels[sportName] || prev.exercise_level || "beginner";
      }
      return { ...prev, preferred_sports: nextSports, preferred_sport_levels: nextLevels };
    });
  };

  const toggleLevelSelection = () => {
    setLevelSelectionEnabled((prev) => {
      const next = !prev;
      setForm((current) => {
        if (!next) {
          return { ...current, preferred_sport_levels: {} };
        }
        const nextLevels = { ...current.preferred_sport_levels };
        current.preferred_sports.forEach((sportName) => {
          nextLevels[sportName] = nextLevels[sportName] || current.exercise_level || "beginner";
        });
        return { ...current, preferred_sport_levels: nextLevels };
      });
      return next;
    });
  };

  const updateSportLevel = (sportName, level) => {
    setForm((prev) => ({
      ...prev,
      preferred_sport_levels: {
        ...prev.preferred_sport_levels,
        [sportName]: level
      },
      exercise_level: level
    }));
  };

  const attachProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, profile_image_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    const data = await userApi.updateMe({
      ...form,
      preferred_sports: form.preferred_sports.join(", "),
      preferred_sport_levels: levelSelectionEnabled ? form.preferred_sport_levels : {}
    });
    setCurrentUser(data.user);
    navigate("/mypage");
  };

  return (
    <>
      <MobileHeader title="프로필 수정" />
      <form className="mobile-form" onSubmit={submit}>
        <label>닉네임<input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
        <section className="profile-image-field">
          <img src={form.profile_image_url || "/images/logo.png"} alt="프로필 미리보기" />
          <label>
            <Camera size={18} />
            프로필 이미지 첨부
            <input type="file" accept="image/*" onChange={attachProfileImage} />
          </label>
        </section>
        <section className="profile-region-field">
          <strong>지역</strong>
          <div className="region-inline">
            <select value={form.region_sido} onChange={(event) => updateRegion(event.target.value, "")}>
              <option value="">전국</option>
              {koreaRegions.map((region) => (
                <option key={region.name} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
            <select value={form.region_area} onChange={(event) => updateRegion(form.region_sido, event.target.value)} disabled={!form.region_sido}>
                <option value="">전체</option>
                {(selectedRegion?.areas || []).map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
            </select>
          </div>
          <p>{form.region}</p>
        </section>
        <section className="sport-check-field">
          <strong>선호 종목</strong>
          <div className="sport-category-inline">
            {groupedSports.map((category) => (
              <div key={category.id} className="sport-category-inline__item">
                <button
                  type="button"
                  className={openCategoryId === category.id ? "active" : ""}
                  onClick={() => setOpenCategoryId((prev) => prev === category.id ? null : category.id)}
                >
                  {category.name}
                </button>
              </div>
            ))}
          </div>
          {selectedCategory && (
            <div className="sport-dropdown open">
              <div className="sport-check-field__options">
                {selectedCategory.sports.map((sport) => {
                  const checked = form.preferred_sports.includes(sport.name);
                  return (
                    <div key={sport.id} className={`sport-option-row ${checked ? "checked" : ""}`}>
                      <label className={checked ? "checked" : ""}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSport(sport.name)}
                        />
                        {sport.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <label className="level-toggle">
            <input type="checkbox" checked={levelSelectionEnabled} onChange={toggleLevelSelection} />
            수준 선택하기
          </label>
          {levelSelectionEnabled && form.preferred_sports.length > 0 && (
            <div className="level-selection-panel">
              {form.preferred_sports.map((sportName) => (
                <label key={sportName}>
                  <span>{sportName}</span>
                  <select
                    aria-label={`${sportName} 운동 수준`}
                    value={form.preferred_sport_levels[sportName] || "beginner"}
                    onChange={(event) => updateSportLevel(sportName, event.target.value)}
                  >
                    {levelOptions.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </section>
        {form.preferred_sports.length > 0 && (
          <section className="selected-sport-summary">
            <strong>선택한 종목</strong>
            <div>
              {form.preferred_sports.map((sportName) => {
                const level = levelOptions.find((item) => item.value === form.preferred_sport_levels[sportName])?.label;
                return (
                  <button type="button" key={sportName} onClick={() => removeSport(sportName)}>
                    {sportName}{levelSelectionEnabled && level ? `:${level}` : ""}
                    <X size={14} />
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <Button type="submit">저장</Button>
      </form>
    </>
  );
}

export default ProfileEditPage;
