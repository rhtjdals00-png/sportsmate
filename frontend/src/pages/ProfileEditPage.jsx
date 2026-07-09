import { Camera, CheckCircle2, KeyRound, MapPin, Search, X, CircleAlert, LockKeyhole, XCircle } from "lucide-react";
import StatusMessages from "../constants/statusMessages";
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
import { isProfileEditVerified, markProfileEditVerified } from "../utils/profileEditAccess";
import { isSupabaseConfigured, supabase } from "../api/supabaseClient";

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

const splitRegions = (value) => {
  return (value || "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
};


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

const passwordChecks = [
  { id: "length", label: "8자 이상", test: (password) => password.length >= 8 },
  { id: "upper", label: "영문 대문자", test: (password) => /[A-Z]/.test(password) },
  { id: "lower", label: "영문 소문자", test: (password) => /[a-z]/.test(password) },
  { id: "number", label: "숫자", test: (password) => /\d/.test(password) },
  { id: "special", label: "특수문자", test: (password) => /[^A-Za-z0-9]/.test(password) }
];

const isValidPassword = (password) => passwordChecks.every((item) => item.test(password));

function getPasswordCheckItems(password) {
  return passwordChecks.map((item) => ({ ...item, passed: item.test(password) }));
}

function getPasswordStrength(password) {
  const passedCount = getPasswordCheckItems(password).filter((item) => item.passed).length;
  if (!password) return { label: "입력 전", level: "empty", percent: 0 };
  if (passedCount <= 2) return { label: "위험", level: "danger", percent: 32 };
  if (passedCount <= 4) return { label: "보통", level: "normal", percent: 66 };
  return { label: "안전", level: "safe", percent: 100 };
}

// 모바일 프로필 수정 화면은 PC 프로필 수정 화면과 분리해 관리합니다.
function MobileProfileEditPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const initialSports = useMemo(() => splitSports(user?.profile?.preferred_sports), [user?.profile?.preferred_sports]);
  const initialLevels = useMemo(() => parsePreferredLevels(user?.profile?.preferred_sport_levels), [user?.profile?.preferred_sport_levels]);

  const [unlocked, setUnlocked] = useState(() => isProfileEditVerified());
  const [verifyPasswordVal, setVerifyPasswordVal] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyChecking, setVerifyChecking] = useState(false);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    if (!verifyPasswordVal.trim()) {
      setVerifyError("비밀번호를 입력해주세요.");
      return;
    }
    setVerifyChecking(true);
    setVerifyError("");
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("인증 서비스 설정을 확인해주세요.");
      }
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: verifyPasswordVal
      });
      if (supabaseError) {
        throw new Error("비밀번호가 올바르지 않습니다.");
      }
      await userApi.verifyPassword({ password: verifyPasswordVal });
      markProfileEditVerified();
      setUnlocked(true);
    } catch (err) {
      setVerifyError(err.message || "비밀번호 확인에 실패했습니다.");
    } finally {
      setVerifyChecking(false);
    }
  };

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
  const [regionKeyword, setRegionKeyword] = useState("");
  const [regionResults, setRegionResults] = useState([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionMessage, setRegionMessage] = useState("");
  const [selectedRegions, setSelectedRegions] = useState(
    splitRegions(user?.profile?.region)
  );

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      region: selectedRegions.join(", ")
    }));
  }, [selectedRegions]);

  const [useSportLevels, setUseSportLevels] = useState(
    initialSports.some((sportName) => Boolean(initialLevels[sportName]))
  );
  const [levelModalSport, setLevelModalSport] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [toast, setToast] = useState("");

  const newPasswordChecks = getPasswordCheckItems(passwordForm.next);
  const newPasswordStrength = getPasswordStrength(passwordForm.next);
  const hasPasswordConfirm = Boolean(passwordForm.confirm);
  const passwordMatches = Boolean(passwordForm.next) && passwordForm.next === passwordForm.confirm;
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

  const selectedCategory = openCategoryId ? (groupedSports.find((category) => String(category.id) === String(openCategoryId)) || null) : null;
  const selectedRegion = koreaRegions.find((region) => region.name === form.region_sido);
  const selectedLevelLabel = levelOptions.find((level) => level.value === form.exercise_level)?.label || levelOptions[0].label;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addRegion = (regionName) => {
    const trimmed = (regionName || "").trim();
    if (!trimmed) return;
    setSelectedRegions((prev) => {
      if (prev.includes(trimmed)) return prev;
      if (prev.length >= 2) {
        alert("활동 지역은 최대 2개까지만 지정할 수 있습니다.");
        return prev;
      }
      return [...prev, trimmed];
    });
  };

  const removeRegion = (targetRegion) => {
    setSelectedRegions((prev) => prev.filter((r) => r !== targetRegion));
  };

  const handleSidoChange = (sidoName) => {
    setForm((prev) => ({
      ...prev,
      region_sido: sidoName,
      region_area: ""
    }));
  };

  const handleAreaChange = (areaName) => {
    setForm((prev) => ({
      ...prev,
      region_area: areaName
    }));
  };

  const handleAddSelectedRegion = () => {
    if (!form.region_sido) return;
    const fullRegion = form.region_area 
      ? `${form.region_sido} ${form.region_area}` 
      : form.region_sido;
    addRegion(fullRegion);
    setForm((prev) => ({
      ...prev,
      region_sido: "",
      region_area: ""
    }));
  };

  const updateRegionText = (value) => {
    setRegionKeyword(value);
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
    addRegion(value);
    setRegionKeyword("");
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
      if (exists) {
        const nextLevels = { ...prev.preferred_sport_levels };
        delete nextLevels[sportName];
        return {
          ...prev,
          preferred_sports: prev.preferred_sports.filter((name) => name !== sportName),
          preferred_sport_levels: nextLevels
        };
      } else {
        if (prev.preferred_sports.length >= 6) {
          alert("선호 종목은 최대 6개까지만 선택할 수 있습니다.");
          return prev;
        }
        if (useSportLevels) {
          setTimeout(() => setLevelModalSport(sportName), 0);
          return prev;
        } else {
          const nextLevels = { ...prev.preferred_sport_levels };
          nextLevels[sportName] = prev.exercise_level;
          return {
            ...prev,
            preferred_sports: [...prev.preferred_sports, sportName],
            preferred_sport_levels: nextLevels
          };
        }
      }
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

  const selectSportLevelAndAdd = (sportName, levelValue) => {
    setForm((prev) => {
      const nextLevels = { ...prev.preferred_sport_levels };
      nextLevels[sportName] = levelValue;
      return {
        ...prev,
        preferred_sports: [...prev.preferred_sports, sportName],
        preferred_sport_levels: nextLevels
      };
    });
    setLevelModalSport(null);
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

  const closePasswordModal = () => {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    setPasswordForm({ current: "", next: "", confirm: "" });
    setPasswordStatus("idle");
    setPasswordMessage("");
  };

  const submitPasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordStatus("empty");
      setPasswordMessage("모든 비밀번호 항목을 입력해주세요.");
      return;
    }
    if (!isValidPassword(passwordForm.next)) {
      setPasswordStatus("invalid");
      setPasswordMessage("비밀번호는 8자 이상이며 영문 대문자, 영문 소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus("mismatch");
      setPasswordMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordStatus("invalid");
      setPasswordMessage("현재 비밀번호와 다른 새 비밀번호를 입력해주세요.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setPasswordStatus("error");
      setPasswordMessage("인증 서비스 설정을 확인해주세요.");
      return;
    }

    setPasswordSaving(true);
    setPasswordStatus("idle");
    setPasswordMessage("");
    try {
      const email = user?.email || "";
      if (!email) {
        setPasswordStatus("error");
        setPasswordMessage("계정 이메일 정보를 확인할 수 없습니다.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.current
      });
      if (signInError) {
        setPasswordStatus("error");
        setPasswordMessage("현재 비밀번호가 올바르지 않습니다.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (updateError) throw updateError;

      setPasswordStatus("success");
      setPasswordMessage("비밀번호가 변경되었습니다.");
      setPasswordForm({ current: "", next: "", confirm: "" });
      
      setToast("비밀번호가 성공적으로 변경되었습니다.");
      setTimeout(() => {
        setToast("");
      }, 3000);

      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordStatus("idle");
        setPasswordMessage("");
      }, 1500);
    } catch (err) {
      setPasswordStatus("error");
      setPasswordMessage(err?.message || "비밀번호 변경에 실패했습니다.");
    } finally {
      setPasswordSaving(false);
    }
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

  if (user && !user.has_password) {
    return (
      <div className="mobile-shell" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MobileHeader title="계정 연동 필요" showBack={true} />
        <main style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#ef4444'
            }}>
              <KeyRound size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>이메일 연동 필요</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              소셜 로그인 계정은 프로필 수정 전<br />
              이메일 연동 및 비밀번호 등록이 필요합니다.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate("/mypage/account-link")}
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--mobile-primary)',
                color: '#fff',
                border: 0,
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                textAlign: 'center'
              }}
            >
              이메일 계정 연동하기
            </button>
            
            <button
              type="button"
              onClick={() => navigate("/mypage")}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: '#64748b',
                border: 0,
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="mobile-shell" style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MobileHeader title="비밀번호 확인" showBack={true} />
        <main style={{ padding: '24px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--mobile-primary)'
            }}>
              <KeyRound size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>비밀번호 입력</h2>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              회원님의 개인정보 보호를 위해<br />
              비밀번호를 다시 한 번 입력해주세요.
            </p>
          </div>

          <form onSubmit={handleVerifyPassword} style={{ display: 'grid', gap: '16px' }}>
            {verifyError && (
              <p style={{
                fontSize: '13px',
                color: '#ef4444',
                background: '#fef2f2',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                textAlign: 'center',
                margin: 0,
                fontWeight: '700'
              }}>{verifyError}</p>
            )}
            
            <input
              type="password"
              value={verifyPasswordVal}
              onChange={(e) => setVerifyPasswordVal(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '15px',
                background: '#fff',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                boxSizing: 'border-box'
              }}
              autoFocus
            />

            <button
              type="submit"
              disabled={verifyChecking}
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--mobile-primary)',
                color: '#fff',
                border: 0,
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
              }}
            >
              {verifyChecking ? "확인 중..." : "확인"}
            </button>
            
            <button
              type="button"
              onClick={() => navigate("/mypage")}
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: '#64748b',
                border: 0,
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
          </form>
        </main>
      </div>
    );
  }

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
              <label className="profile-setup__nickname-label">
                <span>{T.nickname}</span>
                <div className="profile-setup__nickname-input-group">
                  <input maxLength={12} value={form.nickname} onChange={(event) => updateField("nickname", event.target.value.slice(0, 12))} placeholder={T.nicknamePlaceholder} required />
                  {user?.user_tag && <span className="profile-setup__user-tag-readonly">#{user.user_tag}</span>}
                </div>
              </label>
              <label>
                <span>{T.phone}</span>
                <input value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} placeholder={T.optional} />
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
                <div className="profile-setup__region-badges">
                  {selectedRegions.length > 0 ? (
                    selectedRegions.map((regionItem) => (
                      <span key={regionItem} className="profile-setup__region-badge">
                        {regionItem}
                        <button type="button" onClick={() => removeRegion(regionItem)} aria-label="지역 삭제">
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="profile-setup__region-empty">{T.noRegion}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="profile-setup__region-selects">
                <div className="profile-setup__region-select-row">
                  <select value={form.region_sido} onChange={(event) => handleSidoChange(event.target.value)}>
                    <option value="">{T.sido}</option>
                    {koreaRegions.map((region) => (
                      <option key={region.name} value={region.name}>{region.name}</option>
                    ))}
                  </select>
                  <select value={form.region_area} onChange={(event) => handleAreaChange(event.target.value)} disabled={!form.region_sido}>
                    <option value="">{T.all}</option>
                    {(selectedRegion?.areas || []).map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="profile-setup__region-add-btn"
                    onClick={handleAddSelectedRegion}
                    disabled={!form.region_sido}
                  >
                    추가
                  </button>
                </div>
                <div className="profile-setup__region-badges">
                  {selectedRegions.length > 0 ? (
                    selectedRegions.map((regionItem) => (
                      <span key={regionItem} className="profile-setup__region-badge">
                        {regionItem}
                        <button type="button" onClick={() => removeRegion(regionItem)} aria-label="지역 삭제">
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="profile-setup__region-empty">{T.noRegion}</span>
                  )}
                </div>
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
            <div className="profile-setup__section-head profile-setup__section-head--sports">
              <div className="profile-setup__title-row">
                <h2>{T.preferredSports}</h2>
                <label className="profile-setup__level-toggle">
                  <input
                    type="checkbox"
                    checked={useSportLevels}
                    onChange={(event) => setUseSportLevels(event.target.checked)}
                  />
                  <span>수준 선택하기</span>
                </label>
              </div>
              <p>{T.preferredSportsDesc}</p>
              {!isMobile && usingFallbackSports ? <small className="profile-setup__sport-note">기본 종목 목록을 표시하고 있습니다.</small> : null}
              <span className="profile-setup__sports-count">{form.preferred_sports.length}{T.selectedUnit} (최대 6개)</span>
            </div>
            <div className={`profile-setup__sport-body ${selectedCategory ? "is-open" : ""}`}>
              <nav className="profile-setup__categories" aria-label={T.categoryLabel}>
                {groupedSports.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={(selectedCategory?.id === category.id) ? "is-active" : ""}
                    onClick={() => setOpenCategoryId((prev) => (prev === category.id ? null : category.id))}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
              <div className="profile-setup__sport-list-wrapper">
                <div>
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
              </div>
            </div>
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
      {levelModalSport && (
        <div className="mobile-level-modal-overlay" onClick={() => setLevelModalSport(null)}>
          <div className="mobile-level-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{levelModalSport} 수준 선택</h3>
            <p>이 종목에 대한 본인의 실력을 선택해주세요.</p>
            <div className="mobile-level-modal-options">
              {levelOptions.map((level) => (
                <button
                  type="button"
                  key={level.value}
                  className="mobile-level-modal-option-btn"
                  onClick={() => selectSportLevelAndAdd(levelModalSport, level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mobile-level-modal-close-btn"
              onClick={() => setLevelModalSport(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
      {passwordModalOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePasswordModal()}>
          <section className="profile-auth-modal password-change-modal" style={{ width: '95%', maxWidth: '360px', padding: '24px 20px', borderRadius: '16px', boxSizing: 'border-box' }}>
            <button className="schedule-modal-close" type="button" onClick={closePasswordModal} disabled={passwordSaving}><X size={18} /></button>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>비밀번호 변경</h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
            
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>현재 비밀번호</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#fff' }}>
                <LockKeyhole size={16} style={{ color: '#94a3b8' }} />
                <input 
                  type="password" 
                  value={passwordForm.current} 
                  onChange={(event) => updatePassword("current", event.target.value)} 
                  autoComplete="current-password"
                  disabled={passwordSaving}
                  style={{ border: 0, outline: 'none', fontSize: '14px', flex: 1, padding: 0 }}
                />
              </span>
            </label>

            <label style={{ display: 'block', marginBottom: '10px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>새 비밀번호</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#fff' }}>
                <LockKeyhole size={16} style={{ color: '#94a3b8' }} />
                <input 
                  type="password" 
                  minLength="8" 
                  value={passwordForm.next} 
                  onChange={(event) => updatePassword("next", event.target.value)} 
                  placeholder="대소문자, 숫자, 특수문자 포함" 
                  autoComplete="new-password"
                  disabled={passwordSaving}
                  style={{ border: 0, outline: 'none', fontSize: '14px', flex: 1, padding: 0 }}
                />
              </span>
            </label>

            {/* Real-time Validation Checker */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '14px',
              border: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', fontWeight: '800' }}>
                <span style={{ color: '#475569' }}>비밀번호 안전도</span>
                <span style={{
                  color: newPasswordStrength.level === 'safe' ? '#10b981' : (newPasswordStrength.level === 'normal' ? '#f59e0b' : '#ef4444')
                }}>{newPasswordStrength.label}</span>
              </div>
              <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{
                  height: '100%',
                  width: `${newPasswordStrength.percent}%`,
                  background: newPasswordStrength.level === 'safe' ? '#10b981' : (newPasswordStrength.level === 'normal' ? '#f59e0b' : '#ef4444'),
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {newPasswordChecks.map((item) => (
                  <li key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: item.passed ? '#10b981' : '#94a3b8'
                  }}>
                    {item.passed ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>새 비밀번호 확인</span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: `1px solid ${hasPasswordConfirm ? (passwordMatches ? '#10b981' : '#ef4444') : '#e2e8f0'}`,
                borderRadius: '8px',
                padding: '10px 12px',
                background: '#fff'
              }}>
                <LockKeyhole size={16} style={{ color: '#94a3b8' }} />
                <input 
                  type="password" 
                  minLength="8" 
                  value={passwordForm.confirm} 
                  onChange={(event) => updatePassword("confirm", event.target.value)} 
                  placeholder="비밀번호를 한 번 더 입력" 
                  autoComplete="new-password"
                  disabled={passwordSaving}
                  style={{ border: 0, outline: 'none', fontSize: '14px', flex: 1, padding: 0 }}
                />
              </span>
            </label>

            {hasPasswordConfirm && (
              <p style={{
                margin: '0 0 14px 0',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: passwordMatches ? '#10b981' : '#ef4444'
              }}>
                {passwordMatches ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {passwordMatches ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
              </p>
            )}

            {passwordMessage && (
              <em className={`nickname-check ${passwordStatus === "success" ? "ok" : "warn"}`} style={{ display: 'block', marginBottom: '16px', fontSize: '12px', fontWeight: '800' }}>
                {passwordMessage}
              </em>
            )}

            <div className="profile-auth-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="ghost-btn" type="button" onClick={closePasswordModal} disabled={passwordSaving} style={{ flex: 1 }}>취소</button>
              <button className="primary-small" type="button" onClick={submitPasswordChange} disabled={passwordSaving || (hasPasswordConfirm && !passwordMatches)} style={{ flex: 1 }}>
                {passwordSaving ? "변경 중..." : "변경하기"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Local Toast Alert Notification */}
      {toast && (
        <div 
          role="status" 
          aria-live="polite" 
          style={{ 
            position: 'fixed', 
            bottom: '80px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'rgba(15, 23, 42, 0.9)', 
            color: '#fff', 
            padding: '10px 18px', 
            borderRadius: '20px', 
            fontSize: '13px', 
            fontWeight: '700', 
            zIndex: 999999, 
            whiteSpace: 'nowrap', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textAlign: 'center',
            border: 'none'
          }}
        >
          {toast}
        </div>
      )}
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
