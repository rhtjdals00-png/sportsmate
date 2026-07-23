import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Clock3, QrCode } from "lucide-react";
import Button from "../common/Button.jsx";
import { meetingApi } from "../../api/meetingApi";
import {
  attendanceSessionSignature,
  evaluateQrAttendance,
} from "../../utils/attendancePolicy.js";
import {
  buildAttendanceCheckinUrl,
  isLoopbackQrOrigin,
  resolveQrPublicOrigin,
} from "../../utils/qrUrl.js";

function formatRemaining(milliseconds) {
  if (milliseconds <= 0) return "종료됨";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}분 ${String(seconds).padStart(2, "0")}초 남음`;
}

function formatPolicyTime(value) {
  if (!value) return "";
  return value.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

function AttendanceQrPanel({ meetingId, session, onRefreshSession }) {
  const [checkinWindow, setCheckinWindow] = useState(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const signature = attendanceSessionSignature(session);
  const previousSignatureRef = useRef(signature);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previousSignatureRef.current && previousSignatureRef.current !== signature) {
      setToken((currentToken) => {
        if (currentToken) {
          setError("일정이 변경되어 기존 QR이 만료되었습니다. 새 QR을 발급해 주세요.");
        }
        return "";
      });
      setCheckinWindow(null);
    }
    previousSignatureRef.current = signature;
  }, [signature]);

  const policy = evaluateQrAttendance(session, now);
  const expired = policy.code === "WINDOW_CLOSED";
  const configuredQrOrigin = import.meta.env.VITE_QR_PUBLIC_ORIGIN;
  const qrPublicOrigin = useMemo(
    () => resolveQrPublicOrigin(configuredQrOrigin, window.location.origin),
    [configuredQrOrigin],
  );
  const checkinUrl = useMemo(
    () => buildAttendanceCheckinUrl({
      token,
      configuredOrigin: configuredQrOrigin,
      currentOrigin: window.location.origin,
    }),
    [configuredQrOrigin, token],
  );
  const showLocalhostGuide = isLoopbackQrOrigin(qrPublicOrigin);

  const createQr = async () => {
    setLoading(true);
    setError("");
    try {
      await onRefreshSession?.();
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
          <Clock3 size={15} /> {policy.allowed
            ? formatRemaining(policy.closesAt.getTime() - now)
            : policy.code === "TOO_EARLY"
              ? "발급 대기"
              : "사용 불가"}
        </strong>
      </div>
      {showLocalhostGuide ? (
        <small>휴대폰에서 테스트하려면 PC의 LAN IP로 접속하거나 VITE_QR_PUBLIC_ORIGIN을 설정해 주세요.</small>
      ) : null}

      {token && policy.allowed ? (
        <div className="attendance-qr-panel__code">
          <QRCodeSVG value={checkinUrl} size={220} level="M" includeMargin />
          <div>
            <strong>QR 체크인 진행 중</strong>
            <p>현재 회차의 출석 가능 시간 동안 체크인할 수 있습니다.</p>
            <Button type="button" onClick={createQr} disabled={loading}>
              {loading ? "재발급 중" : "QR 새로 발급"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="attendance-qr-panel__empty">
          <p>{policy.allowed ? "QR을 생성해 참여자에게 보여주세요." : policy.message}</p>
          <Button type="button" onClick={createQr} disabled={loading || !policy.allowed}>
            <QrCode size={17} /> {loading ? "생성 중" : "QR 체크인 시작"}
          </Button>
        </div>
      )}
      {checkinWindow && policy.allowed ? (
        <small>유효 시간: {formatPolicyTime(policy.opensAt)} ~ {formatPolicyTime(policy.closesAt)}</small>
      ) : null}
      {error ? <p className="attendance-qr-panel__error">{error}</p> : null}
    </section>
  );
}

export default AttendanceQrPanel;
