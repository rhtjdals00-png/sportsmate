import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AlertCircle, Camera, X } from "lucide-react";
import Button from "../common/Button";

function MobileQrScanner({ onClose, onScan }) {
  const [error, setError] = useState("");
  const [hasCamera, setHasCamera] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let html5QrCode;

    async function startCamera() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          html5QrCode = new Html5Qrcode("qr-reader");
          scannerRef.current = html5QrCode;
          
          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              if (html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  onScan(decodedText);
                }).catch(err => {
                  console.error("Failed to stop scanning", err);
                  onScan(decodedText);
                });
              }
            },
            (errorMessage) => {
              // ignore normal scanning errors
            }
          );
        } else {
          setHasCamera(false);
          setError("사용 가능한 카메라가 없습니다.");
        }
      } catch (err) {
        console.error("Error starting camera", err);
        setHasCamera(false);
        setPermissionDenied(true);
        setError("카메라 접근 권한이 거부되었습니다.");
      }
    }

    startCamera();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, background: '#000',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'rgba(0,0,0,0.5)', color: '#fff', zIndex: 10
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>QR 출석 체크</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', padding: '8px' }}>
          <X size={24} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div id="qr-reader" style={{ width: '100%', maxWidth: '400px' }}></div>
        
        {!hasCamera && (
          <div style={{
            position: 'absolute', inset: 0, background: '#000',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', textAlign: 'center', color: '#fff'
          }}>
            {permissionDenied ? (
              <>
                <Camera size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
                <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>카메라 접근 권한 안내</h4>
                <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: 1.5 }}>
                  QR 코드를 스캔하려면 카메라 권한이 필요합니다.<br />
                  브라우저 설정에서 카메라 권한을 허용해주세요.
                </p>
                <Button onClick={() => window.location.reload()} variant="primary">
                  새로고침 후 다시 시도
                </Button>
              </>
            ) : (
              <>
                <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
                <p>{error}</p>
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
        방장이 띄운 출석 QR 코드를 사각형 안에 맞춰주세요.
      </div>
    </div>
  );
}

export default MobileQrScanner;
