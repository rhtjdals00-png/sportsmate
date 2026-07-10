import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { userApi } from "../api/userApi";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";

function MyReviewsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [subTab, setSubTab] = useState("written"); // "written" | "received"
  const [writingReview, setWritingReview] = useState(null); // { meetingId, peerId, peerNickname, meetingTitle }
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");

  const writtenReviewsState = useAsync(() => userApi.myWrittenReviews(), [refreshKey]);
  const receivedReviewsState = useAsync(() => userApi.myReceivedReviews(), [refreshKey]);
  const pendingReviewsState = useAsync(() => userApi.myPendingReviews(), [refreshKey]);

  const loading = writtenReviewsState.loading || receivedReviewsState.loading || pendingReviewsState.loading;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!writingReview) return;
    try {
      if (writingReview.isEdit) {
        await userApi.updateReview(writingReview.id, {
          rating,
          content: reviewContent
        });
        alert("후기가 수정되었습니다.");
      } else {
        await meetingApi.createReview(writingReview.meetingId, {
          reviewee_id: writingReview.peerId,
          rating,
          content: reviewContent
        });
        alert("후기가 등록되었습니다.");
      }
      setWritingReview(null);
      setReviewContent("");
      setRating(5);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || "후기 처리 중 오류가 발생했습니다.");
    }
  };

  const handleEditReviewOpen = (review) => {
    setRating(review.rating);
    setReviewContent(review.content);
    setWritingReview({
      id: review.id,
      peerNickname: review.reviewee?.nickname || review.reviewee?.name || "사용자",
      meetingTitle: review.meeting?.title || "모임",
      isEdit: true
    });
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("후기를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return;
    try {
      await userApi.deleteReview(reviewId);
      alert("후기가 삭제되었습니다.");
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || "후기 삭제에 실패했습니다.");
    }
  };

  const writtenReviews = writtenReviewsState.data?.items || [];
  const receivedReviews = receivedReviewsState.data?.items || [];
  const pendingReviews = pendingReviewsState.data?.items || [];

  const pendingReviewsByMeeting = useMemo(() => {
    const grouped = {};
    for (const item of pendingReviews) {
      const mId = item.meeting.id;
      if (!grouped[mId]) {
        grouped[mId] = {
          meeting: item.meeting,
          peers: []
        };
      }
      grouped[mId].peers.push(item.peer);
    }
    return Object.values(grouped).sort((a, b) => {
      const timeA = new Date(a.meeting.start_time || 0);
      const timeB = new Date(b.meeting.start_time || 0);
      return timeB - timeA;
    });
  }, [pendingReviews]);

  return (
    <>
      <MobileHeader title="내 후기" />
      
      {/* Sub tabs */}
      <div style={{ display: "flex", width: "100%", borderBottom: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}>
        <button
          type="button"
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            borderBottom: subTab === "written" ? "2px solid #3b82f6" : "2px solid transparent",
            backgroundColor: "transparent",
            color: subTab === "written" ? "#3b82f6" : "#4b5563",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            textAlign: "center"
          }}
          onClick={() => setSubTab("written")}
        >
          내가 작성한 후기
        </button>
        <button
          type="button"
          style={{
            flex: 1,
            padding: "12px",
            border: "none",
            borderBottom: subTab === "received" ? "2px solid #3b82f6" : "2px solid transparent",
            backgroundColor: "transparent",
            color: subTab === "received" ? "#3b82f6" : "#4b5563",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            textAlign: "center"
          }}
          onClick={() => setSubTab("received")}
        >
          내가 받은 후기
        </button>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading ? (
          <LoadingCards count={2} />
        ) : (
          <>
            {subTab === "written" && (
              <>
                {/* Pending reviews */}
                {pendingReviewsByMeeting.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "10px" }}>
                    <h4 style={{ fontSize: "14px", fontWeight: "bold", margin: "0 0 4px 0", color: "#111827" }}>작성 가능한 후기</h4>
                    {pendingReviewsByMeeting.map((group) => (
                      <div key={group.meeting.id} style={{ backgroundColor: "#f9fafb", borderRadius: "12px", padding: "16px", border: "1px solid #e5e7eb" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #e5e7eb", paddingBottom: "10px", marginBottom: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "bold", color: "#0369a1", backgroundColor: "#e0f2fe", padding: "2px 8px", borderRadius: "4px" }}>모임</span>
                          <span style={{ fontSize: "13px", fontWeight: "bold", color: "#1f2937" }}>{group.meeting.title}</span>
                          {group.meeting.start_time && (
                            <span style={{ fontSize: "13px", fontWeight: "500", color: "#4b5563", marginLeft: "auto" }}>
                              {new Date(group.meeting.start_time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {group.peers.map((peer) => (
                            <div key={peer.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #f3f4f6", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>{peer.nickname || peer.name || "사용자"}님</span>
                              <button
                                type="button"
                                style={{ backgroundColor: "#3b82f6", color: "#ffffff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                onClick={() => setWritingReview({
                                  meetingId: group.meeting.id,
                                  peerId: peer.id,
                                  peerNickname: peer.nickname || peer.name || "사용자",
                                  meetingTitle: group.meeting.title
                                })}
                              >
                                후기 작성
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Written reviews list */}
                {writtenReviews.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {writtenReviews.map((review) => (
                      <article key={review.id} style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f3f4f6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>{review.meeting?.title || "모임"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "#eab308" }}>★ {review.rating}점</span>
                            <span style={{ color: "#d1d5db", fontSize: "11px" }}>|</span>
                            <button
                              type="button"
                              style={{ border: "none", background: "none", padding: "0 4px", fontSize: "12px", color: "#3b82f6", cursor: "pointer", fontWeight: "600" }}
                              onClick={() => handleEditReviewOpen(review)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              style={{ border: "none", background: "none", padding: "0 4px", fontSize: "12px", color: "#ef4444", cursor: "pointer", fontWeight: "600" }}
                              onClick={() => handleDeleteReview(review.id)}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#1f2937" }}>{review.reviewee?.nickname || review.reviewee?.name || "사용자"}님에게 남긴 후기</h4>
                        <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#4b5563", lineHeight: "1.5" }}>{review.content}</p>
                        <Link to={`/meetings/${review.meeting_id}`} style={{ fontSize: "12px", color: "#3b82f6", textDecoration: "none", fontWeight: "600" }}>모임 상세 보기 →</Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="작성한 후기가 없습니다." description="종료된 모임 멤버들에게 후기를 남길 수 있습니다." actionLabel="내 모임 보기" actionTo="/mypage/meetings" />
                )}
              </>
            )}

            {subTab === "received" && (
              <>
                {receivedReviews.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {receivedReviews.map((review) => (
                      <article key={review.id} style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #f3f4f6" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>{review.meeting?.title || "모임"}</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#eab308" }}>★ {review.rating}점</span>
                        </div>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#1f2937" }}>익명의 메이트로부터 받은 후기</h4>
                        <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#4b5563", lineHeight: "1.5" }}>{review.content}</p>
                        <Link to={`/meetings/${review.meeting_id}`} style={{ fontSize: "12px", color: "#3b82f6", textDecoration: "none", fontWeight: "600" }}>모임 상세 보기 →</Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="받은 후기가 없습니다." description="다른 참여자들의 생생한 후기를 모아보세요." actionLabel="내 모임 보기" actionTo="/mypage/meetings" />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Review Writing Modal */}
      {writingReview && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
            zIndex: 1000
          }}
          onMouseDown={(e) => e.target === e.currentTarget && setWritingReview(null)}
        >
          <form
            onSubmit={handleReviewSubmit}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "400px",
              padding: "20px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)"
            }}
          >
            <button
              type="button"
              onClick={() => setWritingReview(null)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                padding: "4px"
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingRight: "24px" }}>
              <span style={{ fontSize: "11px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{writingReview.meetingTitle}</span>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#111827" }}>{writingReview.peerNickname}님 후기 작성</h2>
            </div>
            
            <p style={{ margin: 0, fontSize: "13px", color: "#4b5563" }}>이 메이트와의 운동 경험은 어떠셨나요? 솔직한 후기를 남겨주세요.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>평점 선택</label>
              <select 
                value={rating} 
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px" }}
              >
                <option value={5}>★ 5점 (최고예요)</option>
                <option value={4}>★ 4점 (좋아요)</option>
                <option value={3}>★ 3점 (보통이에요)</option>
                <option value={2}>★ 2점 (별로예요)</option>
                <option value={1}>★ 1점 (최악이에요)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>후기 내용</label>
              <textarea
                required
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                placeholder="운동 매너, 소통, 참여도 등에 대해 남겨주세요."
                style={{ padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", minHeight: "100px", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setWritingReview(null)}
                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#4b5563", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
              >
                취소
              </button>
              <button
                type="submit"
                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", backgroundColor: "#3b82f6", color: "#ffffff", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}
              >
                작성 완료
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default MyReviewsPage;
