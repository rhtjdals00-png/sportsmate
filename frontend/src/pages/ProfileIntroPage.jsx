import { ArrowRight, CalendarClock, CheckCircle2, MapPin, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { userApi } from "../api/userApi";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive.js";

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `#${normalized}` : "";
}

function ProfileIntroPage() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const { isMobile } = useResponsive();
  const [savingAction, setSavingAction] = useState("");
  const [error, setError] = useState("");
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const displayName = user?.nickname || user?.name || "스포츠메이트";
  const displayTag = tagLabel(user);

  const updateIntroPreference = async (action) => {
    setSavingAction(action);
    setError("");
    try {
      const data = await userApi.updateProfileIntroPreference({ action });
      setCurrentUser(data.user);
      navigate("/", { replace: true });
    } catch (preferenceError) {
      setError(preferenceError?.response?.data?.message || "설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSavingAction("");
    }
  };

  return (
    <>
      {isMobile ? <MobileHeader title="프로필 완성" /> : null}
      <main className="profile-intro-page">
        <section className="profile-intro">
          <div className="profile-intro__visual" aria-hidden="true">
            <div className="profile-intro__orbit profile-intro__orbit--one">
              <Sparkles size={28} />
            </div>
            <div className="profile-intro__orbit profile-intro__orbit--two">
              <MapPin size={26} />
            </div>
            <div className="profile-intro__medal">
              <img src="/images/logo.png" alt="" />
            </div>
            <div className="profile-intro__ring" />
            <div className="profile-intro__route">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="profile-intro__content">
            <p className="profile-setup__eyebrow">프로필 완성</p>
            <h1>
              {displayName}
              {displayTag ? <span>{displayTag}</span> : null}
              님, 맞춤 운동 메이트를 준비할까요?
            </h1>
            <p>
              활동 지역, 운동 수준, 선호 종목을 입력하면 모임 추천과 매칭 품질이 더 좋아집니다.
              지금 입력하지 않아도 나중에 마이페이지에서 언제든 완성할 수 있어요.
            </p>

            <div className="profile-intro__checks">
              <span><CheckCircle2 size={17} /> 지역 기반 모임 추천</span>
              <span><CheckCircle2 size={17} /> 선호 종목 매칭</span>
              <span><CheckCircle2 size={17} /> 운동 수준 반영</span>
            </div>

            <div className="profile-intro__preview" aria-hidden="true">
              <span><MapPin size={16} /> 활동 지역</span>
              <span><Trophy size={16} /> 운동 수준</span>
              <span><CalendarClock size={16} /> 선호 일정</span>
            </div>

            {error ? <p className="profile-intro__error">{error}</p> : null}

            <div className="profile-intro__actions">
              <Button type="button" onClick={() => navigate("/profile/setup")}>
                작성하기 <ArrowRight size={18} />
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSkipConfirmOpen(true)} disabled={Boolean(savingAction)}>
                건너뛰기
              </Button>
            </div>
          </div>
        </section>
        {skipConfirmOpen ? (
          <div className="profile-intro-skip-modal" role="dialog" aria-modal="true" aria-labelledby="profile-intro-skip-title">
            <button className="profile-intro-skip-modal__backdrop" type="button" onClick={() => setSkipConfirmOpen(false)} aria-label="닫기" />
            <section className="profile-intro-skip-modal__panel">
              <div className="profile-intro-skip-modal__mark">
                <img src="/images/logo.png" alt="" />
              </div>
              <h2 id="profile-intro-skip-title">나중에 마이페이지에서 완성할 수 있어요</h2>
              <p>활동 지역, 운동 수준, 선호 종목은 마이페이지의 내 정보에서 언제든 다시 입력할 수 있습니다.</p>
              <div>
                <Button type="button" variant="ghost" onClick={() => setSkipConfirmOpen(false)} disabled={Boolean(savingAction)}>
                  계속 작성하기
                </Button>
                <Button type="button" onClick={() => updateIntroPreference("dismiss")} disabled={Boolean(savingAction)}>
                  {savingAction === "dismiss" ? "처리 중" : "건너뛰기"}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}

export default ProfileIntroPage;
