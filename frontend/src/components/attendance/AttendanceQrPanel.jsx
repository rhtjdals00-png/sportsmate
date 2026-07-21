import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Clock3, QrCode } from "lucide-react";
import Button from "../common/Button.jsx";
import { meetingApi } from "../../api/meetingApi";

function formatRemaining(milliseconds) {
  if (milliseconds <= 0) return "종료됨";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초 남음`;
}

function getQrPublicOrigin() {
  const configuredOrigin = import.meta.env.VITE_QR_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (configuredOrigin) return configuredOrigin;
  if (import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return "http://192.168.10.4:5173";
  }
  return window.location.origin;
}

function AttendanceQrPanel({ meetingId, session }) {
  const [checkinWindow, setCheckinWindow] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const startAt = session?.start_at ? new Date(session.start_at).getTime() : 0;
  const closesAt = startAt ? startAt + 30 * 60 * 1000 : 0;
  const expired = Boolean(closesAt && now >= closesAt);
  const beforeStart = Boolean(startAt && now < startAt);
  const qrPublicOrigin = useMemo(() => getQrPublicOrigin(), []);
  const checkinUrl = useMemo(
    () => (token ? `${qrPublicOrigin}/attendance/checkin/${encodeURIComponent(token)}` : ""),
    [qrPublicOrigin, token],
  );

  const createQr = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await meetingApi.createAttendanceCheckinWindow(meetingId, session.id);
      setCheckinWindow(data.window);
      setToken(data.token);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "QR 코드를 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <section className="attendance-qr-panel">
      <div className="attendance-qr-panel__heading">
        <div>
          <span><QrCode size={18} /> QR 셀프 체크인</span>
          <p>참여자가 휴대폰 카메라로 스캔하면 이 회차에 바로 출석 처리됩니다.</p>
        </div>
        <strong className={expired ? "expired" : ""}>
          <Clock3 size={15} /> {formatRemaining(closesAt - now)}
        </strong>
      </div>

      {token && !expired ? (
        <div className="attendance-qr-panel__code">
          <QRCodeSVG value={checkinUrl} size={220} level="M" includeMargin />
          <div>
            <strong>{beforeStart ? "사전 QR 체크인 진행 중" : "QR 체크인 진행 중"}</strong>
            <p>
              {beforeStart
                ? "QR 생성 직후부터 참여자가 미리 체크인할 수 있습니다."
                : "모임 시작 후 30분까지 체크인할 수 있습니다."}
            </p>
            <Button type="button" onClick={createQr} disabled={loading}>
              {loading ? "재발급 중" : "QR 새로 발급"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="attendance-qr-panel__empty">
          <p>{expired ? "이 회차의 QR 체크인 가능 시간이 종료되었습니다." : "QR을 생성해 참여자에게 보여주세요."}</p>
          <Button type="button" onClick={createQr} disabled={loading || expired}>
            <QrCode size={17} /> {loading ? "생성 중" : "QR 체크인 시작"}
          </Button>
        </div>
      )}
      {checkinWindow && !expired ? <small>유효 시간: {new Date(checkinWindow.opens_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ~ {new Date(checkinWindow.closes_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</small> : null}
      {error ? <p className="attendance-qr-panel__error">{error}</p> : null}
    </section>
  );
}

export default AttendanceQrPanel;
