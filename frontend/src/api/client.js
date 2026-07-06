import axios from "axios";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const API_BASE_URL =
  typeof window !== "undefined" &&
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("127.0.0.1") &&
  configuredApiBaseUrl.startsWith("/api")
    ? "https://sportsmate.onrender.com/api/v1"
    : configuredApiBaseUrl;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("sportsmate_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 503 || error.response.data?.maintenance === true)) {
      const isLoginOrAdminPath = window.location.pathname === "/login" || window.location.pathname.startsWith("/admin");
      if (!isLoginOrAdminPath && !document.getElementById("maintenance-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "maintenance-overlay";
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "#ffffff";
        overlay.style.zIndex = "999999";
        overlay.style.display = "flex";
        overlay.style.flexDirection = "column";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.fontFamily = "system-ui, sans-serif";
        overlay.style.color = "#0f172a";
        overlay.style.padding = "24px";
        overlay.style.textAlign = "center";
        
        overlay.innerHTML = `
          <div style="max-width: 450px;">
            <div style="font-size: 64px; margin-bottom: 24px;">🚧</div>
            <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 16px; color: #1e3a8a;">서비스 점검 중</h1>
            <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
              현재 더 안정적인 서비스 제공을 위해 시스템 점검을 진행하고 있습니다.<br/>
              이용에 불편을 드려 대단히 죄송하며, 신속히 점검을 마치고 복귀하겠습니다.
            </p>
            <div style="font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              문의 사항: contact@sportsmate.co.kr
            </div>
          </div>
        `;
        document.body.appendChild(overlay);
        localStorage.removeItem("sportsmate_token");
      }
    }

    if (error.response && error.response.status === 401) {
      const msg = error.response.data?.message || error.response.data?.msg;
      if (msg === "정지된 회원입니다.") {
        if (!window.hasAlertedSuspended) {
          window.hasAlertedSuspended = true;
          alert("정지된 회원입니다.");
          localStorage.removeItem("sportsmate_token");
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
