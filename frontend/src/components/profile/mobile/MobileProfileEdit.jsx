import { Check, MapPin, Pencil, Search, X, CheckCircle2, CircleAlert, LockKeyhole, XCircle, Camera } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userApi } from "../../../api/userApi";
import { sportApi } from "../../../api/sportApi";
import { useAuth } from "../../../contexts/AuthContext";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import BouncySelect from "../../common/BouncySelect";

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

const levelOptions = [
  { value: "beginner", label: "초급" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "상급" }
];

const NICKNAME_MAX_LENGTH = 12;

const defaultSportCategories = [
  { id: "ball", name: "구기 종목", sports: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { id: "racket", name: "라켓 스포츠", sports: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { id: "outdoor", name: "러닝 / 야외", sports: ["러닝", "등산", "트래킹", "자전거", "산책"] },
  { id: "fitness", name: "피트니스", sports: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { id: "etc", name: "기타", sports: ["볼링", "당구", "골프", "수영"] }
];

const mobileProfileFallback = {
  name: "스포츠메이트",
  phone_number: "010-0000-0000",
  nickname: "스포츠메이트",
  profile_image_url: "/images/logo.png",
  region: "서울특별시 영등포구",
  exercise_level: "intermediate",
  preferred_sports: ["러닝", "농구"],
  preferred_sport_levels: {
    러닝: "intermediate",
    농구: "beginner"
  }
};

const mockRegionResults = [
  "서울특별시 송파구 잠실동",
  "서울특별시 영등포구 여의도동",
  "경기도 수원시 영통구",
  "경기도 성남시 분당구",
  "부산광역시 해운대구"
];

function parseRegions(regionName) {
  return String(regionName || "").split(",").map((region) => region.trim()).filter(Boolean);
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `[${normalized}]` : "";
}

function isEmailOnlyProvider(user) {
  return String(user?.provider || "").trim().toLowerCase() === "email";
}

function MobileProfileEdit() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const canChangePassword = isEmailOnlyProvider(user);
  
  const introStorageKey = user?.id ? `sportsmate_profile_extra_${user.id}` : "sportsmate_profile_extra_guest";
  const savedIntro = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(introStorageKey) || "{}").intro || "러닝 · 농구 · 등산을 좋아해요";
    } catch {
      return "러닝 · 농구 · 등산을 좋아해요";
    }
  }, [introStorageKey]);
  const selectedSportNames = useMemo(
    () => (user?.profile?.preferred_sports || "").split(",").map((sport) => sport.trim()).filter(Boolean),
    [user?.profile?.preferred_sports]
  );
  const initialRegion = user?.profile?.region || mobileProfileFallback.region;
  const initialRegions = parseRegions(initialRegion);
  
  const [form, setForm] = useState({
    name: user?.name || mobileProfileFallback.name,
    phone_number: user?.phone_number || mobileProfileFallback.phone_number,
    nickname: (user?.nickname || mobileProfileFallback.nickname).slice(0, NICKNAME_MAX_LENGTH),
    profile_image_url: user?.profile_image_url || mobileProfileFallback.profile_image_url,
    region: initialRegion,
    selected_regions: initialRegions.length ? initialRegions : [mobileProfileFallback.region],
    exercise_level: user?.profile?.exercise_level || mobileProfileFallback.exercise_level,
    preferred_sports: selectedSportNames.length ? selectedSportNames : mobileProfileFallback.preferred_sports,
    preferred_sport_levels: user?.profile?.preferred_sport_levels || mobileProfileFallback.preferred_sport_levels
  });
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(defaultSportCategories[0].id);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState("idle");
  const [regionQuery, setRegionQuery] = useState("");
  const [regionResults, setRegionResults] = useState([]);
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
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ next: "", code: "" });
  const [phoneStatus, setPhoneStatus] = useState("idle");
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawText, setWithdrawText] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState("idle");
  
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      update("profile_image_url", reader.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    Promise.all([sportApi.categories(), sportApi.sports()])
      .then(([categoryData, sportData]) => {
        const nextCategories = categoryData.items || [];
        setCategories(nextCategories);
        setSports(sportData.items || []);
        if (nextCategories[0]?.id) {
          setActiveCategoryId(nextCategories[0].id);
        }
      })
      .catch(() => {
        setCategories([]);
        setSports([]);
      });
  }, []);

  const sportCategoryGroups = categories.length
    ? categories.map((category) => ({
        id: category.id,
        name: category.name,
        sports: sports.filter((sport) => sport.category_id === category.id).map((sport) => sport.name)
      }))
    : defaultSportCategories;
  const activeSportGroup = sportCategoryGroups.find((group) => group.id === activeCategoryId) || sportCategoryGroups[0];
  const pendingRegion = regionQuery || form.selected_regions[0] || "전국";
  const displayTag = tagLabel(user);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const addRegion = (regionName) => {
    setForm((current) => {
      const nextRegion = regionName.trim();
      if (!nextRegion) return current;
      const nextRegions = current.selected_regions.includes(nextRegion)
        ? current.selected_regions
        : [...current.selected_regions, nextRegion];

      return {
        ...current,
        region: nextRegions.join(", "),
        selected_regions: nextRegions
      };
    });
    setRegionQuery("");
    setRegionResults([]);
  };

  const updateNickname = (value) => {
    update("nickname", value.slice(0, NICKNAME_MAX_LENGTH));
    setNicknameStatus("idle");
  };

  const checkNickname = () => {
    // 2026-06-29: 백엔드 중복 확인 API 연결 전까지 PC 프론트 흐름만 확인하는 mock 상태.
    const normalized = form.nickname.trim();
    if (!normalized) {
      setNicknameStatus("empty");
      return;
    }
    setNicknameStatus(normalized === "운동메이트" ? "duplicate" : "available");
  };

  const searchRegion = () => {
    const normalized = regionQuery.trim();
    if (!normalized) {
      setRegionResults([]);
      return;
    }
    const nextResults = mockRegionResults.filter((regionName) => regionName.includes(normalized));
    setRegionResults(nextResults.length ? nextResults : [normalized]);
  };

  const updatePassword = (key, value) => {
    setPasswordStatus("idle");
    setPasswordForm((current) => ({ ...current, [key]: value }));
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

  const openPhoneChange = () => {
    setPhoneForm({ next: form.phone_number, code: "" });
    setPhoneStatus("idle");
    setPhoneModalOpen(true);
  };

  const updatePhoneForm = (key, value) => {
    setPhoneStatus("idle");
    setPhoneForm((current) => ({ ...current, [key]: value }));
  };

  const submitPhoneChange = () => {
    // 2026-06-30: 실제 휴대폰 인증 API 연결 전까지 번호 변경 모달 흐름만 mock 처리.
    if (!phoneForm.next.trim() || !phoneForm.code.trim()) {
      setPhoneStatus("empty");
      return;
    }
    update("phone_number", phoneForm.next.trim());
    setPhoneStatus("success");
  };

  const submitWithdraw = async () => {
    if (withdrawText.trim() !== "탈퇴합니다") {
      setWithdrawStatus("mismatch");
      return;
    }
    
    try {
      await userApi.deleteMe();
      setWithdrawStatus("success");
      setTimeout(async () => {
        try {
          await logout();
          sessionStorage.setItem("sportsmate_flash", "회원 탈퇴가 완료되었습니다.");
          navigate("/login", { replace: true });
        } catch (e) {
          console.error("Failed to logout after withdraw:", e);
        }
      }, 1500);
    } catch (e) {
      console.error("Withdraw failed:", e);
      setWithdrawStatus("mismatch");
    }
  };

  const removeRegion = (regionName) => {
    setForm((current) => {
      const nextRegions = current.selected_regions.filter((region) => region !== regionName);
      return {
        ...current,
        region: nextRegions.join(", "),
        selected_regions: nextRegions
      };
    });
  };

  const toggleSport = (sportName) => {
    setForm((current) => {
      const exists = current.preferred_sports.includes(sportName);
      const nextSports = exists
        ? current.preferred_sports.filter((name) => name !== sportName)
        : [...current.preferred_sports, sportName];
      const nextLevels = { ...current.preferred_sport_levels };

      if (exists) {
        delete nextLevels[sportName];
      } else {
        nextLevels[sportName] = nextLevels[sportName] || current.exercise_level;
      }

      return { ...current, preferred_sports: nextSports, preferred_sport_levels: nextLevels };
    });
  };

  const updateSportLevel = (sportName, level) => {
    setForm((current) => ({
      ...current,
      preferred_sport_levels: {
        ...current.preferred_sport_levels,
        [sportName]: level
      }
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!user) {
      navigate("/mypage");
      return;
    }

    const data = await userApi.updateMe({
      name: form.name,
      phone_number: form.phone_number,
      nickname: form.nickname,
      profile_image_url: form.profile_image_url,
      region: form.region,
      exercise_level: form.exercise_level,
      preferred_sports: form.preferred_sports.join(", "),
      preferred_sport_levels: form.preferred_sport_levels
    });
    setCurrentUser(data.user);
    navigate("/mypage");
  };

  return (
    <form className="mobile-profile-edit" onSubmit={submit}>
      <div className="screen-title mobile-profile-edit__title">
        <div>
          <h1>프로필 수정</h1>
          <span>내 정보에 표시될 기본 정보와 운동 성향을 정리합니다.</span>
        </div>
        <div>
          <Link className="ghost-btn" to="/mypage">취소</Link>
          <button className="primary-small" type="submit"><Check size={15} />저장</button>
        </div>
      </div>

      <section className="page-card mobile-profile-top-card">
        <div className="section-head">
          <h2>기본 정보</h2>
        </div>
        <div className="mobile-profile-top-content">
          <div className="mobile-profile-preview">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={form.profile_image_url || "/images/logo.png"} alt="프로필 미리보기" style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()} />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  background: '#4f46e5',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <Camera size={14} />
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleImageChange} 
            />
            <h2>{form.nickname || "닉네임"}</h2>
            <p>{savedIntro}</p>
          </div>

          <div className="mobile-profile-basic-panel">
          {/* 2026-06-30: 읽기 전용 계정 정보, 수정 가능한 닉네임, 인증형 연락처 순서로 기본 정보를 정리. */}
            <div className="mobile-profile-form-grid mobile-basic-info-grid">
              <label>
                이름
                <div className="mobile-basic-action-row">
                  <span className="mobile-readonly-field">{form.name}</span>
                  <span aria-hidden="true" />
                </div>
              </label>
              <label>
                이메일
                <div className="mobile-basic-action-row">
                  <span className="mobile-readonly-field">{user?.email || "demo@sportsmate.kr"}</span>
                  <span aria-hidden="true" />
                </div>
              </label>
              <label>
                닉네임
                <div className="mobile-basic-action-row">
                  <span className="mobile-edit-input mobile-edit-input--counted">
                    <input maxLength={NICKNAME_MAX_LENGTH} value={form.nickname} onChange={(event) => updateNickname(event.target.value)} />
                    <em>{form.nickname.length}/{NICKNAME_MAX_LENGTH}</em>
                    <Pencil size={15} />
                  </span>
                  <button type="button" onClick={checkNickname}>중복 확인</button>
                </div>
                {nicknameStatus === "available" && <em className="nickname-check ok">사용 가능한 닉네임입니다.</em>}
                {nicknameStatus === "duplicate" && <em className="nickname-check warn">이미 사용 중인 닉네임입니다.</em>}
                {nicknameStatus === "empty" && <em className="nickname-check warn">닉네임을 입력해주세요.</em>}
              </label>
              <label>
                핸드폰 번호
                <div className="mobile-basic-action-row">
                  <span className="mobile-readonly-field">{form.phone_number}</span>
                  <button type="button" onClick={openPhoneChange}>번호 변경</button>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card mobile-profile-edit-panel">
        <div className="section-head">
          <h2>선호 지역</h2>
        </div>
        <div className="mobile-region-picker">
          <label className="mobile-region-search-field">
            장소 또는 주소 검색
            <span className="mobile-region-search-box">
              <Search size={16} />
              <input
                value={regionQuery}
                placeholder="운동하고 싶은 지역이나 장소를 검색해보세요"
                onChange={(event) => setRegionQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), searchRegion())}
              />
            </span>
          </label>
          <button className="primary-small" type="button" onClick={searchRegion}>검색</button>
          <button className="mobile-map-toggle" type="button" onClick={() => setShowMapPreview((current) => !current)}>
            <MapPin size={14} />
            {showMapPreview ? "지도 접기" : "지도에서 선택"}
          </button>
        </div>
        {regionResults.length > 0 && (
          <div className="mobile-region-results">
            {regionResults.map((regionName) => (
              <button key={regionName} type="button" onClick={() => addRegion(regionName)}>
                <MapPin size={14} />
                {regionName}
              </button>
            ))}
          </div>
        )}
        <div className="mobile-region-selected">
          {form.selected_regions.length ? form.selected_regions.map((regionName) => (
            <button key={regionName} type="button" onClick={() => removeRegion(regionName)}>
              {regionName}
              <X size={14} />
            </button>
          )) : <span>선택된 지역이 없습니다.</span>}
        </div>
        {showMapPreview && (
          <div className="mobile-profile-map-preview">
            <div className="map-current-label"><MapPin size={15} />{pendingRegion} 기준</div>
            <div className="map-pin p1"><MapPin size={19} /></div>
            <div className="map-pin p2"><MapPin size={19} /></div>
            <div className="map-pin p3"><MapPin size={19} /></div>
            <div className="map-center" />
          </div>
        )}
      </section>

      <section className="page-card mobile-profile-edit-panel">
        <div className="section-head">
          <h2>운동 설정</h2>
        </div>
        <div className="mobile-profile-form-grid mobile-level-grid">
          <label>
            기본 운동 수준
            <div style={{ marginTop: '8px' }}>
              <BouncySelect 
                value={form.exercise_level} 
                onChange={(value) => update("exercise_level", value)}
                placeholder="수준 선택"
                options={levelOptions}
              />
            </div>
          </label>
        </div>
        <div className="mobile-profile-sport-section">
          <span className="mobile-subsection-title">관심 종목</span>
          <div className="mobile-sport-category-tabs">
            {sportCategoryGroups.map((group) => (
              <button
                key={group.id}
                className={activeSportGroup?.id === group.id ? "is-active" : ""}
                type="button"
                onClick={() => setActiveCategoryId(group.id)}
              >
                {group.name}
              </button>
            ))}
          </div>
          <div className="mobile-profile-sport-grid" key={activeSportGroup?.id}>
            {(activeSportGroup?.sports || []).map((sportName) => (
              <button
                key={sportName}
                className={form.preferred_sports.includes(sportName) ? "is-active" : ""}
                type="button"
                onClick={() => toggleSport(sportName)}
              >
                {sportName}
              </button>
            ))}
          </div>
        </div>
        {form.preferred_sports.length > 0 && (
          <>
          <span className="mobile-subsection-title">선택한 종목별 수준</span>
          <div className="mobile-profile-selected-sports">
            {form.preferred_sports.map((sportName) => (
              <div key={sportName}>
                <button type="button" onClick={() => toggleSport(sportName)}>
                  {sportName}
                  <X size={14} />
                </button>
                <div style={{ minWidth: '120px' }}>
                  <BouncySelect
                    value={form.preferred_sport_levels[sportName] || form.exercise_level}
                    onChange={(value) => updateSportLevel(sportName, value)}
                    placeholder="수준 선택"
                    options={levelOptions}
                  />
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </section>
      <section className="page-card mobile-profile-edit-panel mobile-account-security-panel">
        <div className="section-head">
          <h2>계정 보안</h2>
        </div>
        {canChangePassword && (
          <div className="mobile-security-section">
            <span>
              <strong>비밀번호</strong>
              <small>로그인 비밀번호는 별도 확인 후 변경할 수 있습니다.</small>
            </span>
            <button type="button" onClick={() => setPasswordModalOpen(true)}>비밀번호 변경</button>
          </div>
        )}
        <div className="mobile-security-section mobile-security-section--danger">
          <span>
            <strong>회원 탈퇴</strong>
            <small>탈퇴 요청은 최종 확인 후 처리됩니다.</small>
          </span>
          <button type="button" onClick={() => setWithdrawModalOpen(true)} style={{ color: 'white', backgroundColor: '#ef4444', border: 'none' }}>회원 탈퇴</button>
        </div>
      </section>
      {canChangePassword && passwordModalOpen && (
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
      {phoneModalOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPhoneModalOpen(false)}>
          <section className="profile-auth-modal password-change-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setPhoneModalOpen(false)}><X size={18} /></button>
            <h2>핸드폰 번호 변경</h2>
            <p>새 번호를 입력하고 인증번호 확인까지 완료하면 변경됩니다. 지금은 프론트 확인 흐름만 동작합니다.</p>
            <label>
              새 핸드폰 번호
              <input value={phoneForm.next} onChange={(event) => updatePhoneForm("next", event.target.value)} placeholder="010-0000-0000" />
            </label>
            <label>
              인증번호
              <input value={phoneForm.code} onChange={(event) => updatePhoneForm("code", event.target.value)} placeholder="인증번호 입력" />
            </label>
            {phoneStatus === "empty" && <em className="nickname-check warn">새 번호와 인증번호를 입력해주세요.</em>}
            {phoneStatus === "success" && <em className="nickname-check ok">핸드폰 번호 변경 흐름이 확인되었습니다.</em>}
            <div>
              <button className="ghost-btn" type="button" onClick={() => setPhoneModalOpen(false)}>취소</button>
              <button className="primary-small" type="button" onClick={submitPhoneChange}>변경 완료</button>
            </div>
          </section>
        </div>
      )}
      {withdrawModalOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setWithdrawModalOpen(false)}>
          <section className="profile-auth-modal password-change-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setWithdrawModalOpen(false)}><X size={18} /></button>
            <h2>회원 탈퇴</h2>
            <p>회원 탈퇴는 신중하게 확인해야 하는 작업입니다.</p>
            <label>
              확인 문구
              <input
                value={withdrawText}
                placeholder="탈퇴합니다"
                onChange={(event) => {
                  setWithdrawText(event.target.value);
                  setWithdrawStatus("idle");
                }}
              />
            </label>
            {withdrawStatus === "mismatch" && <em className="nickname-check warn">확인 문구를 정확히 입력해주세요.</em>}
            {withdrawStatus === "success" && <em className="nickname-check ok">회원 탈퇴 확인 흐름이 완료되었습니다.</em>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="ghost-btn" type="button" onClick={() => setWithdrawModalOpen(false)}>취소</button>
              <button className="primary-small danger-small" type="button" onClick={submitWithdraw} style={{ background: '#ef4444', color: 'white', border: 'none' }}>탈퇴 확인</button>
            </div>
          </section>
        </div>
      )}

      {/* Local Toast Alert Notification */}
      {toast && (
        <div 
          className="app-toast" 
          role="status" 
          aria-live="polite" 
          style={{ 
            position: 'fixed', 
            bottom: '40px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            background: 'rgba(15, 23, 42, 0.95)', 
            color: '#fff', 
            padding: '12px 24px', 
            borderRadius: '30px', 
            fontSize: '14px', 
            fontWeight: '800', 
            zIndex: 999999, 
            whiteSpace: 'nowrap', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)' 
          }}
        >
          {toast}
        </div>
      )}
    </form>
  );
}

export default MobileProfileEdit;
