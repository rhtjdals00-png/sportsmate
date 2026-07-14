import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CheckCircle, MessageSquareText, ShieldAlert, UserRound } from "lucide-react";
import { adminApi } from "../api/adminApi";

const statusLabel = {
  pending: "대기 중",
  in_progress: "처리 중",
  resolved: "처리 완료",
  dismissed: "반려"
};

const reportTypeLabel = {
  user: "회원 신고",
  meeting: "모임 신고",
  chat_room: "채팅방 신고"
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function displayName(user) {
  if (!user) return "정보 없음";
  return user.nickname_with_tag || user.nickname || user.name || user.email || `회원 #${user.id}`;
}

function UserRiskCard({ title, user, tone = "default" }) {
  const stats = user?.report_stats || {};
  return (
    <section className={`admin-report-detail-card ${tone === "danger" ? "is-danger" : ""}`}>
      <header>
        <span><UserRound size={16} />{title}</span>
        {user ? <Link to={`/admin/users/${user.id}`}>회원 상세</Link> : null}
      </header>
      {user ? (
        <>
          <strong>{displayName(user)}</strong>
          <p>{user.email}</p>
          <div className="admin-report-risk-grid">
            <div><b>{stats.made_total || 0}</b><span>신고한 횟수</span></div>
            <div><b>{stats.made_dismissed || 0}</b><span>반려된 신고</span></div>
            <div><b>{stats.received_total || 0}</b><span>신고 받은 횟수</span></div>
            <div><b>{stats.received_pending || 0}</b><span>대기 중 피신고</span></div>
            <div><b>{stats.hosted_meetings || 0}</b><span>개설 모임</span></div>
            <div><b>{stats.joined_meetings || 0}</b><span>참여 모임</span></div>
          </div>
        </>
      ) : (
        <p>이 신고에는 특정 대상 회원이 연결되어 있지 않습니다.</p>
      )}
    </section>
  );
}

function ChatLogList({ title, logs, emptyText }) {
  return (
    <section className="admin-report-log-panel">
      <header>
        <span><MessageSquareText size={16} />{title}</span>
        <b>{logs.length}건</b>
      </header>
      <div>
        {logs.length ? logs.map((message) => (
          <article key={`${message.room_type}-${message.id}`}>
            <div>
              <strong>{displayName(message.sender)}</strong>
              <time>{formatDateTime(message.created_at)}</time>
            </div>
            {message.meeting ? <small>{message.meeting.title} · {message.meeting.location_name || "장소 미정"}</small> : null}
            {message.direct_room ? <small>1:1 채팅방 #{message.direct_room.id}</small> : null}
            <p>{message.message_type === "image" ? `[사진] ${message.attachment_name || ""}` : message.content}</p>
          </article>
        )) : <p className="admin-report-empty">{emptyText}</p>}
      </div>
    </section>
  );
}

function QuickActions({ reporter, targetUser, targetMeeting, targetRoom }) {
  const meeting = targetMeeting || targetRoom?.meeting;

  if (!reporter && !targetUser && !meeting) {
    return null;
  }

  return (
    <section className="admin-report-quick-actions">
      <div>
        <span><ShieldAlert size={16} />후속 조치 바로가기</span>
        <p>신고 판단을 저장한 뒤 필요한 제재나 모임 조치는 각 관리 상세 페이지에서 진행하세요.</p>
      </div>
      <div>
        {targetUser ? (
          <Link to={`/admin/users/${targetUser.id}`} className="is-danger">
            대상 회원 정지/관리 <ArrowUpRight size={15} />
          </Link>
        ) : null}
        {meeting?.id ? (
          <Link to={`/admin/meetings/${meeting.id}`}>
            대상 모임/방 관리 <ArrowUpRight size={15} />
          </Link>
        ) : null}
        {reporter ? (
          <Link to={`/admin/users/${reporter.id}`}>
            신고자 이력 확인 <ArrowUpRight size={15} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function AdminReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ status: "in_progress", admin_note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const res = await adminApi.reportDetail(reportId);
        setData(res);
        setForm({
          status: res.report?.status || "in_progress",
          admin_note: res.report?.admin_note || ""
        });
      } catch (error) {
        setMessage(error.response?.data?.message || "신고 상세 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportId]);

  const allUserLogs = useMemo(() => [
    ...(data?.user_chat_logs || []),
    ...(data?.direct_chat_logs || [])
  ], [data]);

  const saveReport = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await adminApi.updateReport(reportId, form);
      navigate("/admin/reports", {
        replace: true,
        state: { notice: res.message || "신고 처리 내용이 저장되었습니다." }
      });
    } catch (error) {
      setMessage(error.response?.data?.message || "신고 처리 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-panel-card"><div className="admin-panel-card__body">신고 상세 정보를 불러오는 중...</div></div>;
  }

  if (!data?.report) {
    return <div className="admin-panel-card"><div className="admin-panel-card__body">{message || "신고 정보를 찾지 못했습니다."}</div></div>;
  }

  const report = data.report;
  const isRoomReport = report.target_type === "chat_room";
  const isUserReport = report.target_type === "user";

  return (
    <div className="admin-report-detail">
      <div className="admin-report-detail__top">
        <button type="button" onClick={() => navigate("/admin/reports")}>
          <ArrowLeft size={16} /> 목록으로
        </button>
        <span>{reportTypeLabel[report.target_type] || "신고"} #{report.id}</span>
      </div>

      <section className="admin-report-hero">
        <div>
          <span><AlertTriangle size={16} />{statusLabel[report.status] || report.status}</span>
          <h2>{report.target_name}</h2>
          <p>{report.reason_detail || report.reason}</p>
          <small>접수: {formatDateTime(report.created_at)} · 신고자: {data.reporter ? displayName(data.reporter) : "정보 없음"}</small>
        </div>
      </section>

      <QuickActions
        reporter={data.reporter}
        targetUser={data.target_user}
        targetMeeting={data.target_meeting}
        targetRoom={data.target_room}
      />

      <div className="admin-report-detail-grid">
        <UserRiskCard title="신고한 회원" user={data.reporter} />
        <UserRiskCard title="신고 대상 회원" user={data.target_user} tone="danger" />
      </div>

      {isRoomReport && data.target_room ? (
        <section className="admin-report-detail-card">
          <header>
            <span>신고 대상 채팅방</span>
            {data.target_room.meeting?.id ? <Link to={`/admin/meetings/${data.target_room.meeting.id}`}>모임 상세</Link> : null}
          </header>
          <strong>{data.target_room.meeting?.title || report.target_name}</strong>
          <p>{data.target_room.meeting?.location_name || "장소 미정"}</p>
        </section>
      ) : null}

      <div className="admin-report-log-grid">
        {isRoomReport ? (
          <ChatLogList title="신고된 방의 채팅 로그" logs={data.chat_logs || []} emptyText="확인할 채팅 로그가 없습니다." />
        ) : null}
        {isUserReport ? (
          <ChatLogList title="신고 대상 회원의 채팅 로그" logs={allUserLogs} emptyText="확인할 채팅 로그가 없습니다." />
        ) : null}
        {!isRoomReport && !isUserReport ? (
          <ChatLogList title="관련 채팅 로그" logs={[]} emptyText="이 신고 유형에는 연결된 채팅 로그가 없습니다." />
        ) : null}
      </div>

      {data.related_reports?.length ? (
        <section className="admin-report-detail-card">
          <header><span>대상 회원의 과거 신고 이력</span><b>{data.related_reports.length}건</b></header>
          <div className="admin-report-related-list">
            {data.related_reports.map((item) => (
              <Link key={item.id} to={`/admin/reports/${item.id}`}>
                <b>#{item.id} {statusLabel[item.status] || item.status}</b>
                <span>{item.reason_detail || item.reason}</span>
                <small>{formatDateTime(item.created_at)} · 신고자 {item.reporter_name}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form className="admin-report-process-card" onSubmit={saveReport}>
        <header><CheckCircle size={16} />신고 처리</header>
        {message ? <p>{message}</p> : null}
        <label>
          처리 상태
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
            <option value="pending">대기 중</option>
            <option value="in_progress">처리 중</option>
            <option value="resolved">처리 완료</option>
            <option value="dismissed">반려</option>
          </select>
        </label>
        <label>
          내부 처리 메모
          <textarea rows={5} value={form.admin_note} onChange={(event) => setForm((current) => ({ ...current, admin_note: event.target.value }))} placeholder="처리 근거, 확인한 로그, 조치 내용을 기록하세요." />
        </label>
        <button type="submit" disabled={saving}>{saving ? "저장 중..." : "처리 저장"}</button>
      </form>
    </div>
  );
}

export default AdminReportDetailPage;
