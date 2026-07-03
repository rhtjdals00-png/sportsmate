import { Check, MapPin, Pencil, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { userApi } from "../../../api/userApi";
import { sportApi } from "../../../api/sportApi";
import { useAuth } from "../../../contexts/AuthContext";

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

function MobileProfileEdit() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
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
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ next: "", code: "" });
  const [phoneStatus, setPhoneStatus] = useState("idle");
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawText, setWithdrawText] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState("idle");

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

  const submitPasswordChange = () => {
    // 2026-06-29: 비밀번호 변경 API 연결 전까지 PC 프론트 모달 흐름만 mock 처리.
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

  const submitWithdraw = () => {
    // 2026-06-29: 회원 탈퇴는 백엔드 연결 전까지 실수 방지용 확인 흐름만 제공.
    if (withdrawText.trim() !== "탈퇴합니다") {
      setWithdrawStatus("mismatch");
      return;
    }
    setWithdrawStatus("success");
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
            <img src={form.profile_image_url || "/images/logo.png"} alt="프로필 미리보기" />
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
            <select value={form.exercise_level} onChange={(event) => update("exercise_level", event.target.value)}>
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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
                <select
                  aria-label={`${sportName} 운동 수준`}
                  value={form.preferred_sport_levels[sportName] || form.exercise_level}
                  onChange={(event) => updateSportLevel(sportName, event.target.value)}
                >
                  {levelOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
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
        <div className="mobile-security-section">
          <span>
            <strong>비밀번호</strong>
            <small>로그인 비밀번호는 별도 확인 후 변경할 수 있습니다.</small>
          </span>
          <button type="button" onClick={() => setPasswordModalOpen(true)}>비밀번호 변경</button>
        </div>
        <div className="mobile-security-section mobile-security-section--danger">
          <span>
            <strong>회원 탈퇴</strong>
            <small>탈퇴 요청은 최종 확인 후 처리됩니다.</small>
          </span>
          <button type="button" onClick={() => setWithdrawModalOpen(true)}>회원 탈퇴</button>
        </div>
      </section>
      {passwordModalOpen && (
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
            {passwordStatus === "empty" && <em className="nickname-check warn">모든 비밀번호 항목을 입력해주세요.</em>}
            {passwordStatus === "mismatch" && <em className="nickname-check warn">새 비밀번호가 일치하지 않습니다.</em>}
            {passwordStatus === "success" && <em className="nickname-check ok">비밀번호 변경 흐름이 확인되었습니다.</em>}
            <div>
              <button className="ghost-btn" type="button" onClick={() => setPasswordModalOpen(false)}>취소</button>
              <button className="primary-small" type="button" onClick={submitPasswordChange}>변경하기</button>
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
            <p>회원 탈퇴는 신중하게 확인해야 하는 작업입니다. 지금은 프론트 확인 흐름만 동작합니다.</p>
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
            <div>
              <button className="ghost-btn" type="button" onClick={() => setWithdrawModalOpen(false)}>취소</button>
              <button className="primary-small danger-small" type="button" onClick={submitWithdraw}>탈퇴 확인</button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}

export default MobileProfileEdit;
