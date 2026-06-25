import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { adminApi } from "../../../api/adminApi";
import { useAsync } from "../../../hooks/useAsync";

function DesktopAdminPanel({ title = "관리자" }) {
  const users = useAsync(() => adminApi.users(), []);
  const meetings = useAsync(() => adminApi.meetings(), []);
  const reports = useAsync(() => adminApi.reports(), []);
  const loading = users.loading || meetings.loading || reports.loading;

  return (
    <>
      <MobileHeader title={title} />
      {loading ? (
        <LoadingCards count={2} />
      ) : (
        <>
          <section className="admin-panel">
            <div><strong>회원</strong><span>{users.data?.items?.length || 0}</span></div>
            <div><strong>모임</strong><span>{meetings.data?.items?.length || 0}</span></div>
            <div><strong>신고</strong><span>{reports.data?.items?.length || 0}</span></div>
          </section>
          <section className="admin-table">
            <h2>최근 신고</h2>
            {(reports.data?.items || []).map((report) => (
              <article key={report.id}>
                <strong>{report.target_type} #{report.target_id}</strong>
                <p>{report.reason}</p>
                <span>{report.status}</span>
              </article>
            ))}
            {!reports.data?.items?.length && <p className="subtle-text">접수된 신고가 없습니다.</p>}
          </section>
        </>
      )}
    </>
  );
}

export default DesktopAdminPanel;
