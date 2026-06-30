import { Camera, CheckCircle2, MapPin, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { sportApi } from "../api/sportApi";
import { userApi } from "../api/userApi";
import { koreaRegions } from "../data/koreaRegions";

const levelOptions = [
  { value: "beginner", label: "\uc785\ubb38" },
  { value: "intermediate", label: "\uc911\uae09" },
  { value: "advanced", label: "\uc0c1\uae09" }
];

const fallbackSportGroups = [
  { id: "ball", name: "\uad6c\uae30", sports: ["\ucd95\uad6c", "\ud48b\uc0b4", "\ub18d\uad6c", "\uc57c\uad6c", "\ubc30\uad6c", "\ud14c\ub2c8\uc2a4", "\ubc30\ub4dc\ubbfc\ud134", "\ud0c1\uad6c"] },
  { id: "fitness", name: "\ud53c\ud2b8\ub2c8\uc2a4", sports: ["\ud5ec\uc2a4", "\ud06c\ub85c\uc2a4\ud54f", "\ud544\ub77c\ud14c\uc2a4", "\uc694\uac00", "\ud648\ud2b8\ub808\uc774\ub2dd"] },
  { id: "outdoor", name: "\ub7ec\ub2dd/\uc544\uc6c3\ub3c4\uc5b4", sports: ["\ub7ec\ub2dd", "\ub9c8\ub77c\ud1a4", "\ub4f1\uc0b0", "\uc790\uc804\uac70", "\ud2b8\ub808\ud0b9"] },
  { id: "water", name: "\uc218\uc0c1/\uaca8\uc6b8", sports: ["\uc218\uc601", "\uc11c\ud551", "\uc2a4\ud0a4", "\uc2a4\ub178\ubcf4\ub4dc"] },
  { id: "etc", name: "\uae30\ud0c0", sports: ["\ubcf5\uc2f1", "\ud074\ub77c\uc774\ubc0d", "\uace8\ud504", "\ub304\uc2a4", "\ubcfc\ub9c1"] }
];

function formatPhoneNumber(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function text(value) {
  return value;
}

function splitSports(value) {
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function parsePreferredLevels(value) {
  if (!value) return { all: "beginner" };
  if (typeof value === "object") return Object.keys(value).length ? value : { all: "beginner" };
  try {
    const parsed = JSON.parse(value);
    return parsed && Object.keys(parsed).length ? parsed : { all: "beginner" };
  } catch {
    return { all: "beginner" };
  }
}

function hasBrokenText(value) {
  return !value || /\\u[0-9a-f]{4}|\ufffd|\?\?/.test(String(value));
}

function buildSportGroups(categories, sports) {
  if (!categories.length || !sports.length || categories.some((category) => hasBrokenText(category.name))) {
    return fallbackSportGroups;
  }

  const groups = categories
    .map((category) => ({
      id: String(category.id),
      name: category.name,
      sports: sports
        .filter((sport) => String(sport.category_id) === String(category.id))
        .map((sport) => sport.name)
        .filter((name) => !hasBrokenText(name))
    }))
    .filter((group) => group.sports.length);

  return groups.length ? groups : fallbackSportGroups;
}

function regionParts(regionName) {
  const parts = (regionName || "").split(" ").filter(Boolean);
  return {
    sido: parts[0] || "",
    area: parts[1] || "",
    district: parts.slice(2).join(" ")
  };
}

function joinRegion(sido, area, district) {
  return [sido, area, district].filter(Boolean).join(" ");
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `[${normalized}]` : "";
}

function ProfileSetupPage() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const initialRegion = regionParts(user?.profile?.region);
  const initialLevels = parsePreferredLevels(user?.profile?.preferred_sport_levels);
  const initialSports = splitSports(user?.profile?.preferred_sports);

  const [form, setForm] = useState({
    name: user?.name || "",
    nickname: user?.nickname || "",
    phone_number: formatPhoneNumber(user?.phone_number || ""),
    profile_image_url: user?.profile_image_url || "",
    bio: user?.profile?.bio || "",
    region_sido: initialRegion.sido,
    region_area: initialRegion.area,
    region_district: initialRegion.district,
    region: user?.profile?.region || "",
    exercise_level: user?.profile?.exercise_level || initialLevels.all || "beginner",
    preferred_sports: initialSports,
    preferred_sport_levels: initialLevels
  });
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(fallbackSportGroups[0].id);
  const [selectedSport, setSelectedSport] = useState("");
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

  const sportGroups = useMemo(() => buildSportGroups(categories, sports), [categories, sports]);
  const activeSportGroup = sportGroups.find((group) => group.id === selectedCategoryId) || sportGroups[0];
  const selectedSido = koreaRegions.find((region) => region.name === form.region_sido);
  const availableAreas = selectedSido?.areas || [];
  const availableDistricts = selectedSido?.districts?.[form.region_area] || [];
  const selectedLevelLabel = levelOptions.find((level) => level.value === form.exercise_level)?.label || "\uc785\ubb38";
  const displayTag = tagLabel(user);

  useEffect(() => {
    if (!sportGroups.some((group) => group.id === selectedCategoryId)) {
      setSelectedCategoryId(sportGroups[0]?.id || "");
      setSelectedSport("");
    }
  }, [sportGroups, selectedCategoryId]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateRegion = (sido, area = "", district = "") => {
    setForm((current) => ({
      ...current,
      region_sido: sido,
      region_area: area,
      region_district: district,
      region: joinRegion(sido, area, district)
    }));
  };

  const updateExerciseLevel = (level) => {
    setForm((current) => ({
      ...current,
      exercise_level: level,
      preferred_sport_levels: {
        ...current.preferred_sport_levels,
        all: level
      }
    }));
  };

  const addSport = () => {
    if (!selectedSport) return;
    setForm((current) => {
      if (current.preferred_sports.includes(selectedSport)) return current;
      return {
        ...current,
        preferred_sports: [...current.preferred_sports, selectedSport],
        preferred_sport_levels: {
          ...current.preferred_sport_levels,
          [selectedSport]: current.preferred_sport_levels[selectedSport] || current.exercise_level
        }
      };
    });
    setSelectedSport("");
  };

  const removeSport = (sportName) => {
    setForm((current) => {
      const nextLevels = { ...current.preferred_sport_levels };
      delete nextLevels[sportName];
      return {
        ...current,
        preferred_sports: current.preferred_sports.filter((name) => name !== sportName),
        preferred_sport_levels: nextLevels
      };
    });
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
        phone_number: formatPhoneNumber(form.phone_number),
        nickname: form.nickname.trim(),
        profile_image_url: form.profile_image_url,
        bio: form.bio.trim(),
        region: form.region,
        exercise_level: form.exercise_level,
        preferred_sports: form.preferred_sports.join(", "),
        preferred_sport_levels: {
          ...form.preferred_sport_levels,
          all: form.exercise_level
        }
      });
      setCurrentUser(data.user);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "\ud504\ub85c\ud544 \uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="profile-setup-page">
      <form className="profile-setup" onSubmit={submit}>
        <section className="profile-setup__intro">
          <div>
            <p className="profile-setup__eyebrow">{"\ucd94\uac00 \uc815\ubcf4 \uc785\ub825"}</p>
            <h1>{"\uc6b4\ub3d9 \uba54\uc774\ud2b8 \ucd94\ucc9c\uc744 \uc704\ud55c \ud504\ub85c\ud544\uc744 \uc644\uc131\ud574\uc8fc\uc138\uc694"}</h1>
            <p>{"\uac00\uc785\uc740 \uc644\ub8cc\ub410\uc5b4\uc694. \uc9c0\uc5ed, \uc6b4\ub3d9 \uc218\uc900, \uc120\ud638 \uc885\ubaa9\uc744 \uc785\ub825\ud558\uba74 \ub354 \uc815\ud655\ud55c \ucd94\ucc9c\uc744 \ubc1b\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4."}</p>
          </div>
          <div className="profile-setup__status">
            <CheckCircle2 size={18} />
            <span>{"Supabase Auth \uc5f0\uacb0\ub428"}</span>
          </div>
        </section>

        <section className="profile-setup__nickname-notice" aria-label="nickname notice">
          <strong>{"\ub2c9\ub124\uc784\uacfc \uc2dd\ubcc4 \ud0dc\uadf8\uac00 \uc124\uc815\ub410\uc5b4\uc694"}</strong>
          <p>{"\uce74\uce74\uc624\ud1a1\uc73c\ub85c \ucc98\uc74c \ub85c\uadf8\uc778\ud558\uba74 \uce74\uce74\uc624\ud1a1 \ub2c9\ub124\uc784\uc744 \uae30\ubcf8\uc73c\ub85c \uc0ac\uc6a9\ud569\ub2c8\ub2e4. \uc0ac\uc6a9\uc790 \uc2dd\ubcc4\uc740 \uc790\ub3d9\uc73c\ub85c \uc0dd\uc131\ub41c 4\uc790\ub9ac \ud0dc\uadf8\ub97c \uc0ac\uc6a9\ud558\uace0, \ub2c9\ub124\uc784\uc740 \ub9c8\uc774\ud398\uc774\uc9c0\uc5d0\uc11c \uc5b8\uc81c\ub4e0 \uc218\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."}</p>
          {form.nickname ? <span>{"\ud604\uc7ac \ub2c9\ub124\uc784"}: {form.nickname} {displayTag}</span> : null}
        </section>

        <section className="profile-setup__panel profile-setup__identity">
          <div className="profile-setup__avatar">
            <img src={form.profile_image_url || "/images/logo.png"} alt="profile preview" />
            <label className="profile-setup__avatar-button">
              <Camera size={18} />
              <span>{"\uc0ac\uc9c4 \ubcc0\uacbd"}</span>
              <input type="file" accept="image/*" onChange={attachProfileImage} />
            </label>
          </div>
          <div className="profile-setup__fields">
            <label>
              <span>{"\uc774\ub984"}</span>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder={text("\ud45c\uc2dc \uc774\ub984")} />
            </label>
            <label>
              <span>{"\ub2c9\ub124\uc784"}</span>
              <input value={form.nickname} onChange={(event) => updateField("nickname", event.target.value)} placeholder={text("\ubaa8\uc784\uc5d0\uc11c \uc0ac\uc6a9\ud560 \ub2c9\ub124\uc784")} required />
            </label>
            <label>
              <span>{"\ud734\ub300\ud3f0 \ubc88\ud638"}</span>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone_number}
                onChange={(event) => updateField("phone_number", formatPhoneNumber(event.target.value))}
                placeholder="010-0000-0000"
                maxLength={13}
              />
            </label>
            <label className="profile-setup__wide-field">
              <span>{"\ud55c \uc904 \uc18c\uac1c"}</span>
              <textarea value={form.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder={text("\uc608: \ud3c9\uc77c \uc800\ub141 \ub7ec\ub2dd\uacfc \uc8fc\ub9d0 \ud48b\uc0b4\uc744 \uc88b\uc544\ud574\uc694.")} rows={3} />
            </label>
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__grid-section">
          <div>
            <h2>{"\ud65c\ub3d9 \uc9c0\uc5ed"}</h2>
            <p>{"\uc8fc\ub85c \ucc38\uc5ec\ud560 \uc218 \uc788\ub294 \uc9c0\uc5ed\uc744 \ub2e8\uacc4\ubcc4\ub85c \uc120\ud0dd\ud574\uc8fc\uc138\uc694."}</p>
          </div>
          <div className="profile-setup__select-block">
            <div className="profile-setup__select-grid profile-setup__select-grid--region">
              <select value={form.region_sido} onChange={(event) => updateRegion(event.target.value)}>
                <option value="">{"\uc2dc/\ub3c4 \uc120\ud0dd"}</option>
                {koreaRegions.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}
              </select>
              <select value={form.region_area} onChange={(event) => updateRegion(form.region_sido, event.target.value)} disabled={!form.region_sido}>
                <option value="">{"\uc2dc/\uad70/\uad6c \uc120\ud0dd"}</option>
                {availableAreas.map((area) => <option key={area} value={area}>{area}</option>)}
              </select>
              <select value={form.region_district} onChange={(event) => updateRegion(form.region_sido, form.region_area, event.target.value)} disabled={!availableDistricts.length}>
                <option value="">{"\uc74d/\uba74/\ub3d9 \uc120\ud0dd"}</option>
                {availableDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
            <div className="profile-setup__region-result"><MapPin size={16} />{form.region || text("\uc9c0\uc5ed \ubbf8\uc120\ud0dd")}</div>
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__grid-section">
          <div>
            <h2>{"\uc6b4\ub3d9 \ud504\ub85c\ud544"}</h2>
            <p>{"\uc804\uccb4 \uc6b4\ub3d9 \uc218\uc900\uc740"} <strong>{selectedLevelLabel}</strong>{"\uc73c\ub85c \uc800\uc7a5\ub429\ub2c8\ub2e4."}</p>
          </div>
          <div className="profile-setup__level-buttons">
            {levelOptions.map((level) => (
              <button key={level.value} type="button" className={form.exercise_level === level.value ? "is-active" : ""} onClick={() => updateExerciseLevel(level.value)}>
                {level.label}
              </button>
            ))}
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__sports">
          <div className="profile-setup__section-head">
            <div>
              <h2>{"\uc120\ud638 \uc885\ubaa9"}</h2>
              <p>{"\ub300\uc8fc\uc81c\ub97c \uace0\ub978 \ub4a4 \uc18c\uc8fc\uc81c\ub97c \ucd94\uac00\ud574\uc8fc\uc138\uc694. \uc5ec\ub7ec \uc885\ubaa9\uc744 \uc120\ud0dd\ud560 \uc218 \uc788\uc5b4\uc694."}</p>
            </div>
            <span>{form.preferred_sports.length}{"\uac1c \uc120\ud0dd"}</span>
          </div>
          <div className="profile-setup__sport-dropdowns">
            <select value={selectedCategoryId} onChange={(event) => { setSelectedCategoryId(event.target.value); setSelectedSport(""); }}>
              {sportGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <select value={selectedSport} onChange={(event) => setSelectedSport(event.target.value)}>
              <option value="">{"\uc18c\uc8fc\uc81c \uc120\ud0dd"}</option>
              {(activeSportGroup?.sports || []).map((sportName) => <option key={sportName} value={sportName}>{sportName}</option>)}
            </select>
            <button type="button" onClick={addSport} disabled={!selectedSport}>
              <Plus size={16} /> {"\ucd94\uac00"}
            </button>
          </div>
          {form.preferred_sports.length > 0 ? (
            <div className="profile-setup__selected">
              {form.preferred_sports.map((sportName) => (
                <button type="button" key={sportName} onClick={() => removeSport(sportName)}>
                  {sportName}
                  <X size={14} />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {error ? <p className="profile-setup__error">{error}</p> : null}
        <div className="profile-setup__actions">
          <Button type="button" variant="ghost" onClick={() => navigate("/", { replace: true })}>{"\ub098\uc911\uc5d0 \ud558\uae30"}</Button>
          <Button type="submit" disabled={saving || !form.nickname.trim()}>{saving ? text("\uc800\uc7a5 \uc911...") : text("\ud504\ub85c\ud544 \uc800\uc7a5")}</Button>
        </div>
      </form>
    </main>
  );
}

export default ProfileSetupPage;
