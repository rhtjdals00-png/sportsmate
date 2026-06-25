import EmptyState from "../components/common/EmptyState.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";

function NotFoundPage() {
  return (
    <>
      <MobileHeader title="페이지 없음" />
      <EmptyState title="페이지를 찾을 수 없습니다." description="주소를 다시 확인해 주세요." actionLabel="홈으로 이동" actionTo="/" />
    </>
  );
}

export default NotFoundPage;

