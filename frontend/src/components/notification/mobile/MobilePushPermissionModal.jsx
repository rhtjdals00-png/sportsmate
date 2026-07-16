import React, { useState } from "react";
import { BellRing, ShieldCheck, X } from "lucide-react";
import { enablePushNotifications } from "../../../utils/pushNotifications";

export default function MobilePushPermissionModal({ isOpen, onClose }) {
  const [message, setMessage] = useState("");
  const [isGranted, setIsGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const requestPushPermission = async () => {
    setMessage("");
    setLoading(true);
    try {
      await enablePushNotifications();
      setIsGranted(true);
      setMessage("알림 권한이 설정되었습니다.");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setMessage(error?.message || "알림 권한을 설정하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-permission-guide" role="dialog" aria-modal="true" aria-label="알림 권한 안내">
      <button className="mobile-permission-guide__backdrop" type="button" onClick={onClose} aria-label="닫기" />
      <button className="mobile-permission-guide__close" type="button" onClick={onClose} aria-label="닫기">
        <X size={20} />
      </button>
      <section>
        <div className="mobile-permission-guide__icon">
          <ShieldCheck size={26} />
        </div>
        <span>앱 권한 안내</span>
        <h2>알림 권한이 허용되어 있지 않습니다.</h2>
        <p>승인 소식이나 채팅 등 중요한 알림을 받지 못할 수도 있어요.</p>
        <div className="mobile-permission-guide__actions">
          <button className="is-push" type="button" onClick={requestPushPermission} disabled={loading || isGranted}>
            <BellRing size={17} />
            {loading ? "설정 중..." : isGranted ? "허용됨" : "알림 권한 설정하기"}
          </button>
        </div>
        {message && <p className="mobile-permission-guide__message">{message}</p>}
        <button className="mobile-permission-guide__skip" type="button" onClick={onClose}>
          {isGranted ? "닫기" : "나중에 하기"}
        </button>
      </section>
    </div>
  );
}
