import { ArrowRight, CheckCircle2, MapPin, Sparkles, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `[${normalized}]` : "";
}

function ProfileIntroPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.nickname || user?.name || "스포츠메이트";
  const displayTag = tagLabel(user);

  return (
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
            <Trophy size={54} />
          </div>
          <div className="profile-intro__ring" />
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

          <div className="profile-intro__actions">
            <Button type="button" onClick={() => navigate("/profile/setup")}>
              작성하기 <ArrowRight size={18} />
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/", { replace: true })}>
              건너뛰기
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProfileIntroPage;
