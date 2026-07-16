import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileHeader from '../../layout/mobile/MobileHeader.jsx';
import '../../../styles/18-mobile-terms.css';

const TERMS_DATA = {
  service: {
    title: '이용약관',
    content: `
# 제 1 조 (목적)
본 약관은 SportsMate(이하 "회사")가 제공하는 스포츠 모임 매칭 플랫폼 및 관련 제반 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.

# 제 2 조 (용어의 정의)
1. "서비스"라 함은 단말기(PC, 휴대형 단말기 등)와 상관없이 회원이 이용할 수 있는 SportsMate 서비스를 의미합니다.
2. "회원"이라 함은 회사의 서비스에 접속하여 본 약관에 따라 회사와 이용계약을 체결하고 회사가 제공하는 서비스를 이용하는 고객을 말합니다.
3. "호스트"라 함은 서비스를 통해 스포츠 모임을 주최하고 관리하는 회원을 말합니다.
4. "게스트"라 함은 호스트가 주최한 스포츠 모임에 참여하는 회원을 말합니다.

# 제 3 조 (서비스의 제공 및 변경)
회사는 회원에게 아래와 같은 서비스를 제공합니다.
1. 스포츠 모임 개설 및 참여 매칭 서비스
2. 모임 관련 회원 간 채팅 서비스
3. 기타 회사가 추가 개발하거나 제휴계약 등을 통해 회원에게 제공하는 일체의 서비스

# 제 4 조 (모임 참여 및 노쇼(No-Show) 정책)
1. 오프라인 운동 모임 특성상, 회원은 모임 참여 약속을 성실히 이행해야 합니다.
2. 당일 무단 불참(노쇼) 시, 호스트의 신고에 의해 회원의 매너 온도가 크게 하락할 수 있으며, 누적 시 서비스 이용이 영구 정지될 수 있습니다.

# 제 5 조 (면책 조항)
1. 회사는 회원 간의 만남과 소통을 위한 플랫폼(온라인 공간)만을 제공합니다.
2. **운동 중 발생한 신체적 부상, 사고, 혹은 회원 간에 발생한 분쟁(금전적 피해, 폭행 등)에 대하여 회사는 어떠한 법적 책임도 지지 않으며, 이는 전적으로 당사자 간에 해결해야 합니다.**
3. 회사는 천재지변 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.

# 제 6 조 (금지 행위)
회원은 다음 행위를 하여서는 안 되며, 적발 시 계정이 영구 정지될 수 있습니다.
1. 이성 만남 등 스포츠 모임 외의 불건전한 목적의 접근
2. 타인에 대한 욕설, 비방, 위협
3. 다단계 권유, 종교 포교, 상업적 상품 판매 및 홍보
    `
  },
  privacy: {
    title: '개인정보처리방침',
    content: `
# 1. 수집하는 개인정보 항목
회사는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.
- 필수항목: 이메일, 비밀번호, 닉네임, 관심 종목, 실력 수준
- 선택항목: 프로필 사진, 한줄 소개

# 2. 개인정보의 수집 및 이용 목적
회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.
- 서비스 제공에 관한 계약 이행 및 스포츠 모임 알고리즘 매칭
- 회원 관리: 본인 확인, 개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지, 가입 의사 확인, 연령 확인
- 신규 서비스 개발 및 맞춤 서비스 제공

# 3. 개인정보의 제3자 제공 (필수 고지)
회사는 원칙적으로 유저의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.
- **모임 매칭 시:** 회원이 특정 모임에 참여를 신청할 경우, 해당 모임의 원활한 운영을 위해 **모임의 호스트(방장)에게 회원의 닉네임, 프로필 사진, 관심 종목, 실력 수준 등의 필수 정보가 제공**됩니다.
- 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우

# 4. 개인정보의 보유 및 파기
- 원칙적으로 개인정보 수집 및 이용목적이 달성된 후(회원 탈퇴 시)에는 해당 정보를 지체 없이 파기합니다.
- 단, 노쇼 및 불량 이용으로 인한 강제 탈퇴 회원의 경우, 재가입 방지를 위해 6개월간 일방향 암호화(해시)된 형태로 식별 정보를 보관합니다.
    `
  },
  location: {
    title: '위치기반서비스 이용약관',
    content: `
# 제 1 조 (목적)
본 약관은 SportsMate(이하 "회사")가 제공하는 위치기반서비스와 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

# 제 2 조 (위치정보 수집 방법)
회사는 회원이 앱 실행 시 GPS 등 기기의 위치 정보 제공에 동의한 경우에 한해 실시간 위치 정보를 수집합니다.

# 제 3 조 (위치정보의 이용 목적 및 보안)
1. 수집된 위치 정보는 다음과 같은 목적을 위해 1회성으로만 사용됩니다.
   - 내 주변(동네) 스포츠 모임 검색 및 거리순 정렬 기능
   - 현재 접속 위치 기반의 날씨 데이터 제공
2. **회사는 유저의 현재 위치를 서버에 영구적으로 저장하거나 동선을 추적하지 않습니다.**
3. 검색 및 조회에 활용된 실시간 위치 데이터는 목적 달성 즉시 휘발성으로 폐기됩니다.
    `
  }
};

function MobileTermsPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const currentData = TERMS_DATA[type];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  if (!currentData) {
    return (
      <>
        <MobileHeader title="알 수 없는 페이지" onBack={() => navigate(-1)} />
        <div className="mobile-terms-page">
          <div className="mobile-terms-content">
            <p>잘못된 접근입니다.</p>
          </div>
        </div>
      </>
    );
  }

  // 간단한 마크다운 파싱 (엔터 및 볼드체, H1 처리)
  const renderContent = (text) => {
    return text.trim().split('\n').map((line, index) => {
      let htmlLine = line.trim();
      if (!htmlLine) return <br key={index} />;
      
      // # 제목 처리
      if (htmlLine.startsWith('# ')) {
        return <h2 key={index} className="terms-heading">{htmlLine.replace('# ', '')}</h2>;
      }
      // **볼드** 처리
      const parts = htmlLine.split(/\*\*(.*?)\*\*/g);
      
      return (
        <p key={index} className="terms-paragraph">
          {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
        </p>
      );
    });
  };

  return (
    <>
      <MobileHeader title={currentData.title} onBack={() => navigate(-1)} />
      <div className="mobile-terms-page">
        <div className="mobile-terms-content">
          {renderContent(currentData.content)}
        </div>
      </div>
    </>
  );
}

export default MobileTermsPage;
