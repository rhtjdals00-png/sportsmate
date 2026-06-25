import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { userApi } from "../api/userApi";
import { useAsync } from "../hooks/useAsync";

function MyReviewsPage() {
  const reviews = useAsync(() => userApi.myReviews(), []);

  return (
    <>
      <MobileHeader title="내 후기" />
      {reviews.loading ? (
        <LoadingCards count={2} />
      ) : reviews.data?.items?.length ? (
        <div className="review-list page-list">
          {reviews.data.items.map((review) => (
            <article key={review.id}>
              <strong>{review.rating}점</strong>
              <p>{review.content}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="작성한 후기가 없습니다." description="참여한 모임 상세 화면에서 후기를 작성할 수 있습니다." actionLabel="내 모임 보기" actionTo="/mypage/meetings" />
      )}
    </>
  );
}

export default MyReviewsPage;
